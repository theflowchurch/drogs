import { readAccounts, readLogins } from './accounts.mjs';
import { createKeyService } from './api-keys.mjs';
import { readFile } from 'node:fs/promises';
import { applyAction, visibleState } from '../registration/model.mjs';
import { transaction, readState, persistState } from './database.mjs';
import { HttpError, emailAddress, sessionCookie, rateLimit } from './auth.mjs';
import { assertOwnedMedia, canReadMedia } from './storage.mjs';
const references = JSON.parse(await readFile(new URL('../registration/reference-bishops.json', import.meta.url), 'utf8'));
export async function readBody(request, limit = 256 * 1024) {
  if (Number(request.headers.get('content-length')) > limit) throw new HttpError(413, 'The upload is too large.');
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader(), chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw new HttpError(413, 'The upload is too large.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
async function jsonBody(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new HttpError(415, 'Send JSON data.');
  try {
    const value = JSON.parse((await readBody(request)).toString('utf8'));
    if (!value || Array.isArray(value) || typeof value !== 'object') throw Error();
    return value;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Invalid request data.');
  }
}
const json = (value, status = 200, headers = {}) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
export function createApi({ pool, config, auth, storage, logger = console }) {
  const keys = createKeyService({ pool, config, storage });
  return async function handle(request) {
    try {
      const url = new URL(request.url), path = url.pathname.replace(/\/$/, ''), method = request.method;
      if (path.startsWith('/api/v1/')) return json(await keys.read(request));
      if (!['GET', 'POST'].includes(method)) throw new HttpError(405, 'Method not allowed.');
      if (method === 'POST' && request.headers.get('origin') !== config.origin)
        throw new HttpError(403, 'Open the form on the configured website before continuing.');
      if (request.headers.get('sec-fetch-site') === 'cross-site') throw new HttpError(403, 'Cross-site requests are not allowed.');
      if (path === '/api/registration/auth/request' && method === 'POST') {
        const { email } = await jsonBody(request);
        await auth.requestCode(emailAddress(email));
        return json({ ok: true });
      }
      if (path === '/api/registration/auth/verify' && method === 'POST') {
        const { email, token } = await jsonBody(request);
        const session = await auth.verifyCode(emailAddress(email), token);
        await auth.signOut(request);
        return json(session.actor, 200, { 'Set-Cookie': sessionCookie(config, session.token) });
      }
      if (path === '/api/registration/auth/signout' && method === 'POST') {
        await auth.signOut(request);
        return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(config, '', 0) });
      }
      const actor = await auth.actor(request);
      if (path === '/api/registration/auth/me' && method === 'GET') return json(actor);
      if (!actor) throw new HttpError(401, 'Please sign in again.');
      if (['/api/registration/accounts', '/api/registration/logins'].includes(path) && method === 'GET') {
        if (!actor.office) throw new HttpError(403, 'Office access required.');
        return json(await (path.endsWith('/accounts') ? readAccounts : readLogins)(pool, config, url));
      }
      if (path === '/api/registration/keys' && method === 'GET') return json(await keys.list(actor));
      if (path === '/api/registration/keys' && method === 'POST') return json(await keys.issue(actor, await jsonBody(request)), 201);
      if (path === '/api/registration/keys/revoke' && method === 'POST') return json(await keys.revoke(actor, (await jsonBody(request)).id));
      if (path === '/api/registration/snapshot' && method === 'GET') {
        const state = await transaction(pool, conn => readState(conn));
        const view = visibleState(state, actor, references);
        if (!actor.office) {
          // Payment evidence is available only to its owner and the office.
          view.registrations = view.registrations.map(r => r.userId === actor.id ? r : { ...r, proof: undefined });
        }
        return json({ ...view, office: actor.office });
      }
      if (path === '/api/registration/action' && method === 'POST') {
        await rateLimit(pool, config, `action:${actor.id}`, 120, 60000);
        const { name, payload = {} } = await jsonBody(request);
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new HttpError(400, 'Invalid action data.');
        await transaction(pool, async conn => {
          const before = await readState(conn, true);
          if (['save', 'submit'].includes(name) && payload.photo) await assertOwnedMedia(conn, actor, payload.photo, 'portrait');
          if (name === 'payment') await assertOwnedMedia(conn, actor, payload.proof, 'receipt');
          if (name === 'approveBishop' && payload.referenceId && !references.some(r => r.id === payload.referenceId))
            throw new HttpError(400, 'Choose a listed bishop reference.');
          let after;
          try { after = applyAction(before, actor, name, payload); }
          catch (error) { throw new HttpError(400, error.message); }
          await persistState(conn, before, after);
        });
        return json({ ok: true });
      }
      if (path === '/api/registration/upload' && method === 'POST') {
        const bytes = await readBody(request, 5 * 1024 * 1024);
        const key = await storage.upload(actor, bytes, request.headers.get('content-type'), url.searchParams.get('kind'));
        return json({ path: key }, 201);
      }
      if (path === '/api/registration/media' && method === 'GET') {
        const key = url.searchParams.get('path');
        if (!key || key.length > 512) throw new HttpError(400, 'Invalid image reference.');
        const [[media]] = await pool.execute('SELECT * FROM dr_media WHERE object_key=?', [key]);
        if (!media) throw new HttpError(404, 'Image not found.');
        const state = await transaction(pool, conn => readState(conn));
        if (!canReadMedia(state, actor, media)) throw new HttpError(403, 'You do not have access to this image.');
        return json({ url: await storage.url(key) });
      }
      throw new HttpError(404, 'Not found.');
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      // Never log SQL bindings, credentials, email codes or uploaded personal information.
      logger.error('Registration API failed', { type: error.name, code: error.code || 'INTERNAL' });
      return json({ error: 'The service is temporarily unavailable. Please try again shortly.' }, 503);
    }
  };
}
