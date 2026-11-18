import { createHash, timingSafeEqual } from 'node:crypto';
import { configuration } from './config.mjs';
import { HttpError, rateLimit } from './auth.mjs';
// Settings the office may change from /admin/ without touching the host's
// environment. Stored in dr_config and layered over process.env at runtime.
export const SETTINGS = [
  ['RESEND_API_KEY', 'Resend API key', 'Outgoing email (sign-in codes, office reports) is sent through Resend when set.'],
  ['SUPPORT_EMAIL', 'Issue reports go to', 'Where “Any issues?” reports and questions from the site are emailed. Kuriakecastle@gmail.com unless changed.'],
  ['SMTP_FROM', 'From address', 'e.g. Kuriake Castle <no-reply@notifications.kuriakecastle.org>'],
  ['PAYSTACK_PUBLIC_KEY', 'Paystack public key', 'Starts with pk_live_. From the Paystack dashboard: Settings › API Keys & Webhooks.'],
  ['PAYSTACK_SECRET_KEY', 'Paystack secret key', 'Starts with sk_live_. Used by the server to confirm each payment.'],
  ['GEMINI_API_KEY', 'Gemini API key (photos)', 'From Google AI Studio (aistudio.google.com › Get API key). Starts with AIza. New bishops and pastors we have no photo for get their photo edited to the official look automatically.'],
  ['TELEGRAM_BOT_TOKEN', 'Telegram bot token', 'From @BotFather. Every “Any issues?” report is posted to the channel below as well as emailed.'],
  ['TELEGRAM_CHAT_ID', 'Telegram chat ID', 'The channel or group the bot posts to. Channels look like -1001234567890. Add the bot as an admin of the channel first.'],
  ['R2_ACCOUNT_ID', 'Cloudflare R2 account ID', 'Photo storage. Leave blank to keep the host’s values.'],
  ['R2_BUCKET', 'R2 bucket', ''],
  ['R2_ACCESS_KEY_ID', 'R2 access key ID', ''],
  ['R2_SECRET_ACCESS_KEY', 'R2 secret access key', ''],
  ['PUBLIC_DIRECTORY_SOURCE', 'Public directory shows', '"original" (the existing roster, for now) or "roll" (only people confirmed this year).'],
  ['PUBLIC_PHOTOS', 'Public directory photographs', '"confirmed" (a photograph appears only once the person is confirmed for this year; everyone else is a dark silhouette — the default) or "all" (every photograph shows).'],
  ['ADMIN_ACCESS_CODE', 'Office access code', 'The code typed at /admin/ before the email.'],
  ['ORDER_ACCESS_CODE', 'Order pages password', 'Asked before the Order of Bishops, Order of Pastors and Councils pages open (then the person signs in and must be in good standing). Different from the office code.'],
  ['ADMIN_EMAILS', 'Office emails', 'Comma-separated. Only these addresses can sign in to /admin/; each sign-in is confirmed by an emailed code.'],
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
  const base = config.sourceEnv;
  Object.assign(config, configuration({ ...base, ...stored }));
  config.sourceEnv = base; // keep the untouched environment so a cleared setting really reverts
  return stored;
}
// One-time first configuration without host access: the SHA-256 of a secret
// held offline is committed here; the secret is presented once, then burned.
export const BOOTSTRAP_TOKEN_SHA256 = ''; // burned; tests supply one via BOOTSTRAP_TOKEN_SHA256
export async function bootstrapSettings(config, pool, body) {
  const expected = config.sourceEnv?.BOOTSTRAP_TOKEN_SHA256 || BOOTSTRAP_TOKEN_SHA256;
  if (!expected) throw new HttpError(404, 'Not found.');
  await rateLimit(pool, config, 'settings-bootstrap', 5, 3600000);
  // Each committed hash works exactly once; a later hash is a new, separate setup.
  if ((await readSettings(pool)).BOOTSTRAP_USED === expected) throw new HttpError(410, 'The first-time setup has already been completed.');
  const supplied = createHash('sha256').update(String(body?.token || '')).digest('hex');
  if (supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) throw new HttpError(403, 'Not allowed.');
  await writeSettings(pool, body.values, { office: true }, config);
  await pool.execute('INSERT INTO dr_config (name,value,updated_at) VALUES (?,?,?) ON DUPLICATE KEY UPDATE value=VALUES(value),updated_at=VALUES(updated_at)', ['BOOTSTRAP_USED', expected, Date.now()]);
}
export async function writeSettings(pool, values, actor, config = {}) {
  if (!actor?.office) throw new HttpError(403, 'Office access required.');
  if (!values || typeof values !== 'object') throw new HttpError(400, 'Send the settings to save.');
  const entries = Object.entries(values);
  if (entries.some(([key, value]) => !allowed.has(key) || typeof value !== 'string' || value.length > 4096))
    throw new HttpError(400, 'One of the settings is not recognised.');
  // A browser filling a saved password into these boxes must not replace a key.
  for (const [key, prefix, label] of [['PAYSTACK_PUBLIC_KEY', 'pk', 'public'], ['PAYSTACK_SECRET_KEY', 'sk', 'secret']]) {
    const v = values[key]?.trim();
    if (v && !new RegExp(`^${prefix}_(live|test)_[A-Za-z0-9]+$`).test(v)) throw new HttpError(400, `That is not a Paystack ${label} key. It should start with ${prefix}_live_. Nothing was saved.`);
  }
  if (values.GEMINI_API_KEY?.trim() && !/^AIza[A-Za-z0-9_-]{30,}$/.test(values.GEMINI_API_KEY.trim())) throw new HttpError(400, 'That is not a Gemini API key. It should start with AIza. Nothing was saved.');
  if (values.RESEND_API_KEY?.trim() && !/^re_[A-Za-z0-9_]+$/.test(values.RESEND_API_KEY.trim())) throw new HttpError(400, 'That is not a Resend API key. It should start with re_. Nothing was saved.');
  try {
    configuration({ ...(config.sourceEnv || process.env), ...(await readSettings(pool)), ...Object.fromEntries(entries.filter(([, v]) => v.trim())) });
  } catch (error) { throw new HttpError(400, error.message); }
  for (const [key, value] of entries) {
    if (value.trim()) await pool.execute('INSERT INTO dr_config (name,value,updated_at) VALUES (?,?,?) ON DUPLICATE KEY UPDATE value=VALUES(value),updated_at=VALUES(updated_at)', [key, value.trim(), Date.now()]);
    else await pool.execute('DELETE FROM dr_config WHERE name=?', [key]);
  }
}
// For the Paystack keys the office also sees whether what is saved is a real key
// (never the key itself).
const KEY_SHAPE = { PAYSTACK_PUBLIC_KEY: /^pk_(live|test)_[A-Za-z0-9]+$/, PAYSTACK_SECRET_KEY: /^sk_(live|test)_[A-Za-z0-9]+$/, RESEND_API_KEY: /^re_[A-Za-z0-9_]+$/, GEMINI_API_KEY: /^AIza[A-Za-z0-9_-]{30,}$/ };
export const describeSettings = stored => SETTINGS.map(([key, label, hint]) => ({ key, label, hint, set: Boolean(stored[key]),
  // Not secrets: the office sees the addresses in use.
  ...(['SMTP_FROM', 'SUPPORT_EMAIL'].includes(key) && stored[key] ? { value: String(stored[key]) } : {}),
  ...(KEY_SHAPE[key] && stored[key] ? { invalid: !KEY_SHAPE[key].test(String(stored[key]).trim()), test: key.startsWith("PAYSTACK") && /_test_/.test(String(stored[key])) } : {}) }));
// Office emails are not secrets: the office sees and manages the list.
export const officeMembers = config => config.admins;
