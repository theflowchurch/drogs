import { readFile } from 'node:fs/promises';
// Email through Resend's HTTPS API (office, 17 Nov: the host stopped letting the
// SMTP connection through, so nothing reached Resend). Same key, port 443, and
// Resend's own reason comes back when it refuses.
export async function sendViaResend(key, message, fetcher = fetch) {
  const list = v => (Array.isArray(v) ? v : String(v || '').split(',')).map(s => String(s).trim()).filter(Boolean);
  const attachments = await Promise.all((message.attachments || []).map(async a => ({
    filename: a.filename,
    content: Buffer.from(a.content ?? await readFile(a.path)).toString('base64'),
    ...(a.contentType ? { content_type: a.contentType } : {}),
    ...(a.cid ? { content_id: a.cid } : {}),
  })));
  const body = { from: message.from, to: list(message.to), subject: message.subject, text: message.text, html: message.html,
    ...(message.replyTo ? { reply_to: list(message.replyTo) } : {}), ...(attachments.length ? { attachments } : {}) };
  let response;
  try {
    response = await fetcher('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  } catch (error) { throw Error(`Could not reach Resend: ${error.message}`); }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) { const e = Error(result.message || result.error || `Resend refused the email (status ${response.status})`); e.response = e.message; throw e; }
  return { messageId: result.id };
}
