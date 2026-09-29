import { createHash, timingSafeEqual } from 'node:crypto';
import { configuration } from './config.mjs';
import { HttpError, rateLimit } from './auth.mjs';
// Settings the office may change from /admin/ without touching the host's
// environment. Stored in dr_config and layered over process.env at runtime.
export const SETTINGS = [
  ['RESEND_API_KEY', 'Resend API key', 'Outgoing email (sign-in codes, office reports) is sent through Resend when set.'],
  ['SMTP_FROM', 'From address', 'e.g. Kuriake Castle <no-reply@notifications.kuriakecastle.org>'],
  ['REQUIRE_EMAIL_CODE', 'Require emailed sign-in code', 'true or false. Off: members sign in with their email alone.'],
  ['PAYSTACK_PUBLIC_KEY', 'Paystack public key', 'Shows the card / mobile-money button.'],
  ['PAYSTACK_SECRET_KEY', 'Paystack secret key', 'Used by the server to confirm each payment.'],
  ['TELEGRAM_BOT_TOKEN', 'Telegram bot token', 'Optional: “Any issues?” reports also post to Telegram.'],
  ['TELEGRAM_CHAT_ID', 'Telegram chat ID', ''],
  ['R2_ACCOUNT_ID', 'Cloudflare R2 account ID', 'Photo storage. Leave blank to keep the host’s values.'],
  ['R2_BUCKET', 'R2 bucket', ''],
  ['R2_ACCESS_KEY_ID', 'R2 access key ID', ''],
  ['R2_SECRET_ACCESS_KEY', 'R2 secret access key', ''],
  ['ADMIN_ACCESS_CODE', 'Office access code', 'The code typed at /admin/.'],
  ['SITE_ACCESS_CODE', 'Directory access code', 'The code typed at /directory/.'],
];
const allowed = new Set(SETTINGS.map(([key]) => key));
export async function readSettings(pool) {
  if (!pool) return {};
  try {
    const [rows] = await pool.query('SELECT name,value FROM dr_config');
    return Object.fromEntries(rows.map(r => [r.name, r.value]));
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') return {};
    throw error;
  }
}
// Re-derive the whole configuration from env + stored settings, in place, so
// every module holding the config object sees the change immediately.
export async function applySettings(config, pool) {
  const stored = await readSettings(pool);
  if (!config.sourceEnv) return stored; // a hand-built config cannot be re-derived
  Object.assign(config, configuration({ ...config.sourceEnv, ...stored }));
  return stored;
}
// One-time first configuration without host access: the SHA-256 of a secret
// held offline is committed here; the secret is presented once, then burned.
export const BOOTSTRAP_TOKEN_SHA256 = 'd6628cecae38c264726e29962ffb0cf1d591c645bd924e5896f9dff029c8bbf8';
export async function bootstrapSettings(config, pool, body) {
  const expected = config.sourceEnv?.BOOTSTRAP_TOKEN_SHA256 || BOOTSTRAP_TOKEN_SHA256;
  if (!expected) throw new HttpError(404, 'Not found.');
  await rateLimit(pool, config, 'settings-bootstrap', 5, 3600000);
  if ((await readSettings(pool)).BOOTSTRAP_USED) throw new HttpError(410, 'The first-time setup has already been completed.');
  const supplied = createHash('sha256').update(String(body?.token || '')).digest('hex');
  if (supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) throw new HttpError(403, 'Not allowed.');
  await writeSettings(pool, body.values, { office: true }, config);
  await pool.execute('INSERT INTO dr_config (name,value,updated_at) VALUES (?,?,?) ON DUPLICATE KEY UPDATE value=VALUES(value)', ['BOOTSTRAP_USED', new Date().toISOString(), Date.now()]);
}
export async function writeSettings(pool, values, actor, config = {}) {
  if (!actor?.office) throw new HttpError(403, 'Office access required.');
  if (!values || typeof values !== 'object') throw new HttpError(400, 'Send the settings to save.');
  const entries = Object.entries(values);
  if (entries.some(([key, value]) => !allowed.has(key) || typeof value !== 'string' || value.length > 4096))
    throw new HttpError(400, 'One of the settings is not recognised.');
  try {
    configuration({ ...(config.sourceEnv || process.env), ...(await readSettings(pool)), ...Object.fromEntries(entries.filter(([, v]) => v.trim())) });
  } catch (error) { throw new HttpError(400, error.message); }
  for (const [key, value] of entries) {
    if (value.trim()) await pool.execute('INSERT INTO dr_config (name,value,updated_at) VALUES (?,?,?) ON DUPLICATE KEY UPDATE value=VALUES(value),updated_at=VALUES(updated_at)', [key, value.trim(), Date.now()]);
    else await pool.execute('DELETE FROM dr_config WHERE name=?', [key]);
  }
}
export const describeSettings = stored => SETTINGS.map(([key, label, hint]) => ({ key, label, hint, set: Boolean(stored[key]) }));
