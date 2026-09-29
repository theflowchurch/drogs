export function configuration(env = process.env) {
  const required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'APP_URL', 'SESSION_SECRET',
    'ADMIN_EMAILS', 'SITE_ACCESS_CODE', 'ADMIN_ACCESS_CODE', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM',
    'R2_ACCOUNT_ID', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];
  const missing = required.filter(key => !env[key]?.trim());
  if (missing.length) throw Error(`Missing server environment variables: ${missing.join(', ')}`);
  const origin = new URL(env.APP_URL);
  if (origin.protocol !== 'https:' && !(env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(origin.hostname)))
    throw Error('APP_URL must use HTTPS in production.');
  if (origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password)
    throw Error('APP_URL must be the website origin, without a path.');
  if (env.SESSION_SECRET.length < 32) throw Error('SESSION_SECRET must contain at least 32 characters.');
  if (!/^[a-f0-9]{32}$/i.test(env.R2_ACCOUNT_ID)) throw Error('Invalid R2_ACCOUNT_ID.');
  const admins = env.ADMIN_EMAILS.split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
  if (!admins.length || admins.some(v => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))) throw Error('ADMIN_EMAILS must contain valid email addresses.');
  const port = (name, fallback) => {
    const value = Number(env[name] || fallback);
    if (!Number.isInteger(value) || value < 1 || value > 65535) throw Error(`Invalid ${name}.`);
    return value;
  };
  return {
    // Kept so stored settings can be layered over the same environment later.
    sourceEnv: env,
    origin: origin.origin, secure: origin.protocol === 'https:', secret: env.SESSION_SECRET, admins,
    siteCode: env.SITE_ACCESS_CODE, adminCode: env.ADMIN_ACCESS_CODE,
    db: { host: env.DB_HOST, port: port('DB_PORT', 3306), database: env.DB_NAME,
      user: env.DB_USER, password: env.DB_PASSWORD, charset: 'utf8mb4', timezone: 'Z',
      ...(env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: true, ...(env.DB_SSL_CA ? { ca: env.DB_SSL_CA.replace(/\\n/g, '\n') } : {}) } } : {}) },
    // Resend, when a key is present, replaces whatever SMTP server the host was given.
    smtp: env.RESEND_API_KEY?.trim()
      ? { host: 'smtp.resend.com', port: 465, secure: true, auth: { user: 'resend', pass: env.RESEND_API_KEY.trim() }, connectionTimeout: 15000, socketTimeout: 20000 }
      : { host: env.SMTP_HOST, port: port('SMTP_PORT', 587), secure: env.SMTP_SECURE === 'true',
      requireTLS: env.SMTP_SECURE !== 'true', auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
      connectionTimeout: 15000, socketTimeout: 20000 },
    from: env.SMTP_FROM,
    // Optional: a Telegram heads-up alongside the office email for issue reports.
    // Optional: Paystack secret key enables card / mobile-money payments (public key is NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY).
    paystack: env.PAYSTACK_SECRET_KEY?.trim() || null,
    paystackPublic: (env.PAYSTACK_PUBLIC_KEY || env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '').trim(),
    // Email one-time codes are off unless REQUIRE_EMAIL_CODE=true: members sign in with just their email.
    requireEmailCode: env.REQUIRE_EMAIL_CODE === 'true',
    telegram: env.TELEGRAM_BOT_TOKEN?.trim() && env.TELEGRAM_CHAT_ID?.trim()
      ? { token: env.TELEGRAM_BOT_TOKEN.trim(), chat: env.TELEGRAM_CHAT_ID.trim() } : null,
    r2: { account: env.R2_ACCOUNT_ID, bucket: env.R2_BUCKET, accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, sessionToken: env.R2_SESSION_TOKEN || undefined },
  };
}
