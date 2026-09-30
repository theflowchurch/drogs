import test from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { requestHandler } from '../../src/server/http.mjs';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import { S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import { migrate } from '../../src/server/database.mjs';
import { createAuth } from '../../src/server/auth.mjs';
import { createStorage } from '../../src/server/storage.mjs';
import { configuration } from '../../src/server/config.mjs';
import { createHash } from 'node:crypto';
import { createApi } from '../../src/server/api.mjs';

test('MySQL + private R2 transport: real persistence, authentication, scope, rollback and concurrent matching', { timeout: 180000 }, async () => {
  if (!process.env.TEST_MYSQL_PORT) throw Error('Set TEST_MYSQL_PORT for an isolated local MySQL/MariaDB test server.');
  const db = `drogs_test_${Date.now()}`;
  const options = { host: '127.0.0.1', port: Number(process.env.TEST_MYSQL_PORT), user: process.env.TEST_MYSQL_USER || 'root', password: process.env.TEST_MYSQL_PASSWORD || '' };
  const root = await mysql.createConnection(options);
  await root.query(`CREATE DATABASE ${db}`);
  const pool = mysql.createPool({ ...options, database: db, connectionLimit: 5 });
  const mediaDir = await mkdtemp(`${tmpdir()}/drogs-mysql-test-`);
  const mails = [], objects = new Map();
  let failStorage = false;
  const testEnv = { DB_HOST: 'localhost', DB_NAME: 'x', DB_USER: 'x', DB_PASSWORD: 'x', APP_URL: 'https://drogs.dagministry.org', SESSION_SECRET: 't'.repeat(64),
    ADMIN_EMAILS: 'office@example.com,browser-office@example.com', SITE_ACCESS_CODE: '1234', ADMIN_ACCESS_CODE: 'admin-test-code',
    SMTP_HOST: 'smtp.example.com', SMTP_USER: 'u', SMTP_PASSWORD: 'p', SMTP_FROM: 'no-reply@example.com', TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_CHAT_ID: '-100',
    R2_ACCOUNT_ID: 'a'.repeat(32), R2_BUCKET: 'test-private', R2_ACCESS_KEY_ID: 'test', R2_SECRET_ACCESS_KEY: 'test',
    BOOTSTRAP_TOKEN_SHA256: createHash('sha256').update('test-bootstrap-token').digest('hex') };
  const config = configuration(testEnv);
  const mailer = { sendMail: async mail => { mails.push(mail); await writeFile(`${mediaDir}/mail.json`, JSON.stringify(mails), { mode: 0o600 }); } };
  const auth = createAuth({ pool, config, mailer });
  const telegram = [];
  const client = new S3Client({ region: 'auto', endpoint: `https://${config.r2.account}.r2.cloudflarestorage.com`, credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    requestChecksumCalculation: 'WHEN_REQUIRED', requestHandler: { handle: async request => {
      if (failStorage) { const e = Error('The request signature we calculated does not match'); e.name = 'SignatureDoesNotMatch'; throw e; }
      if (request.method === 'PUT') {
        objects.set(request.path, request.body);
        await writeFile(`${mediaDir}/${Buffer.from(request.path).toString('hex')}`, request.body);
      }
      if (request.method === 'DELETE') objects.delete(request.path);
      return { response: { statusCode: 200, headers: {}, body: Readable.from([]) } };
    } } });
  const storage = createStorage({ pool, config, client });
  const api = createApi({ pool, config, auth, storage, mailer, fetcher: async (url, init) => { telegram.push({ url, body: init.body }); return { ok: true }; } });
  async function call(path, cookie = '', body, options = {}) {
    const response = await api(new Request(`${config.origin}/api/registration/${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { origin: config.origin, cookie, 'content-type': 'application/json', ...options.headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), ...options }));
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  async function login(email) {
    assert.equal((await call('auth/request', '', { email })).status, 200);
    const token = mails.at(-1).text.match(/code is (\d{6})/)[1];
    const result = await call('auth/verify', '', { email, token });
    assert.equal(result.status, 200);
    assert.equal((await call('auth/verify', '', { email, token })).status, 401, 'code cannot be reused');
    return result;
  }
  const image = await sharp({ create: { width: 60, height: 80, channels: 3, background: 'red' } }).png().toBuffer();
  async function upload(who, kind = 'portrait') {
    const result = await call(`upload?kind=${kind}`, who.cookie, undefined, { method: 'POST', headers: { origin: config.origin, cookie: who.cookie, 'content-type': 'image/png' }, body: image });
    assert.equal(result.status, 201, JSON.stringify(result.data));
    return result.data.path;
  }
  const profile = (photo, role = 'bishop') => ({ role, firstName: role === 'bishop' ? 'Test' : 'John', lastName: role === 'bishop' ? 'Bishop' : 'Doe', phone: '+233201234567', dob: '1990-01-01', country: 'Ghana', city: 'Accra', organization: 'First Love', denomination: 'First Love Church', photo, gender: 'male', photoConfirmed: true, consentedAt: '2026-09-29T08:00:00.000Z', bishopId: 'B1', bishopFirstName: 'Test', bishopLastName: 'Bishop' });
  try {
    await migrate(pool); await migrate(pool); // Idempotent, preserves existing records.
    assert.equal((await call('snapshot')).status, 401);
    assert.equal((await call('auth/access', '', { code: 'wrong', office: false })).status, 401);
    const visitorAccess = await call('auth/access', '', { code: '1234', office: false });
    assert.equal(visitorAccess.status, 200); assert.equal(visitorAccess.data.office, false);
    assert.equal((await call('auth/access', '', { code: 'admin-test-code', office: true })).status, 403, 'the office code alone no longer signs anyone in');
    assert.equal((await call('auth/office-code', '', { code: 'wrong' })).status, 401);
    assert.equal((await call('auth/office-code', '', { code: 'admin-test-code' })).status, 200);
    assert.equal((await call('auth/request', '', { email: 'stranger@example.com', mode: 'office' })).status, 403, 'unapproved emails are told they have no access');
    assert.equal((await call('auth/request', '', { email: 'office@example.com', mode: 'office' })).status, 200);
    const officeToken = mails.at(-1).text.match(/code is (\d{6})/)[1];
    assert.equal((await call('auth/verify', '', { email: 'office@example.com', token: '000000', mode: 'office' })).status, 401, 'the office always needs the emailed code');
    const officeAccess = await call('auth/verify', '', { email: 'office@example.com', token: officeToken, mode: 'office' });
    assert.equal(officeAccess.status, 200); assert.equal(officeAccess.data.office, true);
    const office = officeAccess, bishop = await login('bishop@example.com'), pastor = await login('pastor@example.com'), stranger = await login('stranger@example.com');
    assert.equal(office.data.office, true);
    assert.equal(bishop.data.office, false);
    const bishopPhoto = await upload(bishop), pastorPhoto = await upload(pastor);
    assert.equal(objects.size, 2);
    let r = await call('action', bishop.cookie, { name: 'submit', payload: { ...profile(bishopPhoto), office: true } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal((await call('action', bishop.cookie, { name: 'approveBishop', payload: { userId: bishop.data.id, office: true } })).status, 400);
    assert.equal((await call('action', office.cookie, { name: 'approveBishop', payload: { userId: bishop.data.id, referenceId: 'B1' } })).status, 200);
    assert.equal((await call('action', pastor.cookie, { name: 'save', payload: profile(bishopPhoto, 'pastor') })).status, 400, 'cannot save another account photo');
    assert.equal((await call('action', pastor.cookie, { name: 'save', payload: profile(pastorPhoto, 'pastor') })).status, 200);
    assert.equal((await call(`media?path=${pastorPhoto}`, bishop.cookie)).status, 403, 'draft stays private');
    assert.equal((await call('action', pastor.cookie, { name: 'submit', payload: profile(pastorPhoto, 'pastor') })).status, 200);
    assert.equal((await call(`media?path=${pastorPhoto}`, bishop.cookie)).status, 200);
    assert.equal((await call(`media?path=${pastorPhoto}`, stranger.cookie)).status, 403);
    const unclaimed = await call('snapshot', pastor.cookie);
    assert.equal(unclaimed.data.registrations[0].status, 'unclaimed');
    assert.equal((await call('action', bishop.cookie, { name: 'addRoster', payload: { rows: [{ name: 'Valid Person', dob: '01/01/1990' }, { name: '' }] } })).status, 400);
    assert.equal((await call('snapshot', bishop.cookie)).data.rosters.length, 0, 'failed bulk write rolled back');
    const concurrent = await Promise.all([1, 2].map(() => call('action', bishop.cookie, { name: 'addRoster', payload: { rows: [{ name: 'John Doe', dob: '01/01/1990' }] } })));
    assert.deepEqual(concurrent.map(r => r.status).sort(), [200, 200], 'a duplicate row is skipped, not an error');
    assert.equal((await call('snapshot', bishop.cookie)).data.rosters.length, 1, 'concurrent identical uploads leave one row');
    assert.equal((await call('snapshot', pastor.cookie)).data.registrations[0].status, 'confirmed');
    const receipt = await upload(pastor, 'receipt');
    assert.equal((await call('action', pastor.cookie, { name: 'payment', payload: { proof: receipt, nonrefundable: true, transactionId: 'TX-TEST-0001' } })).status, 200);
    assert.equal((await call(`media?path=${receipt}`, bishop.cookie)).status, 403);
    assert.equal((await call('snapshot', bishop.cookie)).data.registrations.find(r => r.userId === pastor.data.id).proof, undefined);
    const media = await call(`media?path=${receipt}`, office.cookie);
    assert.equal(media.status, 200);
    assert.match(media.data.url, /r2\.cloudflarestorage\.com/);
    assert.match(media.data.url, /X-Amz-Signature=/);
    const [[saved]] = await pool.query('SELECT photo_key,proof_key,data FROM dr_registrations WHERE user_id=?', [pastor.data.id]);
    assert.equal(saved.photo_key, pastorPhoto); assert.equal(saved.proof_key, receipt);
    assert.doesNotMatch(saved.photo_key, /^https:/, 'database stores permanent keys, not expiring URLs');
    assert.equal((await call('action', office.cookie, { name: 'reviewPayment', payload: { userId: pastor.data.id, result: 'verified' } })).status, 200);
    assert.equal((await call('action', office.cookie, { name: 'openYear', payload: { year: 2028 } })).status, 200);
    assert.equal((await call('snapshot', pastor.cookie)).data.registrations[0].payment, 'verified');
    assert.equal((await call('auth/signout', pastor.cookie, {})).status, 200);
    assert.equal((await call('snapshot', pastor.cookie)).status, 401);
    assert.equal((await call('auth/request', '', { email: 'locked@example.com' })).status, 200);
    const code = mails.at(-1).text.match(/code is (\d{6})/)[1];
    const wrong = code === '000000' ? '000001' : '000000';
    for (let i = 0; i < 5; i++) assert.equal((await call('auth/verify', '', { email: 'locked@example.com', token: wrong })).status, 401);
    assert.equal((await call('auth/verify', '', { email: 'locked@example.com', token: code })).status, 401, 'locked after five failures');
    assert.equal((await call('auth/request', '', { email: 'locked@example.com' })).status, 429);
    assert.equal((await call('accounts', bishop.cookie)).status, 403);
    assert.equal((await call('logins', bishop.cookie)).status, 403);
    assert.equal((await call('accounts')).status, 401);
    const accounts = await call('accounts?search=office%40example.com', office.cookie);
    assert.equal(accounts.status, 200);
    assert.equal(accounts.data.total, 1);
    assert.ok(accounts.data.data[0].signedUpAt);
    assert.ok(accounts.data.data[0].lastLoginAt);
    assert.equal(accounts.data.data[0].loginCount, 1, 'Failed code reuse must not count as a login');
    const logins = await call(`logins?user=${accounts.data.data[0].id}`, office.cookie);
    assert.equal(logins.data.data.length, 1);
    assert.equal(logins.data.data[0].email, 'office@example.com');
    assert.equal(JSON.stringify(logins.data).includes('token'), false);
    // Application API keys are a separate, read-only identity from admin cookies.
    assert.equal((await call('keys', bishop.cookie)).status, 403);
    assert.equal((await call('keys', bishop.cookie, { name: 'Forbidden', scopes: ['registrations:read'] })).status, 403);
    assert.equal((await call('keys', office.cookie, { name: 'Delete', scopes: ['registrations:delete'] })).status, 400);
    const issued = await call('keys', office.cookie, { name: 'Directory integration', scopes: ['registrations:read', 'rosters:read', 'photos:read'], days: 30 });
    assert.equal(issued.status, 201, JSON.stringify(issued.data));
    const apiToken = issued.data.token;
    assert.match(apiToken, /^drogs_live_[A-Za-z0-9_-]{43}$/);
    const [[storedKey]] = await pool.execute('SELECT token_hash FROM dr_api_keys WHERE id=?', [issued.data.key.id]);
    assert.notEqual(storedKey.token_hash, apiToken);
    const listedKeys = await call('keys', office.cookie);
    assert.equal(JSON.stringify(listedKeys.data).includes(apiToken), false);
    async function external(path, token = apiToken, method = 'GET') {
      const response = await api(new Request(`${config.origin}/api/v1/${path}`, { method, headers: { authorization: `Bearer ${token}` } }));
      return { status: response.status, data: await response.json() };
    }
    const page1 = await external('registrations?year=2027&limit=1');
    assert.equal(page1.status, 200); assert.equal(page1.data.data.length, 1); assert.ok(page1.data.nextCursor);
    const page2 = await external(`registrations?year=2027&limit=1&after=${page1.data.nextCursor}`);
    assert.notEqual(page1.data.data[0].userId, page2.data.data[0].userId);
    assert.equal(page1.data.data[0].dob, undefined);
    assert.equal(page1.data.data[0].proof, undefined);
    assert.equal((await external('rosters?year=2027')).data.data.length, 1);
    assert.equal((await external(`photos?path=${pastorPhoto}`)).status, 200);
    assert.equal((await external(`photos?path=${receipt}`)).status, 404);
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal((await external('registrations', apiToken, method)).status, 405);
    assert.equal((await external('registrations', 'invalid-key')).status, 401);
    assert.equal((await call('action', '', { name: 'openYear', payload: { year: 2029 } }, { headers: { origin: config.origin, authorization: `Bearer ${apiToken}`, 'content-type': 'application/json' } })).status, 401);
    const all = await call('keys', office.cookie, { name: 'Complete backend', scopes: ['backend:read'] });
    assert.equal(all.status, 201);
    const full = await external('backend/registrations', all.data.token);
    assert.equal(full.status, 200);
    assert.ok(full.data.data.some(r => r.proof === receipt), 'Full payment receipt reference included');
    for (const resource of ['rosters', 'profiles', 'users', 'history', 'media', 'keys', 'settings', 'reference', 'accounts', 'logins']) {
      const result = await external(`backend/${resource}`, all.data.token);
      assert.equal(result.status, 200, resource);
      assert.equal(JSON.stringify(result.data).includes(storedKey.token_hash), false);
      assert.equal(JSON.stringify(result.data).includes(all.data.token), false);
    }
    assert.equal((await external(`backend/media-url?path=${receipt}`, all.data.token)).status, 200);
    assert.equal((await external('backend/registrations', apiToken)).status, 403);
    assert.equal((await external('backend/sessions', all.data.token)).status, 404);
    const fullPage = await external('backend/registrations?limit=1', all.data.token);
    assert.ok(fullPage.data.nextCursor);
    const nextFullPage = await external(`backend/registrations?limit=1&after=${encodeURIComponent(fullPage.data.nextCursor)}`, all.data.token);
    assert.notDeepEqual(fullPage.data.data, nextFullPage.data.data);
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'])
      assert.equal((await external('backend/registrations', all.data.token, method)).status, 405);
    const limited = await call('keys', office.cookie, { name: 'Limited', scopes: ['registrations:read'] });
    assert.equal((await external('rosters', limited.data.token)).status, 403);
    await pool.execute('UPDATE dr_api_keys SET expires_at=? WHERE id=?', [Date.now() - 1000, limited.data.key.id]);
    assert.equal((await external('registrations', limited.data.token)).status, 401);
    assert.equal((await call('keys/revoke', bishop.cookie, { id: issued.data.key.id })).status, 403);
    assert.equal((await call('keys/revoke', office.cookie, { id: issued.data.key.id })).status, 200);
    assert.equal((await external('registrations')).status, 401);
    // When object storage rejects the credentials the image is kept in MySQL and still served.
    failStorage = true;
    const fallback = await upload(bishop, 'receipt');
    failStorage = false;
    assert.ok(fallback.startsWith('db/'), 'fallback keys are marked');
    const fallbackUrl = await call(`media?path=${encodeURIComponent(fallback)}`, bishop.cookie);
    assert.equal(fallbackUrl.status, 200); assert.match(fallbackUrl.data.url, /\/api\/registration\/media\/blob\?path=/);
    const blob = await api(new Request(`${config.origin}/api/registration/media/blob?path=${encodeURIComponent(fallback)}`, { headers: { cookie: bishop.cookie } }));
    assert.equal(blob.status, 200); assert.equal(blob.headers.get('content-type'), 'image/webp'); assert.ok((await blob.arrayBuffer()).byteLength > 20, "the stored image is returned");
    assert.equal((await api(new Request(`${config.origin}/api/registration/media/blob?path=${encodeURIComponent(fallback)}`, { headers: { cookie: stranger.cookie } }))).status, 403, 'strangers cannot read a stored image');

    assert.equal((await call('paystack/verify', bishop.cookie, { reference: 'abc123' })).status, 503, 'Paystack is off until the secret key is configured');

    // First-time setup: one secret, one use.
    assert.equal((await call('settings/bootstrap', '', { token: 'wrong', values: { SMTP_FROM: 'x@example.com' } })).status, 403);
    assert.equal((await call('settings/bootstrap', '', { token: 'test-bootstrap-token', values: { SMTP_FROM: 'Kuriake Castle <setup@example.com>' } })).status, 200);
    assert.equal(config.from, 'Kuriake Castle <setup@example.com>');
    assert.equal((await call('settings/bootstrap', '', { token: 'test-bootstrap-token', values: { SMTP_FROM: 'again@example.com' } })).status, 410, 'the setup token works once');
    await call('settings', office.cookie, { values: { SMTP_FROM: ' ' } });
    // Office-managed settings override the environment and apply immediately.
    assert.equal((await call('settings', bishop.cookie)).status, 403);
    const before = await call('settings', office.cookie); assert.equal(before.status, 200);
    assert.equal(before.data.settings.find(s => s.key === 'RESEND_API_KEY').set, false);
    assert.equal((await call('settings', office.cookie, { values: { NOT_A_SETTING: 'x' } })).status, 400);
    const savedSettings = await call('settings', office.cookie, { values: { RESEND_API_KEY: 're_test_key', SMTP_FROM: 'Kuriake Castle <no-reply@notifications.kuriakecastle.org>' } });
    assert.equal(savedSettings.status, 200); assert.equal(savedSettings.data.settings.find(s => s.key === 'RESEND_API_KEY').set, true);
    assert.equal(config.smtp.host, 'smtp.resend.com', 'the live config now points at Resend');
    assert.equal(config.from, 'Kuriake Castle <no-reply@notifications.kuriakecastle.org>');
    assert.equal((await call('settings', office.cookie, { values: { RESEND_API_KEY: ' ' } })).status, 200);
    assert.notEqual(config.smtp.host, 'smtp.resend.com', 'clearing a setting restores the environment value');

    // "Any issues?" reports reach the office by email, with a Telegram heads-up.
    assert.equal((await call('support', '', { message: 'Cannot upload my receipt.' })).status, 401);
    assert.equal((await call('support', bishop.cookie, { message: 'no' })).status, 400);
    assert.equal((await call('support', bishop.cookie, { message: 'The receipt upload rejects my screenshot.' })).status, 200);
    assert.equal(mails.at(-1).to, config.admins.join(','), 'the office is emailed');
    assert.match(mails.at(-1).text, /rejects my screenshot/);
    assert.equal(mails.at(-1).replyTo, 'bishop@example.com');
    assert.match(telegram.at(-1).url, /api\.telegram\.org\/bottest-token\/sendMessage/);
    assert.match(telegram.at(-1).body, /rejects my screenshot/);
    for (let i = 0; i < 5; i++) await call('support', bishop.cookie, { message: 'Another report about the same thing.' });
    assert.equal((await call('support', bishop.cookie, { message: 'Another report about the same thing.' })).status, 429, 'reports are rate limited');

    // Sign-in is only for registered members: unknown addresses get nothing, not even a code.
    const sent = mails.length;
    assert.equal((await call('auth/request', '', { email: 'nobody@example.com', mode: 'signin' })).status, 404);
    assert.equal((await call('auth/request', '', { email: 'stranger@example.com', mode: 'signin' })).status, 404, 'an account without a profile or registration is not a member');
    assert.equal(mails.length, sent, 'no code is emailed to an unrecognised address');
    assert.equal((await call('auth/verify', '', { email: 'nobody@example.com', token: '', mode: 'signin' })).status, 404);
    await pool.execute('DELETE FROM dr_rate_limits'); // the bishop requested a code less than a minute ago
    const signin = await call('auth/request', '', { email: 'bishop@example.com', mode: 'signin' });
    assert.equal(signin.status, 200);
    assert.equal(signin.data.codeRequired, true, 'sign-in always needs the emailed code');
    assert.equal((await call('auth/verify', '', { email: 'bishop@example.com', token: mails.at(-1).text.match(/code is (\d{6})/)[1], mode: 'signin' })).status, 200);
    // The office can remove member accounts; office members and non-office callers cannot.
    assert.equal((await call('accounts/remove', bishop.cookie, { user: 'x' })).status, 403);
    const strangerId = (await call('accounts?search=stranger%40example.com', office.cookie)).data.data[0].id;
    assert.equal((await call('accounts/remove', office.cookie, { user: strangerId })).data.removed, 1);
    assert.equal((await call('accounts?search=stranger%40example.com', office.cookie)).data.total, 0);
    assert.equal((await call('auth/me', stranger.cookie)).data, null, 'removed account is signed out');
    const officeId = (await call('accounts?search=office%40example.com', office.cookie)).data.data[0].id;
    assert.equal((await call('accounts/remove', office.cookie, { user: officeId })).data.removed, 0);
    if (process.env.TEST_BROWSER === '1') {
      const { default: next } = await import('next');
      config.origin = 'http://127.0.0.1:4208'; config.secure = false;
      const app = next({ dev: false, hostname: '127.0.0.1', port: 4208 });
      await app.prepare();
      const server = createServer(requestHandler({ origin: config.origin, api, nextHandler: app.getRequestHandler() }));
      await new Promise(resolve => server.listen(4208, '127.0.0.1', resolve));
      try {
        const { stdout } = await promisify(execFile)(process.env.TEST_PYTHON || 'python3', ['tests/registration/mysql-browser.py'], {
          env: { ...process.env, TEST_MEDIA_DIR: mediaDir }, timeout: 100000,
        });
    console.log(stdout.trim());
      } finally { await new Promise(resolve => server.close(resolve)); await app.close(); }
    }
  } finally {
    await rm(mediaDir, { recursive: true, force: true });
    client.destroy(); await pool.end(); await root.query(`DROP DATABASE ${db}`); await root.end();
  }
});
