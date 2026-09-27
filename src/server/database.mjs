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
  for (const name of ['001_registration.sql', '002_api_keys.sql', '003_account_activity.sql']) {
    const sql = await readFile(new URL(`../../mysql/${name}`, import.meta.url), 'utf8');
    for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await pool.query(statement);
  }
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
  return state;
}
export async function persistState(conn, before, after) {
  if (before.year !== after.year) await conn.execute('UPDATE dr_settings SET current_year=? WHERE id=1', [after.year]);
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
