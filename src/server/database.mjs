import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import { emptyState } from '../registration/model.mjs';
export const createPool = config => mysql.createPool({ ...config.db, connectionLimit: 5, waitForConnections: true, queueLimit: 100 });
export async function transaction(pool, fn) {
  const conn = await pool.getConnection();
  try { await conn.beginTransaction(); const result = await fn(conn); await conn.commit(); return result; }
  catch (error) { await conn.rollback(); throw error; }
  finally { conn.release(); }
}
export async function migrate(pool) {
  for (const name of ['001_registration.sql', '002_api_keys.sql', '003_account_activity.sql', '004_media_blobs.sql', '005_config.sql', '006_office.sql']) {
    const sql = await readFile(new URL(`../../mysql/${name}`, import.meta.url), 'utf8');
    for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await pool.query(statement);
  }
}
// One-time launch reset (requested by the office on 2026-10-01): every member
// account and everything they produced goes, so the site starts empty. The
// original data, the office's structure (dr_state: groups, denominations,
// corrections), Settings (dr_config), API keys and the office accounts stay.
// A marker in dr_config makes sure it runs exactly once, whatever restarts follow.
export async function launchReset(pool, config, marker = 'LAUNCH_RESET_2026_10_01') {
  const [[done]] = await pool.query('SELECT value FROM dr_config WHERE name=?', [marker]);
  if (done) return false;
  const admins = (config.admins || []).map(e => e.toLowerCase());
  const [rows] = await pool.query('SELECT id,email FROM dr_users');
  const gone = rows.filter(r => !admins.includes(String(r.email).toLowerCase())).map(r => r.id);
  for (const table of ['dr_registrations', 'dr_rosters', 'dr_profiles', 'dr_audit', 'dr_media_blobs', 'dr_media', 'dr_otp', 'dr_rate_limits']) await pool.query(`DELETE FROM ${table}`);
  if (gone.length) {
    const marks = gone.map(() => '?').join(',');
    for (const [table, column] of [['dr_sessions', 'user_id'], ['dr_logins', 'user_id'], ['dr_account_activity', 'user_id'], ['dr_users', 'id']]) await pool.query(`DELETE FROM ${table} WHERE ${column} IN (${marks})`, gone);
  }
  await pool.query('INSERT INTO dr_config (name,value,updated_at) VALUES (?,?,?) ON DUPLICATE KEY UPDATE value=VALUES(value),updated_at=VALUES(updated_at)', [marker, new Date().toISOString(), Date.now()]);
  return true;
}
const parse = row => typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
export async function readState(conn, lock = false) {
  // All mutations lock this row before reading. This prevents lost updates and double claims.
  const [settings] = await conn.query(`SELECT current_year FROM dr_settings WHERE id=1${lock ? ' FOR UPDATE' : ''}`);
  if (!settings.length) throw Error('Run npm run db:migrate before starting registration.');
  const state = { ...emptyState(), year: settings[0].current_year };
  for (const [field, table] of [['profiles', 'dr_profiles'], ['registrations', 'dr_registrations'], ['rosters', 'dr_rosters'], ['audit', 'dr_audit']]) {
    const [rows] = await conn.query(`SELECT data FROM ${table}`);
    state[field] = rows.map(parse);
  }
  // Office-editable structure (hidden records, catalog, fees, roster corrections) lives in one JSON row.
  const [extra] = await conn.query('SELECT data FROM dr_state WHERE id=1');
  if (extra.length) Object.assign(state, Object.fromEntries(Object.entries(parse(extra[0])).filter(([k]) => OFFICE_FIELDS.includes(k))));
  return state;
}
const OFFICE_FIELDS = ['hidden', 'catalog', 'fees', 'overrides', 'extraReferences', 'signup'];
export async function persistState(conn, before, after) {
  if (before.year !== after.year) await conn.execute('UPDATE dr_settings SET current_year=? WHERE id=1', [after.year]);
  if (OFFICE_FIELDS.some(k => JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null)))
    await conn.execute('UPDATE dr_state SET data=? WHERE id=1', [JSON.stringify(Object.fromEntries(OFFICE_FIELDS.map(k => [k, after[k] ?? null])))]);
  // Records the office deleted
  const gone = (field, key) => { const keep = new Set(after[field].map(key)); return before[field].filter(v => !keep.has(key(v))); };
  for (const r of gone('registrations', r => `${r.userId}:${r.year}`))
    await conn.execute('DELETE FROM dr_registrations WHERE user_id=? AND registration_year=?', [r.userId, r.year]);
  for (const r of gone('rosters', r => r.id))
    await conn.execute('DELETE FROM dr_rosters WHERE id=?', [r.id]);
  const changed = (field, key) => {
    const old = new Map(before[field].map(v => [key(v), JSON.stringify(v)]));
    return after[field].filter(v => old.get(key(v)) !== JSON.stringify(v));
  };
  for (const p of changed('profiles', p => p.id))
    await conn.execute('INSERT INTO dr_profiles (id,data) VALUES (?,?) ON DUPLICATE KEY UPDATE data=VALUES(data)', [p.id, JSON.stringify(p)]);
  for (const r of changed('registrations', r => `${r.userId}:${r.year}`))
    await conn.execute('INSERT INTO dr_registrations (user_id,registration_year,photo_key,proof_key,data) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE photo_key=VALUES(photo_key),proof_key=VALUES(proof_key),data=VALUES(data)', [r.userId, r.year, r.data.photo || null, r.proof || null, JSON.stringify(r)]);
  for (const r of changed('rosters', r => r.id))
    await conn.execute('INSERT INTO dr_rosters (id,bishop_id,registration_year,data) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE data=VALUES(data)', [r.id, r.bishopId, r.year, JSON.stringify(r)]);
  for (const a of changed('audit', a => a.id))
    await conn.execute('INSERT INTO dr_audit (id,actor_id,created_at,data) VALUES (?,?,?,?)', [a.id, a.actor, a.at, JSON.stringify(a)]);
}
