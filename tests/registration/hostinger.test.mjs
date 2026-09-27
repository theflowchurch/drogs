import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { configuration } from '../../src/server/config.mjs';
import { readBody, createApi } from '../../src/server/api.mjs';
import { prepareImage, canReadMedia } from '../../src/server/storage.mjs';
import { sessionCookie } from '../../src/server/auth.mjs';
const env = { DB_HOST: 'localhost', DB_NAME: 'db', DB_USER: 'user', DB_PASSWORD: 'test', APP_URL: 'https://drogsdagministry.org', SESSION_SECRET: 'x'.repeat(64), ADMIN_EMAILS: 'office@example.com', SITE_ACCESS_CODE: '1234', ADMIN_ACCESS_CODE: 'admin-test-code', SMTP_HOST: 'smtp.example.com', SMTP_USER: 'user', SMTP_PASSWORD: 'test', SMTP_FROM: 'office@example.com', R2_ACCOUNT_ID: 'a'.repeat(32), R2_BUCKET: 'private', R2_ACCESS_KEY_ID: 'test', R2_SECRET_ACCESS_KEY: 'test' };
test('Hostinger configuration fails closed and session cookies are private', () => {
  assert.throws(() => configuration({}), /Missing server/);
  assert.throws(() => configuration({ ...env, SESSION_SECRET: 'weak' }), /SESSION_SECRET/);
  assert.throws(() => configuration({ ...env, APP_URL: 'http://drogsdagministry.org' }), /HTTPS/);
  const config = configuration(env);
  assert.deepEqual(config.admins, ['office@example.com']);
  assert.match(sessionCookie(config, 'token'), /HttpOnly; SameSite=Lax; Path=\/; Max-Age=43200; Secure/);
});
test('API rejects foreign origins and unauthenticated data requests', async () => {
  const api = createApi({ config: configuration(env), auth: { actor: async () => null } });
  let response = await api(new Request('https://drogsdagministry.org/api/registration/action', { method: 'POST', headers: { origin: 'https://other.example' } }));
  assert.equal(response.status, 403);
  response = await api(new Request('https://drogsdagministry.org/api/registration/snapshot'));
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('body limit applies even when no Content-Length is supplied', async () => {
  const request = new Request('https://example.com', { method: 'POST', body: '123456' });
  await assert.rejects(readBody(request, 5), /too large/);
});
test('uploads are decoded, converted and invalid/oversized files are rejected', async () => {
  const input = await sharp({ create: { width: 40, height: 60, channels: 3, background: 'red' } }).png().toBuffer();
  const output = await prepareImage(input, 'image/png');
  assert.equal((await sharp(output).metadata()).format, 'webp');
  await assert.rejects(prepareImage(Buffer.from('<script>'), 'image/png'), /could not be opened/);
  await assert.rejects(prepareImage(Buffer.alloc(5 * 1024 * 1024 + 1), 'image/png'), /smaller/);
});
test('portrait access follows bishop assignment and excludes draft photos/receipts', () => {
  const actor = { id: 'bishop' };
  const media = { owner_id: 'pastor', kind: 'portrait', object_key: 'portrait-key' };
  const state = { profiles: [{ id: 'bishop', role: 'bishop', bishopApproved: true, referenceId: 'B1' }], registrations: [{ status: 'unclaimed', data: { role: 'pastor', photo: 'portrait-key', bishopId: 'B1' } }] };
  assert.equal(canReadMedia(state, actor, media), true);
  assert.equal(canReadMedia(state, { id: 'stranger' }, media), false);
  assert.equal(canReadMedia(state, actor, { ...media, kind: 'receipt' }), false);
  state.registrations[0].status = 'draft';
  assert.equal(canReadMedia(state, actor, media), false);
  assert.equal(canReadMedia(state, { id: 'office', office: true }, media), true);
});

test('R2 scoped session token is forwarded into signed image URLs', async () => {
  const { createStorage } = await import('../../src/server/storage.mjs');
  const config = configuration({ ...env, R2_SESSION_TOKEN: 'test-scoped-session-token' });
  const storage = createStorage({ config });
  const url = new URL(await storage.url('test-owner/portrait/test.webp'));
  assert.equal(url.searchParams.get('X-Amz-Security-Token'), 'test-scoped-session-token');
});

test('application API key permissions reject write/delete scopes and invalid lifetimes', async () => {
  const { keyOptions } = await import('../../src/server/api-keys.mjs');
  assert.deepEqual(keyOptions({ name: 'Directory', scopes: ['registrations:read'], days: 30 }), { name: 'Directory', scopes: ['registrations:read'], days: 30 });
  for (const scope of ['registrations:write', 'photos:delete', 'admin', '*'])
    assert.throws(() => keyOptions({ name: 'Bad scope', scopes: [scope] }), /read permissions/);
  assert.throws(() => keyOptions({ name: 'Bad expiry', scopes: ['photos:read'], days: 366 }), /Expiry/);
});
