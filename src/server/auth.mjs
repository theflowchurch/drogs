import { createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { transaction } from './database.mjs';
export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
export const digest = (secret, text) => createHmac('sha256', secret).update(text).digest('hex');
export const cookieName = 'drogs_session';
export function sessionToken(request) {
  return (request.headers.get('cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) || '';
}
export function sessionCookie(config, token, maxAge = 43200) {
  return `${cookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${config.secure ? '; Secure' : ''}`;
}
export function emailAddress(value) {
  if (typeof value !== 'string') throw new HttpError(400, 'Enter a valid email address.');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[\x21-\x7e]+$/.test(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.');
  return email;
}
export async function rateLimit(pool, config, key, limit, period, now = Date.now()) {
  const hash = digest(config.secret, `rate:${key}`);
  const allowed = await transaction(pool, async conn => {
    await conn.execute('INSERT IGNORE INTO dr_rate_limits (rate_key,hits,expires_at) VALUES (?,0,?)', [hash, now + period]);
    const [[row]] = await conn.execute('SELECT hits,expires_at FROM dr_rate_limits WHERE rate_key=? FOR UPDATE', [hash]);
    const hits = Number(row.expires_at) <= now ? 0 : row.hits;
    if (hits >= limit) return false;
    await conn.execute('UPDATE dr_rate_limits SET hits=?,expires_at=? WHERE rate_key=?', [hits + 1, Number(row.expires_at) <= now ? now + period : Number(row.expires_at), hash]);
    return true;
  });
  if (!allowed) throw new HttpError(429, 'Too many attempts. Please wait before trying again.');
}
export function createAuth({ pool, config, mailer }) {
  // Twelve hours by default; thirty days when the person asks to stay signed in on this device.
  const SESSION_MS = 43200000, REMEMBER_MS = 30 * 86400000;
  const createSession = async (conn, user, remember = false) => {
    const token = randomBytes(32).toString('hex'), ttl = remember ? REMEMBER_MS : SESSION_MS;
    await conn.execute('INSERT INTO dr_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)', [digest(config.secret, `session:${token}`), user.id, Date.now() + ttl]);
    return { actor: { ...user, office: config.admins.includes(user.email) }, token, maxAge: Math.floor(ttl / 1000) };
  };
  // Signing in is only for people who already registered (a profile or a
  // registration, pending or approved). Nobody else is told anything more
  // than "not recognised", and no code is ever emailed to an unknown address.
  async function isMember(email) {
    const [[known]] = await pool.execute('SELECT u.id FROM dr_users u WHERE u.email=? AND (EXISTS (SELECT 1 FROM dr_profiles p WHERE p.id=u.id) OR EXISTS (SELECT 1 FROM dr_registrations r WHERE r.user_id=u.id))', [email]);
    return Boolean(known);
  }
  async function requireMember(email) {
    if (!(await isMember(email))) throw new HttpError(404, 'Sorry, this email is not recognised. Only registered bishops and pastors can sign in.');
  }
  // The sign-up form must not become a back door into an existing member's
  // account: an email that already belongs to a member is treated as a sign-in.
  async function effectiveMode(email, mode) {
    return mode === 'signup' && (await isMember(email)) ? 'signin' : mode;
  }
  return {
    // The office code only opens the door; the person then signs in with an approved email and a code sent to it.
    async checkOfficeCode(code) {
      if (typeof code !== 'string' || code.length > 64) throw new HttpError(401, 'That access code is not correct.');
      await rateLimit(pool, config, 'access-code:office', 50, 60000);
      const expected = Buffer.from(digest(config.secret, `access:${config.adminCode}`), 'hex');
      const supplied = Buffer.from(digest(config.secret, `access:${code}`), 'hex');
      if (!timingSafeEqual(expected, supplied)) throw new HttpError(401, 'That access code is not correct.');
      return { ok: true };
    },
    async accessWithCode(code, office = false) {
      if (office) throw new HttpError(403, 'Office members sign in with an approved email.');
      if (typeof code !== 'string' || code.length > 64) throw new HttpError(401, 'That access code is not correct.');
      await rateLimit(pool, config, 'access-code:registration', 50, 60000);
      const expected = Buffer.from(digest(config.secret, `access:${config.siteCode}`), 'hex');
      const supplied = Buffer.from(digest(config.secret, `access:${code}`), 'hex');
      if (!timingSafeEqual(expected, supplied)) throw new HttpError(401, 'That access code is not correct.');
      return transaction(pool, async conn => {
        const email = office ? config.admins[0] : `visitor-${randomUUID()}@drogs.invalid`;
        const id = randomUUID();
        await conn.execute('INSERT IGNORE INTO dr_users (id,email) VALUES (?,?)', [id, email]);
        const [[user]] = await conn.execute('SELECT id,email FROM dr_users WHERE email=?', [email]);
        const now = Date.now();
        await conn.execute('INSERT INTO dr_account_activity (user_id,signed_up_at,last_login_at,login_count) VALUES (?,?,?,1) ON DUPLICATE KEY UPDATE last_login_at=VALUES(last_login_at),login_count=login_count+1', [user.id, now, now]);
        await conn.execute('INSERT INTO dr_logins (user_id,logged_in_at) VALUES (?,?)', [user.id, now]);
        return createSession(conn, user);
      });
    },
    async requestCode(email, origin = config.origin, mode = 'signup') {
      if (mode === 'office' && !config.admins.includes(email)) throw new HttpError(403, 'This email does not have access to this site.');
      mode = await effectiveMode(email, mode);
      if (mode === 'signin') await requireMember(email);
      // Office addresses only ever sign in through /admin/ (access code first).
      if (mode !== 'office' && config.admins.includes(email)) throw new HttpError(403, 'Office accounts sign in with the admin code at /admin/.');
      await rateLimit(pool, config, `otp-minute:${email}`, 1, 60000);
      await rateLimit(pool, config, `otp-hour:${email}`, 5, 3600000);
      await rateLimit(pool, config, 'otp-global', 500, 3600000);
      const token = String(randomInt(0, 1000000)).padStart(6, '0');
      const hash = digest(config.secret, `otp:${email}:${token}`);
      await pool.execute('INSERT INTO dr_otp (email,code_hash,expires_at,attempts) VALUES (?,?,?,0) ON DUPLICATE KEY UPDATE code_hash=VALUES(code_hash),expires_at=VALUES(expires_at),attempts=0', [email, hash, Date.now() + 600000]);
      try {
        await mailer.sendMail({ from: config.from, to: email, subject: 'Your Kuriake Castle sign-in code',
          text: `Your Kuriake Castle sign-in code is ${token}. It expires in 10 minutes.\n\nUse it at ${origin}. If you did not request this code, you can ignore this email.` });
      } catch {
        await pool.execute('DELETE FROM dr_otp WHERE email=? AND code_hash=?', [email, hash]);
        throw new HttpError(503, 'Unable to send your code. Please try again shortly.');
      }
    },
    async verifyCode(email, code, mode = 'signup', remember = false) {
      // Office sign-ins always need the emailed code, whatever the member setting is.
      if (mode === 'office' && !config.admins.includes(email)) throw new HttpError(403, 'This email does not have access to this site.');
      mode = await effectiveMode(email, mode);
      // Every path needs the emailed code: nobody reaches the form on an email alone.
      const open = false;
      if (mode === 'signin') await requireMember(email);
      if (mode !== 'office' && config.admins.includes(email)) throw new HttpError(403, 'Office accounts sign in with the admin code at /admin/.');
      if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw new HttpError(400, 'Enter the six-digit code from your email.');
      await rateLimit(pool, config, `verify:${email}`, 20, 3600000);
      const result = await transaction(pool, async conn => {
        if (!open) {
          const [[otp]] = await conn.execute('SELECT * FROM dr_otp WHERE email=? FOR UPDATE', [email]);
          if (!otp || Number(otp.expires_at) <= Date.now() || otp.attempts >= 5) return null;
          const expected = Buffer.from(otp.code_hash, 'hex');
          const supplied = Buffer.from(digest(config.secret, `otp:${email}:${code}`), 'hex');
          if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
            await conn.execute('UPDATE dr_otp SET attempts=attempts+1 WHERE email=?', [email]);
            return null; // Commit failed-attempt count; do not throw and roll it back.
          }
          await conn.execute('DELETE FROM dr_otp WHERE email=?', [email]);
        }
        const [created] = await conn.execute('INSERT IGNORE INTO dr_users (id,email) VALUES (?,?)', [randomUUID(), email]);
        const [[user]] = await conn.execute('SELECT id,email FROM dr_users WHERE email=?', [email]);
        const now = Date.now();
        await conn.execute('INSERT INTO dr_account_activity (user_id,signed_up_at,last_login_at,login_count) VALUES (?,?,?,1) ON DUPLICATE KEY UPDATE last_login_at=VALUES(last_login_at),login_count=login_count+1', [user.id, created.affectedRows ? now : null, now]);
        await conn.execute('INSERT INTO dr_logins (user_id,logged_in_at) VALUES (?,?)', [user.id, now]);
        return createSession(conn, user, remember === true);
      });
      if (!result) throw new HttpError(401, 'That code is invalid or expired. Request a new code.');
      return result;
    },
    async actor(request) {
      const token = sessionToken(request);
      if (!/^[a-f0-9]{64}$/.test(token)) return null;
      const [[user]] = await pool.execute('SELECT u.id,u.email FROM dr_sessions s JOIN dr_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?', [digest(config.secret, `session:${token}`), Date.now()]);
      return user ? { ...user, office: config.admins.includes(user.email) } : null;
    },
    async signOut(request) {
      await pool.execute('DELETE FROM dr_sessions WHERE token_hash=?', [digest(config.secret, `session:${sessionToken(request)}`)]);
    },
  };
}
