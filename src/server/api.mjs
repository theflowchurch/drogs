import { readAccounts, readLogins } from './accounts.mjs';
import { createKeyService } from './api-keys.mjs';
import { createSupport } from './support.mjs';
import { applySettings, bootstrapSettings, describeSettings, officeMembers, readSettings, writeSettings } from './settings.mjs';
import { readFile } from 'node:fs/promises';
import { applyAction, visibleState, publicRoll } from '../registration/model.mjs';
import { transaction, readState, persistState } from './database.mjs';
import { HttpError, emailAddress, sessionCookie, rateLimit } from './auth.mjs';
import { assertOwnedMedia, canReadMedia } from './storage.mjs';
const people = JSON.parse(await readFile(new URL('../registration/reference-people.json', import.meta.url), 'utf8'));
const references = people.filter(p => p.role === 'bishop');
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
// The smallest acceptable charge for this member's commitment, in the
// transaction currency's minor unit. GHS uses the same indicative USD rate the
// member saw, minus a 3% margin for the provider's own conversion.
// ponytail: fetched per verification; cache it if Paystack volume grows.
async function paystackMinimum(state, actor, currency, fetcher) {
  const r = state.registrations.find(r => r.userId === actor.id && r.year === state.year);
  const usd = r?.amount || 0;
  if (currency === 'USD') return usd * 100;
  if (currency !== 'GHS') throw new HttpError(400, 'Only GHS or USD payments are accepted.');
  const rates = await (await fetcher('https://open.er-api.com/v6/latest/USD')).json().catch(() => null);
  const rate = Number(rates?.rates?.GHS);
  if (!Number.isFinite(rate) || rate <= 0) throw new HttpError(503, 'The exchange rate is unavailable; please try again shortly.');
  return Math.floor(usd * rate * 0.97 * 100);
}
const json = (value, status = 200, headers = {}) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
export function createApi({ pool, config, auth, storage, mailer, fetcher = fetch, logger = console }) {
  const keys = createKeyService({ pool, config, storage });
  const support = createSupport({ config, mailer, fetcher, logger });
  return async function handle(request) {
    try {
      const url = new URL(request.url), path = url.pathname.replace(/\/$/, ''), method = request.method;
      await applySettings(config, pool);
      if (path.startsWith('/api/v1/')) return json(await keys.read(request));
      if (!['GET', 'POST'].includes(method)) throw new HttpError(405, 'Method not allowed.');
      if (method === 'POST' && request.headers.get('origin') !== url.origin)
        throw new HttpError(403, 'Open the form on the configured website before continuing.');
      if (request.headers.get('sec-fetch-site') === 'cross-site') throw new HttpError(403, 'Cross-site requests are not allowed.');
      if (path === '/api/registration/auth/office-code' && method === 'POST') {
        return json(await auth.checkOfficeCode((await jsonBody(request)).code));
      }
      if (path === '/api/registration/auth/request' && method === 'POST') {
        const { email, mode } = await jsonBody(request);
        const requested = await auth.requestCode(emailAddress(email), url.origin, mode === 'office' ? 'office' : 'signup');
        return json({ ok: true, codeRequired: requested?.codeRequired !== false });
      }
      if (path === '/api/registration/auth/access' && method === 'POST') {
        const { code, office = false } = await jsonBody(request);
        const session = await auth.accessWithCode(code, office === true);
        await auth.signOut(request);
        return json(session.actor, 200, { 'Set-Cookie': sessionCookie(config, session.token) });
      }
      if (path === '/api/registration/public-directory' && method === 'GET') {
        // Open to everyone: the roll carries no contact details.
        const state = await transaction(pool, conn => readState(conn));
        return json({ source: config.publicDirectory, roll: publicRoll(state, people) });
      }
      if (path === '/api/registration/auth/verify' && method === 'POST') {
        const { email, token, mode } = await jsonBody(request);
        const session = await auth.verifyCode(emailAddress(email), token, ['signin', 'office'].includes(mode) ? mode : 'signup');
        await auth.signOut(request);
        return json(session.actor, 200, { 'Set-Cookie': sessionCookie(config, session.token) });
      }
      if (path === '/api/registration/auth/signout' && method === 'POST') {
        await auth.signOut(request);
        return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(config, '', 0) });
      }
      if (path === '/api/registration/settings/bootstrap' && method === 'POST') {
        await bootstrapSettings(config, pool, await jsonBody(request));
        await applySettings(config, pool);
        return json({ ok: true });
      }
      const actor = await auth.actor(request);
      if (path === '/api/registration/auth/me' && method === 'GET') return json(actor);
      if (!actor) throw new HttpError(401, 'Please sign in again.');
      if (['/api/registration/accounts', '/api/registration/logins'].includes(path) && method === 'GET') {
        if (!actor.office) throw new HttpError(403, 'Office access required.');
        return json(await (path.endsWith('/accounts') ? readAccounts : readLogins)(pool, config, url));
      }
      if (path === '/api/registration/support' && method === 'POST') {
        await rateLimit(pool, config, `support:${actor.id}`, 5, 600000);
        return json(await support(actor, await jsonBody(request)));
      }
      if (path === '/api/registration/settings' && method === 'GET') {
        if (!actor.office) throw new HttpError(403, 'Office access required.');
        return json({ settings: describeSettings(await readSettings(pool)), admins: officeMembers(config) });
      }
      if (path === '/api/registration/settings' && method === 'POST') {
        await writeSettings(pool, (await jsonBody(request)).values, actor, config);
        await applySettings(config, pool);
        return json({ settings: describeSettings(await readSettings(pool)), admins: officeMembers(config) });
      }
      if (path === '/api/registration/keys' && method === 'GET') return json(await keys.list(actor));
      if (path === '/api/registration/keys' && method === 'POST') return json(await keys.issue(actor, await jsonBody(request)), 201);
      if (path === '/api/registration/keys/revoke' && method === 'POST') return json(await keys.revoke(actor, (await jsonBody(request)).id));
      if (path === '/api/registration/snapshot' && method === 'GET') {
        const state = await transaction(pool, conn => readState(conn));
        const view = visibleState(state, actor, references, people);
        if (!actor.office) {
          // Payment evidence is available only to its owner and the office.
          view.registrations = view.registrations.map(r => r.userId === actor.id ? r : { ...r, proof: undefined });
        }
        return json({ ...view, office: actor.office, paystackKey: config.paystackPublic, publicDirectory: config.publicDirectory });
      }
      if (path === '/api/registration/action' && method === 'POST') {
        await rateLimit(pool, config, `action:${actor.id}`, 120, 60000);
        const { name, payload = {} } = await jsonBody(request);
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new HttpError(400, 'Invalid action data.');
        if (name === 'recordPaystack') throw new HttpError(400, 'Payments are recorded after Paystack confirms them.');
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
        let key;
        try { key = await storage.upload(actor, bytes, request.headers.get('content-type'), url.searchParams.get('kind')); }
        catch (error) {
          if (error instanceof HttpError) throw error;
          // A storage-side failure (credentials, bucket, network) is a configuration problem, not the member's image.
          logger.error('Image storage failed', { type: error.name, code: error.code || error.$metadata?.httpStatusCode || 'INTERNAL' });
          throw new HttpError(503, 'Photo storage is not reachable at the moment. Your details are safe; please try again later, or tell the office with “Any issues?”.');
        }
        return json({ path: key }, 201);
      }
      if ((path === '/api/registration/media' || path === '/api/registration/media/blob') && method === 'GET') {
        const key = url.searchParams.get('path');
        if (!key || key.length > 512) throw new HttpError(400, 'Invalid image reference.');
        const [[media]] = await pool.execute('SELECT * FROM dr_media WHERE object_key=?', [key]);
        if (!media) throw new HttpError(404, 'Image not found.');
        const state = await transaction(pool, conn => readState(conn));
        if (!canReadMedia(state, actor, media)) throw new HttpError(403, 'You do not have access to this image.');
        if (path.endsWith('/blob')) {
          const bytes = await storage.blob(key);
          if (!bytes) throw new HttpError(404, 'Image not found.');
          return new Response(bytes, { status: 200, headers: { 'Content-Type': media.content_type, 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' } });
        }
        return json({ url: await storage.url(key) });
      }
      if (path === '/api/registration/paystack/verify' && method === 'POST') {
        if (!config.paystack) throw new HttpError(503, 'Card and mobile-money payments are not switched on yet.');
        await rateLimit(pool, config, `paystack:${actor.id}`, 20, 600000);
        const { reference } = await jsonBody(request);
        if (typeof reference !== 'string' || !/^[A-Za-z0-9._=-]{6,100}$/.test(reference)) throw new HttpError(400, 'Invalid payment reference.');
        const response = await fetcher(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${config.paystack}` } });
        const result = await response.json().catch(() => ({}));
        const tx = result?.data;
        if (!response.ok || !result?.status || tx?.status !== 'success') throw new HttpError(400, 'Paystack has not confirmed this payment yet.');
        await transaction(pool, async conn => {
          const before = await readState(conn, true);
          let after;
          try { after = applyAction(before, actor, 'recordPaystack', { reference, amount: tx.amount, currency: tx.currency, expectedMinor: await paystackMinimum(before, actor, tx.currency, fetcher) }); }
          catch (error) { throw new HttpError(400, error.message); }
          await persistState(conn, before, after);
        });
        return json({ ok: true });
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
