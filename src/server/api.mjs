import { denominationSite } from '../registration/denomination-sites.mjs';
import { fellowshipByPath } from '../registration/fellowship.mjs';
import { readBody, jsonBody } from './api-body.mjs';
import { createManagementApi } from './management-api.mjs';
import { readAccounts, readLogins, removeAccounts, changeAccountEmail } from './accounts.mjs';
import { createKeyService } from './api-keys.mjs';
import { createSupport } from './support.mjs';
import { applySettings, bootstrapSettings, describeSettings, officeMembers, readSettings, writeSettings } from './settings.mjs';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { paymentJson, createQuote, readQuote, checkoutReturnUrl, validateQuotedPayment } from './paystack.mjs';
import { fileURLToPath } from 'node:url';
import { brandedMail } from './mail.mjs';
import { createAutoPhoto, testGeminiKey } from './auto-photo.mjs';
import { applyAction, visibleState, publicRoll, attireExample, publicOverlay, broadcastRecipients, BROADCAST_AUDIENCES, signupOf, pauseFor, SIGNUP_PAUSED, feesOf, bishopKeyed, titleFor, inGoodStanding, claimDeadlines, claimDeadline } from '../registration/model.mjs';
import { canonicalPersonName } from '../registration/name-corrections.mjs';
import { transaction, readState, persistState } from './database.mjs';
import { HttpError, emailAddress, sessionCookie, officeDoor, rateLimit, digest, checkPassword } from './auth.mjs';
import { randomInt } from 'node:crypto';
import { assertOwnedMedia, assignedPortrait, canReadMedia } from './storage.mjs';
import { photoProgress, photoProgressGroups } from '../registration/photo-progress.mjs';
import { inGhana, paymentReady } from '../registration/manual-payments.mjs';
// The roster the browser gets has no contact details; the server merges them back for its own use (office views, broadcasts, matching).
const contacts = JSON.parse(await readFile(new URL('../../data/reference-contacts.json', import.meta.url), 'utf8'));
const rosterFile = await readFile(new URL('../registration/reference-people.json', import.meta.url), 'utf8');
const referencePeople = JSON.parse(rosterFile);
const rosterVersion = createHash('sha256').update(rosterFile).digest('hex');
const people = referencePeople.map(p => ({ ...p, ...(contacts[p.id] || {}) }));
const references = people.filter(p => p.role === 'bishop');
export { readBody } from './api-body.mjs';
// The smallest acceptable charge for this member's commitment, in the
// transaction currency's minor unit. GHS uses the same indicative USD rate the
// member saw, minus a 3% margin for the provider's own conversion.
// ponytail: fetched per verification; cache it if Paystack volume grows.
async function paystackMinimum(state, actor, currency, fetcher) {
  const r = state.registrations.find(r => r.userId === actor.id && r.year === state.year);
  const usd = r?.amount || 0;
  if (currency === 'USD') return usd * 100;
  if (currency !== 'GHS') throw new HttpError(400, 'Only GHS or USD payments are accepted.');
  const rates = await paymentJson(fetcher, 'https://open.er-api.com/v6/latest/USD');
  const rate = Number(rates?.rates?.GHS);
  if (!Number.isFinite(rate) || rate <= 0) throw new HttpError(503, 'The exchange rate is unavailable; please try again shortly.');
  return Math.floor(usd * rate * 0.97 * 100);
}
const json = (value, status = 200, headers = {}) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
export function createApi({ pool, config, auth, storage, mailer, fetcher = fetch, logger = console }) {
  let publicCache = { at: 0, value: null };
  let paymentRate = { at: 0, value: 0 };
  const keys = createKeyService({ pool, config, storage });
  const management = createManagementApi({ pool, config, storage, keys, people, invalidate: () => { publicCache.at = 0; } });
  const support = createSupport({ config, mailer, fetcher, logger });
  const autoPhoto = createAutoPhoto({ pool, config, storage, references: people, fetcher, logger });
  // The email a bishop gets when a pastor registers under them; the same pastor
  // also waits under "To do" on the bishop's account until confirmed.
  async function notifyBishop({ pastor, to, bishopName, bishopUser, bishopTitle = 'Bishop', unregistered = false }) {
    let address = to;
    if (!address && bishopUser) { const [[u]] = await pool.execute('SELECT email FROM dr_users WHERE id=?', [bishopUser]); address = u?.email || ''; }
    if (!address) return;
    const esc = v => String(v || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    // The bishops' sign-in page (17 Nov wording from the office).
    const signup = `${config.origin.replace(/drogs\.dagministry\.org/, 'kuriakecastle.org')}/orderofbishopsingoodstanding/signup/`;
    const link = unregistered ? signup : `${signup}#signin`;
    const who = `${pastor.title || 'Pastor'} ${pastor.name}`.trim();
    const where = [pastor.city, pastor.country].filter(Boolean).join(', ');
    const dear = `${bishopTitle} ${String(bishopName).trim().split(/\s+/)[0] || ''}`.trim();
    const button = unregistered ? 'Register to Review Request' : 'Sign In to Review Request';
    const intro = `${who}${where ? `, based in ${where},` : ''} has registered on Kuriake Castle and identified you as their supervising bishop.`;
    const ask = unregistered ? 'Please register as a bishop on Kuriake Castle to review and confirm whether this pastor is under your oversight.' : 'Please sign in to your Kuriake Castle account to review and confirm whether this pastor is under your oversight.';
    const choose = 'If you recognise this pastor, select Confirm Pastor. If the pastor is not under your oversight, select Not My Pastor.';
    await mailer.sendMail(brandedMail({ from: config.from, to: address, subject: `${who} has registered under you`,
      text: `Dear ${dear},\n\n${intro}\n\n${ask}\n\n${button}: ${link}\n\n${choose}\n\nThank you for helping us maintain accurate pastoral records.\n\nKuriake Castle`,
      html: `<p style="margin:0 0 12px">Dear ${esc(dear)},</p><p style="margin:0 0 12px"><b>${esc(who)}</b>${where ? `, based in ${esc(where)},` : ''} has registered on Kuriake Castle and identified you as their supervising bishop.</p><p style="margin:0 0 18px">${esc(ask)}</p><p style="margin:0 0 18px"><a href="${link}" style="background:#13324c;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">${button} →</a></p><p style="margin:0 0 12px">If you recognise this pastor, select <b>Confirm Pastor</b>. If the pastor is not under your oversight, select <b>Not My Pastor</b>.</p><p style="margin:0 0 12px">Thank you for helping us maintain accurate pastoral records.</p><p style="margin:0">Kuriake Castle</p>` }));
  }

  // A pastor's bishop with their own title (office, 19 Nov): Mother, Episcopal Sister or Bishop.
  function titledBishop(state, r) {
    const bishop = bishopKeyed(state, r.data.bishopId);
    const reg = bishop && state.registrations.find(x => x.userId === bishop.id && x.year === state.year);
    const ref = people.find(p => p.id === (bishop?.referenceId || r.data.bishopId) && p.role === 'bishop');
    const name = canonicalPersonName(ref?.id, ref?.name || reg?.data?.name || bishop?.name || r.data.bishopName || '');
    const title = ref?.title || (reg?.data ? titleFor(reg.data) : 'Bishop');
    return name ? `${title} ${name}` : '';
  }
  // "You are now in good standing" (office, 19 Nov). Pastors: once confirmed by their
  // bishop and their payment is confirmed, whichever comes last. Bishops: only when
  // they paid by receipt and the office has confirmed it (Paystack is instant).
  function standingMail(state, r, to) {
    const esc = v => String(v || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const site = config.origin.replace(/drogs\.dagministry\.org/, 'kuriakecastle.org');
    const pastor = r.data.role !== 'bishop';
    const link = `${site}/${pastor ? 'orderofpastorsingoodstanding' : 'orderofbishopsingoodstanding'}/signup/#signin`;
    const dear = `${titleFor(r.data)} ${String(r.data.name || '').trim().split(/\s+/)[0] || ''}`.trim();
    const bishop = pastor ? titledBishop(state, r) : '';
    const first = pastor
      ? `${bishop || 'Your bishop'} has confirmed you${r.paymentMethod === 'paystack' ? '' : ', and the office has confirmed your payment'}.`
      : 'The office has checked your receipt and confirmed your payment.';
    const second = `You are now in good standing for ${state.year} and appear on the Roll of Good Standing.`;
    return brandedMail({ from: config.from, to, subject: `You are now in good standing for ${state.year}`,
      text: `Dear ${dear},\n\n${first}\n\n${second}\n\nView my profile: ${link}\n\nThank you for your commitment.\n\nKuriake Castle`,
      html: `<p style="margin:0 0 12px">Dear ${esc(dear)},</p><p style="margin:0 0 12px">${esc(first)}</p><p style="margin:0 0 18px;padding:12px 14px;background:#ecf7ef;border:1px solid #9fd3ad;border-radius:8px;color:#14532d"><b>${esc(second)}</b></p><p style="margin:0 0 18px"><a href="${link}" style="background:#13324c;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">View my profile →</a></p><p style="margin:0 0 12px">Thank you for your commitment.</p><p style="margin:0">Kuriake Castle</p>` });
  }
  // Who has just come into good standing and should be told (once a year each).
  function newlyStanding(before, after) {
    const was = new Map(before.registrations.filter(r => r.year === before.year).map(r => [r.userId, r]));
    return after.registrations.filter(r => r.year === after.year && !r.standingMailAt && inGoodStanding(r) && !inGoodStanding(was.get(r.userId))
      && (r.data.role !== 'bishop' || (r.paymentMethod && r.paymentMethod !== 'paystack' && r.proof)));
  }
  async function tellStanding(state, list) {
    for (const r of list) {
      try {
        const [[u]] = await pool.execute('SELECT email FROM dr_users WHERE id=?', [r.userId]);
        const to = u?.email || r.data.email;
        if (to) await mailer.sendMail(standingMail(state, r, to));
      } catch (error) { logger.error?.('good-standing email failed:', error?.message || error); }
    }
  }
  handle.standingMail = standingMail;

  // The bishop's two-week deadline (office, 19 Nov). Run once a day by the server:
  // after one week the waiting pastor is reminded to speak to their bishop; when
  // the two weeks pass, their registration and account are removed and they are told.
  const longDay = iso => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  function deadlineMail(kind, { to, name, title, bishop, deadline }) {
    const esc = v => String(v || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const site = config.origin.replace(/drogs\.dagministry\.org/, 'kuriakecastle.org');
    const signin = `${site}/orderofpastorsingoodstanding/signup/#signin`, signup = `${site}/orderofpastorsingoodstanding/signup/`;
    const dear = `${title || 'Pastor'} ${String(name || '').trim().split(/\s+/)[0] || ''}`.trim();
    const byBishop = bishop ? `your bishop, ${bishop},` : 'your bishop';
    const button = (href, label) => `<p style="margin:0 0 18px"><a href="${href}" style="background:#13324c;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">${label} →</a></p>`;
    if (kind === 'reminder') {
      const lines = [`Your registration on Kuriake Castle is still waiting for ${byBishop} to confirm you.`,
        `Your bishop must confirm you by ${longDay(deadline)}. If you are not confirmed by then, your registration and account will be removed.`,
        'Please speak to your bishop and ask them to sign in to Kuriake Castle and confirm you. If you named the wrong bishop, sign in and change your bishop on your profile.'];
      return brandedMail({ from: config.from, to, subject: `Reminder: your bishop must confirm you by ${longDay(deadline)}`,
        text: `Dear ${dear},\n\n${lines.join('\n\n')}\n\nView my registration: ${signin}\n\nKuriake Castle`,
        html: `<p style="margin:0 0 12px">Dear ${esc(dear)},</p><p style="margin:0 0 12px">${esc(lines[0])}</p><p style="margin:0 0 12px;padding:12px 14px;background:#fff7e6;border:1px solid #f1c56b;border-radius:8px;color:#5c3d00"><b>Your bishop must confirm you by ${esc(longDay(deadline))}.</b> If you are not confirmed by then, your registration and account will be removed.</p><p style="margin:0 0 18px">${esc(lines[2])}</p>${button(signin, 'View my registration')}<p style="margin:0">Kuriake Castle</p>` });
    }
    const lines = [`Your registration on Kuriake Castle was not confirmed by ${byBishop} within two weeks, so your registration and account have been removed.`,
      'If you are still a pastor under this bishop, or under another bishop, please speak to them first and then create a new account and register again.'];
    return brandedMail({ from: config.from, to, subject: 'Your Kuriake Castle account has been removed',
      text: `Dear ${dear},\n\n${lines.join('\n\n')}\n\nRegister again: ${signup}\n\nIf you think this is a mistake, please contact the office.\n\nKuriake Castle`,
      html: `<p style="margin:0 0 12px">Dear ${esc(dear)},</p><p style="margin:0 0 12px">${esc(lines[0])}</p><p style="margin:0 0 18px">${esc(lines[1])}</p>${button(signup, 'Register again')}<p style="margin:0 0 12px">If you think this is a mistake, please contact the office.</p><p style="margin:0">Kuriake Castle</p>` });
  }
  async function sweepDeadlines(now = Date.now()) {
    const state = await transaction(pool, conn => readState(conn, true));
    const { remind, expire } = claimDeadlines(state, now);
    const emailOf = async id => { const [[u]] = await pool.execute('SELECT email FROM dr_users WHERE id=?', [id]); return u?.email || ''; };
    const who = r => ({ name: r.data.name, title: titleFor(r.data), bishop: titledBishop(state, r), deadline: claimDeadline(r) });
    let reminded = 0, removed = 0;
    for (const r of remind) {
      const to = await emailOf(r.userId);
      try { if (to) await mailer.sendMail(deadlineMail('reminder', { to, ...who(r) })); }
      catch (error) { console.error('deadline reminder failed:', error?.message || error); continue; }
      await transaction(pool, async conn => { const before = await readState(conn, true); const after = structuredClone(before); const x = after.registrations.find(y => y.userId === r.userId && y.year === r.year); if (x && !x.claimReminderAt) { x.claimReminderAt = new Date(now).toISOString(); await persistState(conn, before, after); } });
      reminded++;
    }
    for (const r of expire) {
      const to = await emailOf(r.userId);
      // Still waiting at the moment of removal (a bishop may have just confirmed).
      const current = (await transaction(pool, conn => readState(conn, true))).registrations.find(y => y.userId === r.userId && y.year === r.year);
      if (current?.status !== 'unclaimed') continue;
      await removeAccounts(pool, config, { id: '' }, { user: r.userId });
      try { if (to) await mailer.sendMail(deadlineMail('removed', { to, ...who(r) })); } catch (error) { console.error('removal email failed:', error?.message || error); }
      removed++;
    }
    if (reminded || removed) console.log(`Bishop deadline: ${reminded} reminded, ${removed} removed`);
    return { reminded, removed };
  }
  handle.sweepDeadlines = sweepDeadlines;
  handle.autoPhotos = autoPhoto;
  handle.deadlineMail = deadlineMail;

  // The Order of Bishops / Pastors pages and Councils (office, 17 Nov). Step 1: the
  // Order pages password (a signed cookie, 12 hours; changing the password ends
  // them). Step 2: signed in. Step 3: in good standing this year (or the office).
  // With no password saved the pages stay open, as before.
  const ORDER_COOKIE = 'kc_order', ORDER_MS = 12 * 3600000;
  const orderSig = exp => digest(config.secret, `order:${exp}:${digest(config.secret, `order-code:${config.orderCode}`)}`);
  const orderCookie = request => (request.headers.get('cookie') || '').split(';').map(c => c.trim()).find(c => c.startsWith(`${ORDER_COOKIE}=`))?.slice(ORDER_COOKIE.length + 1) || '';
  function orderPassed(request) {
    const [exp, sig] = orderCookie(request).split('.');
    if (!exp || !sig || Number(exp) <= Date.now()) return false;
    const a = Buffer.from(sig), b = Buffer.from(orderSig(exp));
    return a.length === b.length && timingSafeEqual(a, b);
  }
  async function orderAccess(request) {
    await applySettings(config, pool);
    if (!config.orderCode) return { step: 'ok', open: true };
    if (!orderPassed(request)) return { step: 'code' };
    const who = await auth.actor(request);
    if (!who) return { step: 'signin' };
    if (who.office) return { step: 'ok' };
    const [[row]] = await pool.execute('SELECT r.data FROM dr_registrations r JOIN dr_settings s ON s.id=1 AND r.registration_year=s.current_year WHERE r.user_id=?', [who.id]);
    const reg = row ? (typeof row.data === 'string' ? JSON.parse(row.data) : row.data) : null;
    if (inGoodStanding(reg)) return { step: 'ok' };
    return { step: 'standing', status: reg?.status === 'confirmed' ? 'payment' : reg?.status || 'none', role: reg?.data?.role || '' };
  }
  handle.orderAccess = orderAccess;
  return handle;
  async function handle(request) {
    try {
      const url = new URL(request.url), path = url.pathname.replace(/\/$/, ''), method = request.method;
      await applySettings(config, pool);
      if (path.startsWith('/api/v1/')) {
        const managed = await management(request);
        return managed || json(await keys.read(request));
      }
      if (!['GET', 'POST'].includes(method)) throw new HttpError(405, 'Method not allowed.');
      if (method === 'POST' && request.headers.get('origin') !== url.origin)
        throw new HttpError(403, 'Open the form on the configured website before continuing.');
      if (request.headers.get('sec-fetch-site') === 'cross-site') throw new HttpError(403, 'Cross-site requests are not allowed.');
      if (path === '/api/registration/order-access' && method === 'GET') return json(await orderAccess(request));
      if (path === '/api/registration/auth/order-code' && method === 'POST') {
        const { code } = await jsonBody(request);
        await rateLimit(pool, config, `order-code:${request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'all'}`, 20, 600000);
        if (!config.orderCode) return json({ ok: true, open: true });
        const a = Buffer.from(digest(config.secret, `order-try:${String(code || '')}`)), b = Buffer.from(digest(config.secret, `order-try:${config.orderCode}`));
        if (typeof code !== 'string' || !timingSafeEqual(a, b)) throw new HttpError(401, 'That password is not correct.');
        const exp = String(Date.now() + ORDER_MS);
        return json({ ok: true }, 200, { 'Set-Cookie': `${ORDER_COOKIE}=${exp}.${orderSig(exp)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${ORDER_MS / 1000}${config.secure ? '; Secure' : ''}` });
      }
      if (path === '/api/registration/auth/office-code' && method === 'POST') {
        const session = await auth.officeSignIn((await jsonBody(request)).code);
        await auth.signOut(request);
        return json({ ok: true, actor: session.actor }, 200, { 'Set-Cookie': sessionCookie(config, session.token, session.maxAge, true) });
      }
      // Members: email and password (17 Nov). The emailed code is only for a reset.
      if (path === '/api/registration/auth/signup' && method === 'POST') {
        const { email, password, entrance, remember } = await jsonBody(request);
        const address = emailAddress(email);
        const pause = pauseFor(await transaction(pool, conn => readState(conn)), entrance);
        if (pause.closed) throw new HttpError(403, pause.notice || SIGNUP_PAUSED);
        const session = await auth.signupWithPassword(address, password, remember === true);
        await auth.signOut(request);
        return json(session.actor, 200, { 'Set-Cookie': sessionCookie(config, session.token, session.maxAge, false) });
      }
      if (path === '/api/registration/auth/login' && method === 'POST') {
        const { email, password, remember } = await jsonBody(request);
        const session = await auth.loginWithPassword(emailAddress(email), password, remember === true);
        await auth.signOut(request);
        return json(session.actor, 200, { 'Set-Cookie': sessionCookie(config, session.token, session.maxAge, false) });
      }
      if (path === '/api/registration/auth/reset' && method === 'POST') {
        const { email, token, password, remember } = await jsonBody(request);
        const session = await auth.resetPassword(emailAddress(email), token, password, remember === true);
        await auth.signOut(request);
        return json(session.actor, 200, { 'Set-Cookie': sessionCookie(config, session.token, session.maxAge, false) });
      }
      if (path === '/api/registration/auth/request' && method === 'POST') {
        const { email, mode, entrance, church } = await jsonBody(request);
        const address = emailAddress(email);
        if (!['signin', 'office', 'reset'].includes(mode)) {
          // Paused sign-up turns new people away at the first step; existing accounts still sign in.
          const [[known]] = await pool.execute('SELECT 1 FROM dr_users WHERE email=?', [address]);
          if (!known) {
            const pause = pauseFor(await transaction(pool, conn => readState(conn)), entrance);
            if (pause.closed) throw new HttpError(403, pause.notice || SIGNUP_PAUSED);
          }
        }
        // A church site's code email carries the church's name and its own address;
        // the bishops' sign-up (fellowship.mjs) carries its own name and never the castle's.
        const fellowship = mode !== 'office' && typeof church === 'string' ? fellowshipByPath(church) : null;
        const site = fellowship || (mode !== 'office' && typeof church === 'string' ? denominationSite(church) : null);
        await auth.requestCode(address, fellowship ? `${url.origin}${fellowship.signup}` : site ? `${url.origin}/${church}/signup/` : url.origin, ['signin', 'office', 'reset'].includes(mode) ? mode : 'signup', site?.name, Boolean(fellowship));
        return json({ ok: true, codeRequired: true });
      }
      if (path === '/api/registration/references' && method === 'GET') {
        // Only the contact-free published sheet data, never the server's
        // contact-enriched matching records. No account is needed to read it.
        return json({ rosterVersion, referencePeople }, 200, url.searchParams.get('version') === rosterVersion ? { 'Cache-Control': 'public, max-age=31536000, immutable' } : {});
      }
      if (path === '/api/registration/public-directory' && method === 'GET') {
        // Open to everyone: the roll carries no contact details. Cached briefly and
        // rate limited so the public page cannot be used to hammer the database.
        await rateLimit(pool, config, `public-directory:${request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'all'}`, 120, 60000);
        if (!publicCache.value || Date.now() - publicCache.at > 30000) {
          const state = await transaction(pool, conn => readState(conn));
          // Aggregate totals use the same saved state as the office Photo tasks
          // tab, including draft uploads. Individual review lists stay private.
          const progress = photoProgress(state, people);
          const { missingIds, replaceIds, ...photoTotals } = progress;
          publicCache = { at: Date.now(), value: { rosterVersion, source: config.publicDirectory, photos: config.publicPhotos, photoProgress: photoTotals, photoGroups: photoProgressGroups(state, people, progress), roll: publicRoll(state, people), ...publicOverlay(state) } };
        }
        return json(publicCache.value, 200, { 'Cache-Control': 'public, max-age=30' });
      }
      if (path === '/api/registration/auth/verify' && method === 'POST') {
        const { email, token, mode, remember } = await jsonBody(request);
        const session = await auth.verifyCode(emailAddress(email), token, ['signin', 'office'].includes(mode) ? mode : 'signup', remember === true);
        await auth.signOut(request);
        return json(session.actor, 200, { 'Set-Cookie': sessionCookie(config, session.token, session.maxAge, mode === 'office') });
      }
      if (path === '/api/registration/auth/signout' && method === 'POST') {
        await auth.signOut(request);
        return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(config, '', 0, officeDoor(request)) });
      }
      // "Contact the office" from the sign-in pages (17 Nov): someone who cannot sign
      // in (no reset code, locked) can still reach the office. They give an email.
      if (path === '/api/registration/support-public' && method === 'POST') {
        const body = await jsonBody(request);
        const contact = emailAddress(body?.contact);
        await rateLimit(pool, config, `support-public:${contact}`, 5, 600000);
        await rateLimit(pool, config, `support-public:${request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'all'}`, 10, 600000);
        return json(await support({ id: 'not signed in', email: contact, office: false }, { ...body, contact }));
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
      // The office changes someone's sign-in email (e.g. they mistyped it at sign-up).
      if (path === '/api/registration/accounts/email' && method === 'POST') {
        if (!actor.office) throw new HttpError(403, 'Office access required.');
        const { user, email } = await jsonBody(request);
        const done = await changeAccountEmail(pool, config, user, email);
        publicCache.at = 0;
        return json({ ok: true, ...done });
      }
      // A member changes their own sign-in email: password, then a code sent to the new address.
      if (path === '/api/registration/account/email-request' && method === 'POST') {
        const { email, password } = await jsonBody(request);
        const next = emailAddress(email);
        await rateLimit(pool, config, `email-change:${actor.id}`, 5, 3600000);
        const [[pw]] = await pool.execute('SELECT password_hash FROM dr_passwords WHERE user_id=?', [actor.id]);
        if (pw && !(await checkPassword(String(password || ''), pw.password_hash))) throw new HttpError(401, 'Your current password is not correct.');
        if (next === actor.email) throw new HttpError(400, 'That is already your email address.');
        const [[taken]] = await pool.execute('SELECT id FROM dr_users WHERE email=?', [next]);
        if (taken) throw new HttpError(409, 'That email address is already used by another account.');
        const key = `chg:${digest(config.secret, `email-change:${actor.id}:${next}`).slice(0, 40)}`, token = String(randomInt(0, 1000000)).padStart(6, '0');
        await pool.execute('INSERT INTO dr_otp (email,code_hash,expires_at,attempts) VALUES (?,?,?,0) ON DUPLICATE KEY UPDATE code_hash=VALUES(code_hash),expires_at=VALUES(expires_at),attempts=0', [key, digest(config.secret, `otp:${key}:${token}`), Date.now() + 600000]);
        try {
          await mailer.sendMail(brandedMail({ from: config.from, to: next, subject: 'Confirm your new Kuriake Castle email',
            text: `Your code to confirm this email address for your Kuriake Castle account is ${token}. It expires in 10 minutes.\n\nIf you did not ask to change your email, you can ignore this message.`,
            html: `<p style="margin:0 0 6px;color:#6a7283">Your code to confirm this email address</p><p style="margin:0 0 18px;font:700 36px/1 -apple-system,Arial,sans-serif;letter-spacing:6px;color:#13324c">${token}</p><p style="margin:0 0 12px">It expires in 10 minutes. Enter it on your Kuriake Castle profile.</p><p style="margin:0;color:#6a7283;font-size:13px">If you did not ask to change your email, you can ignore this message.</p>` }));
        } catch (error) { throw new HttpError(503, `The code could not be sent to that address. Check it is typed correctly, or contact the office. (${String(error?.message || '').slice(0, 120)})`); }
        return json({ ok: true });
      }
      if (path === '/api/registration/account/email-confirm' && method === 'POST') {
        const { email, token } = await jsonBody(request);
        const next = emailAddress(email);
        const key = `chg:${digest(config.secret, `email-change:${actor.id}:${next}`).slice(0, 40)}`;
        const [[otp]] = await pool.execute('SELECT * FROM dr_otp WHERE email=?', [key]);
        if (!otp || Number(otp.expires_at) <= Date.now()) throw new HttpError(401, 'That code has expired. Please send a new code.');
        if (otp.attempts >= 3) throw new HttpError(429, 'That code was entered incorrectly 3 times. Please send a new code, or contact the office.');
        const a = Buffer.from(otp.code_hash, 'hex'), b = Buffer.from(digest(config.secret, `otp:${key}:${String(token || '')}`), 'hex');
        if (a.length !== b.length || !timingSafeEqual(a, b)) { await pool.execute('UPDATE dr_otp SET attempts=attempts+1 WHERE email=?', [key]); throw new HttpError(401, 'That code is not correct. Please check the email and try again.'); }
        await pool.execute('DELETE FROM dr_otp WHERE email=?', [key]);
        const done = await changeAccountEmail(pool, config, actor.id, next);
        publicCache.at = 0;
        return json({ ok: true, ...done });
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
        const values = (await jsonBody(request)).values;
        await writeSettings(pool, values, actor, config);
        await applySettings(config, pool);
        if (values?.GEMINI_API_KEY?.trim()) autoPhoto.queue(); // a new Gemini key: photos waiting are edited straight away
        return json({ settings: describeSettings(await readSettings(pool)), admins: officeMembers(config) });
      }
      if (path === '/api/registration/settings/email-test' && method === 'POST') {
        // The office sees exactly why sign-in codes cannot be sent (the provider's own words).
        if (!actor.office) throw new HttpError(403, 'Office access required.');
        try {
          await mailer.sendMail({ from: config.from, to: actor.email, subject: 'Kuriake Castle test email', text: `Email sending works. Sent at ${new Date().toISOString()}.` });
        } catch (error) {
          throw new HttpError(400, `The email service refused: ${String(error?.response || error?.message || error).slice(0, 300)}. From address in use: ${config.from || '(none)'}`);
        }
        return json({ ok: true, to: actor.email, from: config.from });
      }
      if (path === '/api/registration/settings/gemini-test' && method === 'POST') {
        // The office sees Google's own answer, and how the automatic photos are going.
        if (!actor.office) throw new HttpError(403, 'Office access required.');
        await applySettings(config, pool);
        const state = await transaction(pool, conn => readState(conn));
        const mine = state.registrations.filter(r => r.year === state.year);
        const counts = { edited: mine.filter(r => r.autoPhoto).length, notEdited: mine.filter(r => r.autoPhotoNote).length, failed: mine.filter(r => r.autoPhotoError).length, lastError: mine.map(r => r.autoPhotoError).filter(Boolean).at(-1) || '' };
        try { await testGeminiKey({ fetcher, key: config.geminiKey }); }
        catch (error) { throw new HttpError(400, `Google refused: ${String(error?.message || error).replace(/^Gemini \d+: /, '').slice(0, 300)} · Photos so far: ${counts.edited} edited, ${counts.failed} failed${counts.lastError ? ` (last problem: ${counts.lastError})` : ''}.`); }
        autoPhoto.queue();
        return json({ ok: true, ...counts });
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
        return json({ ...view, rosterVersion, ...(actor.office ? { photoProgress: photoProgress(state, people) } : {}), office: actor.office, payment: config.momo, paystackKey: config.paystackPublic, publicDirectory: config.publicDirectory, publicPhotos: config.publicPhotos });
      }
      if (path === '/api/registration/communication/send' && method === 'POST') {
        // A broadcast from the office to everyone, all bishops, all pastors, or chosen people.
        if (!actor.office) throw new HttpError(403, 'Office access required.');
        if (!mailer) throw new HttpError(503, 'Email is not set up yet. Add the Resend key in Settings first.');
        const { subject, message, audience = 'all', ids = [] } = await jsonBody(request);
        const subj = String(subject || '').trim().slice(0, 200), text = String(message || '').trim();
        if (!subj || !text) throw new HttpError(400, 'Enter a subject and a message.');
        if (!BROADCAST_AUDIENCES.includes(audience)) throw new HttpError(400, 'Choose who should receive it.');
        await rateLimit(pool, config, `broadcast:${actor.id}`, 20, 3600000);
        const state = await transaction(pool, conn => readState(conn));
        const targets = broadcastRecipients(state, audience, Array.isArray(ids) ? ids.map(String) : [], people);
        if (!targets.length) throw new HttpError(400, 'Nobody matches that audience yet.');
        // Each person gets their own email. Big audiences (the original data runs to
        // thousands) are delivered in the background so the request returns at once;
        // the audit entry is written when delivery finishes either way.
        const deliver = async () => {
          let sent = 0; const failed = [];
          for (const t of targets) {
            try { await mailer.sendMail(brandedMail({ from: config.from, to: t.email, subject: subj, text: `Dear ${t.name.split(' ')[0]},\n\n${text}\n\nKuriake Castle Office` })); sent++; }
            catch (error) { failed.push(t.email); logger.error('broadcast failed for', t.email, error.message); }
          }
          await transaction(pool, async conn => {
            const before = await readState(conn, true);
            await persistState(conn, before, applyAction(before, actor, 'broadcast', { subject: subj, audience, recipients: sent, failed: failed.length }, undefined, people));
          }).catch(error => logger.error('broadcast audit failed', error.message));
          return { sent, failed };
        };
        if (targets.length > 50) { deliver().catch(error => logger.error('broadcast failed', error.message)); return json({ queued: targets.length }); }
        return json(await deliver());
      }
      if (path === '/api/registration/action' && method === 'POST') {
        await rateLimit(pool, config, `action:${actor.id}`, 120, 60000);
        const { name, payload = {} } = await jsonBody(request);
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new HttpError(400, 'Invalid action data.');
        if (name === 'recordPaystack') throw new HttpError(400, 'Payments are recorded after Paystack confirms them.');
        // Read the receipt before taking the global state lock: OCR can take a
        // few seconds, and must not block unrelated registrations.
        if (name === 'payment') {
          await assertOwnedMedia(pool, actor, payload.proof, 'receipt');
          payload.receiptCheck = await storage.receiptReport(payload.proof);
        }
        let reviewed = null, newPastor = null, standing = [], standingState = null;
        await transaction(pool, async conn => {
          const before = await readState(conn, true);
          if (['save', 'submit', 'update'].includes(name) && payload.photo && !assignedPortrait(before, actor, payload.photo)) await assertOwnedMedia(conn, actor, payload.photo, 'portrait');
          if (name === 'payment') {
            await assertOwnedMedia(conn, actor, payload.proof, 'receipt');
          }
          if (name === 'submit' && !inGhana(payload.country)) {
            const registration = before.registrations.find(r => r.userId === actor.id && r.year === before.year);
            if (!paymentReady(registration)) throw new HttpError(400, 'Upload and submit your payment receipt before continuing.');
          }
          if (name === 'approveBishop' && payload.referenceId && !references.some(r => r.id === payload.referenceId))
            throw new HttpError(400, 'Choose a listed bishop reference.');
          let after;
          try { after = applyAction(before, actor, name, payload, undefined, people); }
          catch (error) { throw new HttpError(400, error.message); }
          standing = newlyStanding(before, after);
          for (const r of standing) r.standingMailAt = new Date().toISOString();
          standingState = after;
          await persistState(conn, before, after);
          if (name === 'reviewBishop') reviewed = after.registrations.find(r => r.userId === payload.userId && r.year === after.year);
          // A pastor who has just registered under a registered bishop: that bishop is told (17 Nov).
          // ... or has just changed to a different bishop on their profile.
          const was = before.registrations.find(x => x.userId === actor.id && x.year === before.year);
          if (name === 'submit' || (name === 'update' && was?.data?.bishopId !== undefined)) {
            const r = after.registrations.find(x => x.userId === actor.id && x.year === after.year);
            const changed = name === 'submit' || (r?.data?.bishopId && r.data.bishopId !== was?.data?.bishopId);
            if (changed && r?.data?.role === 'pastor' && r.status === 'unclaimed' && r.data.bishopId) {
              const bishop = bishopKeyed(after, r.data.bishopId);
              const bishopReg = bishop && after.registrations.find(x => x.userId === bishop.id && x.year === after.year);
              // A bishop on our list who has not registered yet is emailed at the address we hold for them.
              const listed = !bishop && people.find(p => p.id === r.data.bishopId && p.role === 'bishop');
              const listedRef = people.find(p => p.id === (bishop?.referenceId || r.data.bishopId) && p.role === 'bishop');
              if (bishop) newPastor = { pastor: r.data, to: bishopReg?.data?.email || bishop.email || '', bishopName: canonicalPersonName(listedRef?.id, listedRef?.name || bishopReg?.data?.name || bishop.name || ''), bishopTitle: listedRef?.title || (bishopReg?.data ? titleFor(bishopReg.data) : 'Bishop'), bishopUser: bishop.id };
              else if (listed?.email) newPastor = { pastor: r.data, to: listed.email, bishopName: canonicalPersonName(listed.id, listed.name), bishopTitle: listed.title || 'Bishop', bishopUser: '', unregistered: true };
            }
          }
        });
        if (newPastor) notifyBishop(newPastor).catch(error => logger.error?.('new-pastor email failed:', error?.message || error));
        if (standing.length) tellStanding(standingState, standing).catch(() => {});
        if (['submit', 'update', 'officeEdit', 'choosePhoto', 'approveBishop'].includes(name)) autoPhoto.queue(); // the photo is checked and edited in the background (19 Nov)
        publicCache.at = 0; // office edits and pauses show on the public page at once
        // The office's decision goes to the address the bishop registered with; a mail failure must not undo the decision.
        if (reviewed?.data?.email) {
          const resubmit = payload.decision === 'resubmit';
          const role = reviewed.data.role === 'bishop' ? 'Bishop' : 'Pastor';
          const esc = v => String(v).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
          const reasons = String(payload.note).split('\n').map(l => l.replace(/^•\s*/, '').trim()).filter(Boolean);
          const photoIssue = reasons.some(r => /photo/i.test(r));
          const others = reasons.filter(r => !/photo/i.test(r));
          const requirements = [reviewed.data.gender === 'female' ? `Official attire as shown (${reviewed.data.organization === 'United Denominations' ? 'United Denominations' : 'First Love'})` : role === 'Bishop' ? 'Red jacket' : reviewed.data.title === 'Rev.' ? 'Dark jacket or suit with a clerical collar' : 'Dark suit and tie', 'Face fully visible', 'Plain white background'];
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
        return json({ path: key, ...(url.searchParams.get('kind') === 'receipt' ? { receiptCheck: await storage.receiptReport(key) } : {}) }, 201);
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
          return new Response(bytes, { status: 200, headers: { 'Content-Type': media.content_type, 'Cache-Control': 'private, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } }); // every upload has its own key
        }
        return json({ url: await storage.url(key) });
      }
      if (path === '/api/registration/paystack/quote' && method === 'POST') {
        if (!config.paystack) throw new HttpError(503, 'Card and mobile-money payments are not switched on yet.');
        await rateLimit(pool, config, `paystack-quote:${actor.id}`, 60, 600000);
        const { role } = await jsonBody(request);
        if (!['bishop', 'pastor'].includes(role)) throw new HttpError(400, 'Choose bishop or pastor before paying.');
        const state = await transaction(pool, conn => readState(conn));
        if (!paymentRate.value || Date.now() - paymentRate.at > 5 * 60000) {
          const rates = await paymentJson(fetcher, 'https://open.er-api.com/v6/latest/USD');
          const value = Number(rates?.rates?.GHS);
          if (rates.result !== 'success' || !Number.isFinite(value) || value <= 0) throw new HttpError(503, 'Today’s cedi exchange rate is unavailable. Please try again shortly.');
          paymentRate = { at: Date.now(), value };
        }
        const quote = createQuote({ actor, role, year: state.year, usd: feesOf(state)[role], rate: paymentRate.value, secret: config.secret });
        return json({ token: quote.token, amount: quote.amount, currency: quote.currency, usd: quote.usd, expiresAt: quote.expiresAt });
      }
      if (path === '/api/registration/paystack/initialize' && method === 'POST') {
        if (!config.paystack) throw new HttpError(503, 'Card and mobile-money payments are not switched on yet.');
        await rateLimit(pool, config, `paystack-initialize:${actor.id}`, 20, 600000);
        const { token, returnUrl } = await jsonBody(request);
        const callback = checkoutReturnUrl(returnUrl, url.origin);
        // Freeze the signed amount before contacting Paystack. Network requests
        // never run inside the state lock. A later rate change cannot alter it.
        const reference = `KC-${randomUUID()}`;
        const quote = await transaction(pool, async conn => {
          const before = await readState(conn, true), after = structuredClone(before);
          const r = after.registrations.find(r => r.userId === actor.id && r.year === after.year);
          if (!r || r.status === 'denied') throw new HttpError(400, 'Save your registration before paying.');
          if (r.payment === 'verified') throw new HttpError(409, 'Your payment is already verified. Refresh your profile.');
          const q = readQuote(token, { actor, registration: r, year: after.year, secret: config.secret });
          r.paystackQuotes = [...(r.paystackQuotes || []), { ...q, reference }].slice(-50);
          await persistState(conn, before, after);
          return q;
        });
        const result = await paymentJson(fetcher, 'https://api.paystack.co/transaction/initialize', {
          method: 'POST', headers: { Authorization: `Bearer ${config.paystack}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: actor.email, amount: quote.amount, currency: 'GHS', reference, callback_url: callback,
            channels: ['card', 'mobile_money', 'bank', 'bank_transfer'],
            metadata: { registrationUser: actor.id, registrationYear: quote.year, quoteReference: reference,
              custom_fields: [{ display_name: 'Kuriake Castle', variable_name: 'registration', value: `${quote.year} ${quote.role}` }] } }),
        });
        const checkout = result?.data;
        if (!result.status || checkout?.reference !== reference || !/^https:\/\/checkout\.paystack\.com\/[A-Za-z0-9_-]+$/.test(checkout?.authorization_url || ''))
          throw new HttpError(503, 'The secure payment page could not open. Please try again shortly.');
        return json({ reference, url: checkout.authorization_url, amount: quote.amount, currency: quote.currency });
      }
      if (path === '/api/registration/paystack/verify' && method === 'POST') {
        if (!config.paystack) throw new HttpError(503, 'Card and mobile-money payments are not switched on yet.');
        await rateLimit(pool, config, `paystack:${actor.id}`, 20, 600000);
        const { reference } = await jsonBody(request);
        if (typeof reference !== 'string' || !/^[A-Za-z0-9._=-]{6,100}$/.test(reference)) throw new HttpError(400, 'Invalid payment reference.');
        const result = await paymentJson(fetcher, `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${config.paystack}` } });
        const tx = result?.data;
        if (!result?.status || tx?.status !== 'success') throw new HttpError(400, 'This payment has not been confirmed yet.');
        // The payment has to belong to this person and this registration, not merely exist.
        if (String(tx.customer?.email || '').toLowerCase() !== actor.email.toLowerCase()) throw new HttpError(400, 'This payment was made under a different email address.');
        const metadata = typeof tx.metadata === 'string' ? JSON.parse(tx.metadata || '{}') : tx.metadata;
        const tag = (metadata?.custom_fields || []).find(f => f.variable_name === 'registration')?.value;
        const snapshot = await transaction(pool, conn => readState(conn));
        const saved = snapshot.registrations.find(r => r.userId === actor.id && r.year === snapshot.year);
        const storedQuote = saved?.paystackQuotes?.find(q => q.reference === reference);
        // Old Inline v1 payments can still be verified after deployment. New
        // hosted payments must match their frozen amount exactly, with no margin.
        if (!storedQuote && metadata?.quoteReference) throw new HttpError(400, 'This checkout does not belong to this registration.');
        const legacyMinimum = storedQuote ? null : await paystackMinimum(snapshot, actor, tx.currency, fetcher);
        await transaction(pool, async conn => {
          const before = await readState(conn, true);
          if (!String(tag || '').startsWith(`${before.year} `)) throw new HttpError(400, 'This payment is not for this year’s registration.');
          const current = before.registrations.find(r => r.userId === actor.id && r.year === before.year);
          if (current?.payment === 'verified' && current.paystackReference === reference) return;
          const quote = current?.paystackQuotes?.find(q => q.reference === reference);
          if (storedQuote && !quote) throw new HttpError(400, 'This checkout is no longer available. Contact the office.');
          if (quote) validateQuotedPayment(tx, quote, actor, before.year, reference);
          let after;
          try { after = applyAction(before, actor, 'recordPaystack', { reference, amount: tx.amount, currency: tx.currency, expectedMinor: quote?.amount ?? legacyMinimum }); }
          catch (error) { throw new HttpError(400, error.message); }
          await persistState(conn, before, after);
        });
        publicCache.at = 0;
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
