import test from 'node:test';
import assert from 'node:assert/strict';
import { sendViaResend } from '../../src/server/resend-mail.mjs';
import { brandedMail } from '../../src/server/mail.mjs';
test('emails go to Resend over HTTPS with the logo inline, and its refusal reason comes back', async () => {
  let sent;
  const ok = async (url, options) => { sent = { url, options, body: JSON.parse(options.body) }; return { ok: true, json: async () => ({ id: 'm1' }) }; };
  const r = await sendViaResend('re_key', brandedMail({ from: 'Kuriake Castle <no-reply@notifications.kuriakecastle.org>', to: 'a@x.com', replyTo: 'b@x.com', subject: 'Code', text: 'Hi' }), ok);
  assert.equal(r.messageId, 'm1');
  assert.equal(sent.url, 'https://api.resend.com/emails');
  assert.equal(sent.options.headers.Authorization, 'Bearer re_key');
  assert.deepEqual(sent.body.to, ['a@x.com']); assert.deepEqual(sent.body.reply_to, ['b@x.com']);
  assert.equal(sent.body.attachments[0].content_id, 'kc-logo'); assert.ok(sent.body.attachments[0].content.length > 100);
  const refused = async () => ({ ok: false, status: 403, json: async () => ({ message: 'The domain is not verified.' }) });
  await assert.rejects(sendViaResend('re_key', { from: 'x', to: 'a@x.com', subject: 's', text: 't' }, refused), /domain is not verified/);
});
test('passwords are stored as salted scrypt, checked exactly, and must be 8+ characters', async () => {
  const { hashPassword, checkPassword, passwordProblem } = await import('../../src/server/auth.mjs');
  const a = await hashPassword('Correct horse 1'), b = await hashPassword('Correct horse 1');
  assert.notEqual(a, b, 'a fresh salt each time');
  assert.ok(!a.includes('Correct'));
  assert.equal(await checkPassword('Correct horse 1', a), true);
  assert.equal(await checkPassword('correct horse 1', a), false);
  assert.equal(await checkPassword('x', 'garbage'), false);
  assert.match(passwordProblem('short'), /8 characters/);
  assert.equal(passwordProblem('long enough'), '');
});
