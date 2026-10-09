import { createServer } from 'node:http';
import { requestHandler } from '../src/server/http.mjs';
import { readFile } from 'node:fs/promises';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const dev = process.argv.includes('--dev');
if (!dev) process.env.NODE_ENV = 'production';
if (process.env.NEXT_PUBLIC_REGISTRATION_BACKEND !== 'mysql') throw Error('Set NEXT_PUBLIC_REGISTRATION_BACKEND=mysql before building and starting Hostinger.');
if (process.env.NEXT_PUBLIC_BASE_PATH) throw Error('Hostinger must use an empty NEXT_PUBLIC_BASE_PATH.');
const { configuration } = await import('../src/server/config.mjs');
const { createPool, migrate, launchReset } = await import('../src/server/database.mjs');
const { createAuth } = await import('../src/server/auth.mjs');
const { createStorage } = await import('../src/server/storage.mjs');
const { createApi } = await import('../src/server/api.mjs');
const { applySettings } = await import('../src/server/settings.mjs');
const { default: nodemailer } = await import('nodemailer');
const { default: next } = await import('next');
if (!dev) {
  const build = JSON.parse(await readFile('.next/required-server-files.json', 'utf8'));
  if (build.config.output === 'export') throw Error('Rebuild with NEXT_PUBLIC_REGISTRATION_BACKEND=mysql before starting.');
}
const config = configuration();
const pool = createPool(config);
await migrate(pool); // idempotent: creates any missing dr_ tables
// A new roll (src/registration/reference-people.json) brings the office's saved structure and corrections in line with it, once.
{
  const { createHash } = await import('node:crypto'); const { readFile } = await import('node:fs/promises');
  const { syncRoll } = await import('../src/registration/model.mjs'); const { transaction, readState, persistState } = await import('../src/server/database.mjs');
  const raw = await readFile(new URL('../src/registration/reference-people.json', import.meta.url), 'utf8');
  const version = createHash('sha1').update(raw).digest('hex').slice(0, 12);
  try { await transaction(pool, async (conn) => { const before = await readState(conn, true); const after = syncRoll(before, JSON.parse(raw), version); if (after) { await persistState(conn, before, after); console.log(`Roll ${version}: structure and corrections aligned with the new roll`); } }); }
  catch (error) { console.error('Roll sync failed', error.message); }
}
await pool.query('SELECT current_year FROM dr_settings WHERE id=1');
await applySettings(config, pool); // saved settings (office emails included) apply before anything acts on them
if (await launchReset(pool, config)) console.log('Launch reset applied: member accounts and records cleared; original data, structure and settings kept.');
// The transport is created per message so mail settings saved in /admin/ apply at once.
const mailer = { sendMail: message => nodemailer.createTransport(config.smtp).sendMail(message) };
const auth = createAuth({ pool, config, mailer });
const storage = createStorage({ pool, config });
const api = createApi({ pool, config, auth, storage, mailer });
const port = Number(process.env.PORT || 3000);
const app = next({ dev, hostname: '0.0.0.0', port });
await app.prepare();
const nextHandler = app.getRequestHandler();
const server = createServer(requestHandler({ origin: config.origin, api, nextHandler }));
server.requestTimeout = 30000;
server.listen(port, '0.0.0.0', () => console.log(`Kuriake Castle server listening on port ${port}; admin: ${config.origin}/admin`));
// Periodic deletion is limited to expired authentication records, never registrations/media.
const cleanup = setInterval(async () => {
  try {
    for (const table of ['dr_sessions', 'dr_otp', 'dr_rate_limits']) await pool.execute(`DELETE FROM ${table} WHERE expires_at<?`, [Date.now()]);
  } catch { console.error('Expired authentication record cleanup failed'); }
}, 3600000);
cleanup.unref();
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  clearInterval(cleanup);
  server.close(async () => { await pool.end(); await app.close(); process.exit(0); });
});
