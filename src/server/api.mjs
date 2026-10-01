import { readAccounts, readLogins, removeAccounts } from './accounts.mjs';
import { createKeyService } from './api-keys.mjs';
import { createSupport } from './support.mjs';
import { applySettings, bootstrapSettings, describeSettings, officeMembers, readSettings, writeSettings } from './settings.mjs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { brandedMail } from './mail.mjs';
import { applyAction, visibleState, publicRoll, attireExample, publicOverlay, broadcastRecipients, signupOf, SIGNUP_PAUSED } from '../registration/model.mjs';
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
  let publicCache = { at: 0, value: null };
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
        const address = emailAddress(email);
        if (!['signin', 'office'].includes(mode)) {
          // Paused sign-up turns new people away at the first step; existing accounts still sign in.
          const [[known]] = await pool.execute('SELECT 1 FROM dr_users WHERE email=?', [address]);
          if (!known) {
            const pause = signupOf(await transaction(pool, conn => readState(conn)));
            if (pause.closed) throw new HttpError(403, pause.notice || SIGNUP_PAUSED);
          }
        }
        await auth.requestCode(address, url.origin, ['signin', 'office'].includes(mode) ? mode : 'signup');
        return json({ ok: true, codeRequired: true });
      }
      if (path === '/api/registration/auth/access' && method === 'POST') {
        const { code, office = false } = await jsonBody(request);
        const session = await auth.accessWithCode(code, office === true);
        await auth.signOut(request);
        return json(session.actor, 200, { 'Set-Cookie': sessionCookie(config, session.token) });
      }
      if (path === '/api/registration/public-directory' && method === 'GET') {
        // Open to everyone: the roll carries no contact details. Cached briefly and
        // rate limited so the public page cannot be used to hammer the database.
        await rateLimit(pool, config, `public-directory:${request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'all'}`, 120, 60000);
        if (!publicCache.value || Date.now() - publicCache.at > 30000) {
          const state = await transaction(pool, conn => readState(conn));
          publicCache = { at: Date.now(), value: { source: config.publicDirectory, roll: publicRoll(state, people), ...publicOverlay(state) } };
        }
        return json(publicCache.value, 200, { 'Cache-Control': 'public, max-age=30' });
      }
      if (path === '/api/registration/auth/verify' && method === 'POST') {
        const { email, token, mode, remember } = await jsonBody(request);
        const session = await auth.verifyCode(emailAddress(email), token, ['signin', 'office'].includes(mode) ? mode : 'signup', remember === true);
        await auth.signOut(request);
        return json(session.actor, 200, { 'Set-Cookie': sessionCookie(config, session.token, session.maxAge) });
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
      // Portraits on the public directory may be fetched without a session; the media route checks each one.
      if (!actor && !path.startsWith('/api/registration/media')) throw new HttpError(401, 'Please sign in again.');
      if (['/api/registration/accounts', '/api/registration/logins'].includes(path) && method === 'GET') {
        if (!actor.office) throw new HttpError(403, 'Office access required.');
        return json(await (path.endsWith('/accounts') ? readAccounts : readLogins)(pool, config, url));
      }
      if (path === '/api/registration/accounts/remove' && method === 'POST') {
        if (!actor.office) throw new HttpError(403, 'Office access required.');
        return json(await removeAccounts(pool, config, actor, await jsonBody(request)));
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
      if (path === '/api/registration/settings/telegram-test' && method === 'POST') {
        // The office checks the Telegram link right after pasting the token and chat ID.
        if (!actor.office) throw new HttpError(403, 'Office access required.');
        if (!config.telegram) throw new HttpError(400, 'Save the Telegram bot token and chat ID first.');
        const response = await fetcher(`https://api.telegram.org/bot${config.telegram.token}/sendMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: config.telegram.chat, text: `Kuriake Castle is connected. Website issue reports will appear here.\nTest sent by ${actor.email} at ${new Date().toISOString()}` }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.ok) throw new HttpError(400, `Telegram refused the message: ${result.description || `status ${response.status}`}. Check the token, that the bot is an admin of the channel, and the chat ID (channels start with -100).`);
        return json({ ok: true, chat: result.result?.chat?.title || config.telegram.chat });
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
        return json({ ...view, office: actor.office, payment: config.momo, paystackKey: config.paystackPublic, publicDirectory: config.publicDirectory });
      }
      if (path === '/api/registration/communication/send' && method === 'POST') {
        // A broadcast from the office to everyone, all bishops, all pastors, or chosen people.
        if (!actor.office) throw new HttpError(403, 'Office access required.');
        if (!mailer) throw new HttpError(503, 'Email is not set up yet. Add the Resend key in Settings first.');
        const { subject, message, audience = 'all', ids = [] } = await jsonBody(request);
        const subj = String(subject || '').trim().slice(0, 200), text = String(message || '').trim();
        if (!subj || !text) throw new HttpError(400, 'Enter a subject and a message.');
        if (!['all', 'bishops', 'pastors', 'selected'].includes(audience)) throw new HttpError(400, 'Choose who should receive it.');
        await rateLimit(pool, config, `broadcast:${actor.id}`, 20, 3600000);
        const state = await transaction(pool, conn => readState(conn));
        const targets = broadcastRecipients(state, audience, Array.isArray(ids) ? ids.map(String) : []);
        if (!targets.length) throw new HttpError(400, 'Nobody matches that audience yet.');
        let sent = 0; const failed = [];
        for (const t of targets) {
          try { await mailer.sendMail(brandedMail({ from: config.from, to: t.email, subject: subj, text: `Dear ${t.name.split(' ')[0]},\n\n${text}\n\nKuriake Castle Office` })); sent++; }
          catch (error) { failed.push(t.email); logger.error('broadcast failed for', t.email, error.message); }
        }
        await transaction(pool, async conn => {
          const before = await readState(conn, true);
          await persistState(conn, before, applyAction(before, actor, 'broadcast', { subject: subj, audience, recipients: sent }, undefined, people));
        });
        return json({ sent, failed });
      }
      if (path === '/api/registration/action' && method === 'POST') {
        await rateLimit(pool, config, `action:${actor.id}`, 120, 60000);
        const { name, payload = {} } = await jsonBody(request);
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new HttpError(400, 'Invalid action data.');
        if (name === 'recordPaystack') throw new HttpError(400, 'Payments are recorded after Paystack confirms them.');
        let reviewed = null;
        await transaction(pool, async conn => {
          const before = await readState(conn, true);
          if (['save', 'submit', 'update'].includes(name) && payload.photo) await assertOwnedMedia(conn, actor, payload.photo, 'portrait');
          if (name === 'payment') await assertOwnedMedia(conn, actor, payload.proof, 'receipt');
          if (name === 'approveBishop' && payload.referenceId && !references.some(r => r.id === payload.referenceId))
            throw new HttpError(400, 'Choose a listed bishop reference.');
          let after;
          try { after = applyAction(before, actor, name, payload, undefined, people); }
          catch (error) { throw new HttpError(400, error.message); }
          await persistState(conn, before, after);
          if (name === 'reviewBishop') reviewed = after.registrations.find(r => r.userId === payload.userId && r.year === after.year);
        });
        publicCache.at = 0; // office edits and pauses show on the public page at once
        // The office's decision goes to the address the bishop registered with; a mail failure must not undo the decision.
        if (reviewed?.data?.email) {
          const resubmit = payload.decision === 'resubmit';
          const role = reviewed.data.role === 'bishop' ? 'Bishop' : 'Pastor';
          const esc = v => String(v).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
          const reasons = String(payload.note).split('\n').map(l => l.replace(/^•\s*/, '').trim()).filter(Boolean);
          const photoIssue = reasons.some(r => /photo/i.test(r));
          const others = reasons.filter(r => !/photo/i.test(r));
          const requirements = [reviewed.data.gender === 'female' ? `Official attire as shown (${reviewed.data.organization === 'United Denominations' ? 'United Denominations' : 'First Love'})` : role === 'Bishop' ? 'Red jacket' : 'Official pastoral attire (clerical collar, or dark suit and tie)', 'Face fully visible', 'Plain background'];
          // Their photo beside the required standard, embedded so it shows on any phone.
          const attachments = [];
          let comparison = '';
          if (photoIssue) {
            const example = attireExample(reviewed.data);
            attachments.push({ filename: 'required.jpg', path: fileURLToPath(new URL(`../../${example.file}`, import.meta.url)), cid: 'required' });
            const yours = reviewed.data.photo ? await storage.bytes(reviewed.data.photo) : null;
            if (yours) attachments.push({ filename: 'your-photo.webp', content: yours, contentType: 'image/webp', cid: 'yours' });
            const cell = (cid, caption) => `<td style="padding:8px;text-align:center;vertical-align:top"><img src="cid:${cid}" alt="${esc(caption)}" width="200" style="display:block;width:200px;height:230px;object-fit:cover;border-radius:12px;margin:0 auto 8px"><div style="font:600 13px system-ui,sans-serif;color:#172139">${esc(caption)}</div></td>`;
            comparison = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0 18px"><tr>${yours ? cell('yours', 'The photo you submitted') : ''}${cell('required', example.caption)}</tr></table>`;
          }
          const intro = resubmit
            ? `The Kuriake Castle Office has reviewed your registration. Before your registration can be confirmed, please make the following update${reasons.length > 1 ? 's' : ''}:`
            : 'The Kuriake Castle Office has reviewed your registration and was not able to approve it, for the following reason(s):';
          const photoText = photoIssue ? `Photo Requirement\nThe photo submitted does not meet the official attire requirements. As a ${role}, please upload a new photo that meets the following requirements:\n${requirements.map(r => `* ${r}`).join('\n')}\n\n` : '';
          const othersText = others.length ? `${photoIssue ? 'Other Updates' : 'Updates Needed'}\n${others.map(r => `* ${r}`).join('\n')}\n\n` : '';
          const closing = resubmit
            ? `Please sign in at ${url.origin}/signup/ using the same email address you registered with, go to My Profile, make the update${reasons.length > 1 ? 's' : ''}, and submit your registration again.\n\nOnce the update has been submitted, your registration will be reviewed for confirmation.`
            : 'If you believe this decision is a mistake, reply to this email or use “Any issues?” on the site.';
          const text = `Dear ${reviewed.data.name},\n\n${intro}\n\n${photoText}${othersText}${closing}\n\nBlessings,\nKuriake Castle Office`;
          const html = `<div style="font:15px/1.6 system-ui,-apple-system,sans-serif;color:#172139;max-width:560px">
<p>Dear ${esc(reviewed.data.name)},</p>
<p>${esc(intro)}</p>
${photoIssue ? `<p><b>Photo Requirement</b><br>The photo submitted does not meet the official attire requirements. As a ${role}, please upload a new photo that meets the following requirements:</p><ul>${requirements.map(r => `<li>${esc(r)}</li>`).join('')}</ul>${comparison}` : ''}
${others.length ? `<p><b>${photoIssue ? 'Other Updates' : 'Updates Needed'}</b></p><ul>${others.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
<p>${esc(closing).replace(/(https?:\/\/\S+?)(\s|$)/, '<a href="$1">$1</a>$2').replace(/\n\n/g, '</p><p>')}</p>
<p>Blessings,<br>Kuriake Castle Office</p></div>`;
          mailer.sendMail(brandedMail({ from: config.from, to: reviewed.data.email,
            subject: resubmit ? `Action required: your ${role} registration is not confirmed yet` : `Your Kuriake Castle ${role} registration was not approved`,
            text, html, attachments }))
            .catch(error => logger.error('Review mail failed', { type: error.name, code: error.code }));
        }
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
