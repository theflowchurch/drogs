import { brandedMail, fromAs } from './mail.mjs';
import { createHmac, randomBytes, randomInt, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scryptAsync = promisify(scrypt);
// Passwords (office, 17 Nov): members sign up and sign in with email and
// password; the emailed code is only for resetting a forgotten password.
// Stored as scrypt with a random salt, never the password itself.
export function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < 8) return 'Choose a password of at least 8 characters.';
  if (password.length > 200) return 'That password is too long.';
  return '';
}
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password.normalize('NFKC'), salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('base64')}$${Buffer.from(hash).toString('base64')}`;
}
export async function checkPassword(password, stored) {
  const [kind, N, r, p, salt, hash] = String(stored || '').split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const supplied = Buffer.from(await scryptAsync(String(password).normalize('NFKC'), Buffer.from(salt, 'base64'), expected.length, { N: Number(N), r: Number(r), p: Number(p) }));
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
import { transaction } from './database.mjs';
export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
export const digest = (secret, text) => createHmac('sha256', secret).update(text).digest('hex');
// Member and office sessions live in separate cookies, so signing in at /admin/
// never ends a member session open in the same browser (or the other way round).
// The page says which door it is through the X-Kc-Door header; requests without
// it (image tags) take whichever cookie is present, office first.
export const cookieName = 'drogs_session', officeCookieName = 'kc_office';
export const officeDoor = (request) => request.headers.get('x-kc-door') === 'office';
const cookieValue = (request, name) => (request.headers.get('cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${name}=`))?.slice(name.length + 1) || '';
export function sessionToken(request) {
  const door = request.headers.get('x-kc-door');
  if (door === 'office') return cookieValue(request, officeCookieName);
  if (door === 'member') return cookieValue(request, cookieName);
  return cookieValue(request, officeCookieName) || cookieValue(request, cookieName);
}
export function sessionCookie(config, token, maxAge = 43200, office = false) {
  return `${office ? officeCookieName : cookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${config.secure ? '; Secure' : ''}`;
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
  // A session remembers which door it came through: only a sign-in made at
  // /admin/ carries office powers, so an office email signed in as a member
  // sees exactly what any member sees. The door travels as a cookie prefix.
  const createSession = async (conn, user, remember = false, office = false) => {
    const token = randomBytes(32).toString('hex'), ttl = remember ? REMEMBER_MS : SESSION_MS;
    await conn.execute('INSERT INTO dr_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)', [digest(config.secret, `session:${token}`), user.id, Date.now() + ttl]);
    const isOffice = office && config.admins.includes(user.email);
    return { actor: { ...user, office: isOffice }, token: isOffice ? `o.${token}` : token, maxAge: Math.floor(ttl / 1000) };
  };
  const parseSession = (request) => {
    const raw = sessionToken(request);
    const office = raw.startsWith('o.'), token = office ? raw.slice(2) : raw;
    return /^[a-f0-9]{64}$/.test(token) ? { token, office } : null;
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
      await rateLimit(pool, config, 'access-code:office', 30, 600000);
      const expected = Buffer.from(digest(config.secret, `access:${config.adminCode}`), 'hex');
      const supplied = Buffer.from(digest(config.secret, `access:${code}`), 'hex');
      if (!timingSafeEqual(expected, supplied)) throw new HttpError(401, 'That access code is not correct.');
      return { ok: true };
    },
    async requestCode(email, origin = config.origin, mode = 'signup', brand = '', ownName = false) {
      if (mode === 'office' && !config.admins.includes(email)) throw new HttpError(403, 'This email does not have access to this site.');
      if (mode === 'reset') {
        const [[known]] = await pool.execute('SELECT id FROM dr_users WHERE email=?', [email]);
        if (!known) throw new HttpError(404, 'Sorry, this email is not recognised. Please create an account.');
      } else mode = await effectiveMode(email, mode);
      if (mode === 'signin') await requireMember(email);
      // One code a minute per address: the second click within a minute is told why, not "too many attempts".
      try { await rateLimit(pool, config, `otp-minute:${email}`, 1, 60000); }
      catch (e) { if (e.status === 429) throw new HttpError(429, 'A code was sent to this address less than a minute ago. Check your inbox and spam folder, then try again in a minute.'); throw e; }
      await rateLimit(pool, config, `otp-hour:${email}`, 5, 3600000);
      await rateLimit(pool, config, 'otp-global', 500, 3600000);
      const token = String(randomInt(0, 1000000)).padStart(6, '0');
      const hash = digest(config.secret, `otp:${email}:${token}`);
      await pool.execute('INSERT INTO dr_otp (email,code_hash,expires_at,attempts) VALUES (?,?,?,0) ON DUPLICATE KEY UPDATE code_hash=VALUES(code_hash),expires_at=VALUES(expires_at),attempts=0', [email, hash, Date.now() + 600000]);
      try {
        const name = brand || 'Kuriake Castle';
        await mailer.sendMail(brandedMail({ from: ownName ? fromAs(config.from, name) : config.from, to: email, subject: mode === 'reset' ? `Your ${name} password reset code` : `Your ${name} sign-in code`, brand, ownName,
          text: `Your ${name} sign-in code is ${token}. It expires in 10 minutes.\n\n${ownName ? 'Enter it on the page where you asked for it.' : `Use it at ${origin}.`} If you did not request this code, you can ignore this email.`,
          html: `<p style="margin:0 0 6px;color:#6a7283">Your sign-in code</p><p style="margin:0 0 18px;font:700 36px/1 -apple-system,Arial,sans-serif;letter-spacing:6px;color:#13324c">${token}</p><p style="margin:0 0 12px">It expires in 10 minutes. ${ownName ? 'Enter it on the page where you asked for it.' : `Use it at <a href="${origin}" style="color:#1e3a8a">${origin.replace(/^https?:\/\//, '')}</a>.`}</p><p style="margin:0;color:#6a7283;font-size:13px">If you did not request this code, you can ignore this email.</p>` }));
      } catch (error) {
        console.error('sign-in code email failed:', error?.message || error);
        await pool.execute('DELETE FROM dr_otp WHERE email=? AND code_hash=?', [email, hash]);
        // Nothing was sent, so the one-a-minute allowance is given back for an immediate retry.
        await pool.execute('DELETE FROM dr_rate_limits WHERE rate_key=?', [digest(config.secret, `rate:otp-minute:${email}`)]);
        // A short reason (no secrets) so the office can tell what the email service said.
        throw new HttpError(503, `Unable to send your code. Please try again shortly, or contact the office if it keeps happening. (${String(error?.message || 'email service unavailable').replace(/re_[A-Za-z0-9_]+/g, 're_…').slice(0, 160)})`);
      }
    },
    async verifyCode(email, code, mode = 'signup', remember = false) {
      // Office sign-ins always need the emailed code, whatever the member setting is.
      if (mode === 'office' && !config.admins.includes(email)) throw new HttpError(403, 'This email does not have access to this site.');
      mode = await effectiveMode(email, mode);
      // Every path needs the emailed code: nobody reaches the form on an email alone.
      const open = false;
      if (mode === 'signin') await requireMember(email);
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
        return createSession(conn, user, remember === true, mode === 'office');
      });
      if (!result) throw new HttpError(401, 'That code is invalid or expired. Request a new code.');
      return result;
    },
    // Office (17 Nov): the admin access code alone opens the office, signed in
    // as the first office email so changes are still recorded against it.
    async officeSignIn(code) {
      await this.checkOfficeCode(code);
      const email = config.admins[0];
      if (!email) throw new HttpError(503, 'No office email is set up yet.');
      return transaction(pool, async conn => {
        const [created] = await conn.execute('INSERT IGNORE INTO dr_users (id,email) VALUES (?,?)', [randomUUID(), email]);
        const [[user]] = await conn.execute('SELECT id,email FROM dr_users WHERE email=?', [email]);
        const now = Date.now();
        await conn.execute('INSERT INTO dr_account_activity (user_id,signed_up_at,last_login_at,login_count) VALUES (?,?,?,1) ON DUPLICATE KEY UPDATE signed_up_at=COALESCE(signed_up_at,VALUES(signed_up_at)),last_login_at=VALUES(last_login_at),login_count=login_count+1', [user.id, created.affectedRows ? now : null, now]);
        await conn.execute('INSERT INTO dr_logins (user_id,logged_in_at) VALUES (?,?)', [user.id, now]);
        return createSession(conn, user, false, true);
      });
    },
    // New account: email and a password typed twice (checked on the page). An
    // email that already has an account cannot be claimed this way.
    async signupWithPassword(email, password, remember = false) {
      const problem = passwordProblem(password);
      if (problem) throw new HttpError(400, problem);
      await rateLimit(pool, config, `signup:${email}`, 10, 3600000);
      await rateLimit(pool, config, 'signup-global', 500, 3600000);
      const hash = await hashPassword(password);
      return transaction(pool, async conn => {
        const [[existing]] = await conn.execute('SELECT u.id,p.user_id AS has FROM dr_users u LEFT JOIN dr_passwords p ON p.user_id=u.id WHERE u.email=? FOR UPDATE', [email]);
        if (existing) throw new HttpError(409, existing.has ? 'This email already has an account. Please sign in.' : 'This email is already registered. Use “Forgot password?” on Sign in to create your password.');
        const user = { id: randomUUID(), email }, now = Date.now();
        await conn.execute('INSERT INTO dr_users (id,email) VALUES (?,?)', [user.id, email]);
        await conn.execute('INSERT INTO dr_passwords (user_id,password_hash,updated_at) VALUES (?,?,?)', [user.id, hash, now]);
        await conn.execute('INSERT INTO dr_account_activity (user_id,signed_up_at,last_login_at,login_count) VALUES (?,?,?,1) ON DUPLICATE KEY UPDATE last_login_at=VALUES(last_login_at),login_count=login_count+1', [user.id, now, now]);
        await conn.execute('INSERT INTO dr_logins (user_id,logged_in_at) VALUES (?,?)', [user.id, now]);
        return createSession(conn, user, remember === true, false);
      });
    },
    async loginWithPassword(email, password, remember = false) {
      await rateLimit(pool, config, `login:${email}`, 10, 900000);
      await rateLimit(pool, config, 'login-global', 2000, 3600000);
      const [[row]] = await pool.execute('SELECT u.id,u.email,p.password_hash FROM dr_users u LEFT JOIN dr_passwords p ON p.user_id=u.id WHERE u.email=?', [email]);
      // No account at all, or an account from before passwords (19 Nov): say what to do next.
      if (!row) throw new HttpError(401, 'We could not find an account for this email. Check the address, or create an account.');
      if (!row.password_hash) throw new HttpError(401, 'You have not set a password yet. Use “Forgot password?” to create one.');
      // Five wrong passwords in a row lock the password until it is reset (17 Nov).
      const LOCKED = 'You have entered the wrong password 5 times. For your security, please reset your password using “Forgot password?”.';
      const [[failed]] = row ? await pool.execute('SELECT failures FROM dr_login_failures WHERE user_id=?', [row.id]) : [[null]];
      if (row?.password_hash && Number(failed?.failures || 0) >= 5) throw new HttpError(423, LOCKED);
      if (!row?.password_hash || typeof password !== 'string' || !(await checkPassword(password, row.password_hash))) {
        if (row?.password_hash) {
          await pool.execute('INSERT INTO dr_login_failures (user_id,failures,updated_at) VALUES (?,1,?) ON DUPLICATE KEY UPDATE failures=failures+1,updated_at=VALUES(updated_at)', [row.id, Date.now()]);
          const left = 5 - (Number(failed?.failures || 0) + 1);
          if (left <= 0) throw new HttpError(423, LOCKED);
          throw new HttpError(401, `Email or password is incorrect. ${left} ${left === 1 ? 'try' : 'tries'} left before you will need to reset your password.`);
        }
        throw new HttpError(401, 'Email or password is incorrect.');
      }
      await pool.execute('DELETE FROM dr_login_failures WHERE user_id=?', [row.id]);
      return transaction(pool, async conn => {
        const now = Date.now(), user = { id: row.id, email: row.email };
        await conn.execute('INSERT INTO dr_account_activity (user_id,signed_up_at,last_login_at,login_count) VALUES (?,NULL,?,1) ON DUPLICATE KEY UPDATE last_login_at=VALUES(last_login_at),login_count=login_count+1', [user.id, now]);
        await conn.execute('INSERT INTO dr_logins (user_id,logged_in_at) VALUES (?,?)', [user.id, now]);
        return createSession(conn, user, remember === true, false);
      });
    },
    // Forgot password: the emailed code proves the address; the new password
    // replaces the old one and every other signed-in device is signed out.
    async resetPassword(email, code, password, remember = false) {
      const problem = passwordProblem(password);
      if (problem) throw new HttpError(400, problem);
      if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw new HttpError(400, 'Enter the six-digit code from your email.');
      await rateLimit(pool, config, `verify:${email}`, 20, 3600000);
      const hash = await hashPassword(password);
      // Three wrong reset codes (17 Nov): the person is asked to contact the office.
      const THREE = 'That code was entered incorrectly 3 times. Please contact the office for help resetting your password.';
      const result = await transaction(pool, async conn => {
        const [[otp]] = await conn.execute('SELECT * FROM dr_otp WHERE email=? FOR UPDATE', [email]);
        if (otp && otp.attempts >= 3) return 'three';
        if (!otp || Number(otp.expires_at) <= Date.now()) return null;
        const expected = Buffer.from(otp.code_hash, 'hex');
        const supplied = Buffer.from(digest(config.secret, `otp:${email}:${code}`), 'hex');
        if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
          await conn.execute('UPDATE dr_otp SET attempts=attempts+1 WHERE email=?', [email]);
          return otp.attempts + 1 >= 3 ? 'three' : 'wrong';
        }
        await conn.execute('DELETE FROM dr_otp WHERE email=?', [email]);
        const [[user]] = await conn.execute('SELECT id,email FROM dr_users WHERE email=?', [email]);
        if (!user) return null;
        const now = Date.now();
        await conn.execute('INSERT INTO dr_passwords (user_id,password_hash,updated_at) VALUES (?,?,?) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash),updated_at=VALUES(updated_at)', [user.id, hash, now]);
        await conn.execute('DELETE FROM dr_sessions WHERE user_id=?', [user.id]);
        await conn.execute('DELETE FROM dr_login_failures WHERE user_id=?', [user.id]); // a new password unlocks the account
        await conn.execute('INSERT INTO dr_account_activity (user_id,signed_up_at,last_login_at,login_count) VALUES (?,NULL,?,1) ON DUPLICATE KEY UPDATE last_login_at=VALUES(last_login_at),login_count=login_count+1', [user.id, now]);
        await conn.execute('INSERT INTO dr_logins (user_id,logged_in_at) VALUES (?,?)', [user.id, now]);
        return createSession(conn, user, remember === true, false);
      });
      if (result === 'three') throw new HttpError(429, THREE);
      if (result === 'wrong') throw new HttpError(401, 'That code is not correct. Please check the email and try again.');
      if (!result) throw new HttpError(401, 'That code is invalid or expired. Request a new code.');
      return result;
    },
    async actor(request) {
      const session = parseSession(request);
      if (!session) return null;
      const [[user]] = await pool.execute('SELECT u.id,u.email FROM dr_sessions s JOIN dr_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?', [digest(config.secret, `session:${session.token}`), Date.now()]);
      return user ? { ...user, office: session.office && config.admins.includes(user.email) } : null;
    },
    async signOut(request) {
      const session = parseSession(request);
      if (session) await pool.execute('DELETE FROM dr_sessions WHERE token_hash=?', [digest(config.secret, `session:${session.token}`)]);
    },
  };
}
