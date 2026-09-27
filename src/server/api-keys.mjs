import { readAccounts, readLogins } from './accounts.mjs';
import { readFile } from 'node:fs/promises';
import { ORGANIZATIONS, AMOUNTS } from '../registration/model.mjs';
import { DENOMINATIONS } from '../registration/denominations.mjs';
import { randomBytes, randomUUID } from 'node:crypto';
import { HttpError, digest, rateLimit } from './auth.mjs';
import { transaction } from './database.mjs';
export const KEY_SCOPES = ['backend:read', 'registrations:read', 'rosters:read', 'photos:read'];
export function keyOptions(input) {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const scopes = Array.isArray(input.scopes) ? [...new Set(input.scopes)] : [];
  const days = Number(input.days ?? 90);
  if (!name || name.length > 80) throw new HttpError(400, 'Give this key a name of up to 80 characters.');
  if (!scopes.length || scopes.some(s => !KEY_SCOPES.includes(s))) throw new HttpError(400, 'Choose valid read permissions.');
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new HttpError(400, 'Expiry must be between 1 and 365 days.');
  return { name, scopes, days };
}
const parse = value => typeof value === 'string' ? JSON.parse(value) : value;
const metadata = row => ({ id: row.id, name: row.name, prefix: row.token_prefix, scopes: parse(row.scopes),
  createdAt: Number(row.created_at), expiresAt: Number(row.expires_at), revokedAt: row.revoked_at ? Number(row.revoked_at) : null,
  lastUsedAt: row.last_used_at ? Number(row.last_used_at) : null });
const requireOffice = actor => { if (!actor?.office) throw new HttpError(403, 'Office access required.'); };
async function audit(conn, actor, action, id) {
  const now = new Date().toISOString();
  const [[settings]] = await conn.query('SELECT current_year FROM dr_settings WHERE id=1');
  const entry = { id: randomUUID(), actor: actor.id, action, target: id, year: settings.current_year, at: now };
  await conn.execute('INSERT INTO dr_audit (id,actor_id,created_at,data) VALUES (?,?,?,?)', [entry.id, actor.id, now, JSON.stringify(entry)]);
}
export function createKeyService({ pool, config, storage }) {
  return {
    async list(actor) {
      requireOffice(actor);
      const [rows] = await pool.query('SELECT id,name,token_prefix,scopes,created_at,expires_at,revoked_at,last_used_at FROM dr_api_keys ORDER BY created_at DESC');
      return rows.map(metadata);
    },
    async issue(actor, input) {
      requireOffice(actor);
      const { name, scopes, days } = keyOptions(input);
      await rateLimit(pool, config, `key-issue:${actor.id}`, 20, 3600000);
      const token = `drogs_live_${randomBytes(32).toString('base64url')}`;
      const row = { id: randomUUID(), name, token_prefix: token.slice(0, 19), scopes, created_by: actor.id,
        created_at: Date.now(), expires_at: Date.now() + days * 86400000 };
      await transaction(pool, async conn => {
        await conn.execute('INSERT INTO dr_api_keys (id,name,token_hash,token_prefix,scopes,created_by,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)',
          [row.id, name, digest(config.secret, `api-key:${token}`), row.token_prefix, JSON.stringify(scopes), actor.id, row.created_at, row.expires_at]);
        await audit(conn, actor, 'apiKeyCreated', row.id);
      });
      return { key: metadata(row), token }; // Full token returned once; only its hash is stored.
    },
    async revoke(actor, id) {
      requireOffice(actor);
      if (typeof id !== 'string' || id.length > 36) throw new HttpError(400, 'Select a valid API key.');
      await transaction(pool, async conn => {
        const [[row]] = await conn.execute('SELECT id,revoked_at FROM dr_api_keys WHERE id=? FOR UPDATE', [id]);
        if (!row) throw new HttpError(404, 'API key not found.');
        if (row.revoked_at) return;
        await conn.execute('UPDATE dr_api_keys SET revoked_at=? WHERE id=?', [Date.now(), id]);
        await audit(conn, actor, 'apiKeyRevoked', id);
      });
      return { ok: true };
    },
    async read(request) {
      if (request.method !== 'GET') throw new HttpError(405, 'API keys can only read data. Changes and deletion are not supported.');
      const token = (request.headers.get('authorization') || '').match(/^Bearer (drogs_live_[A-Za-z0-9_-]{43})$/)?.[1];
      if (!token) throw new HttpError(401, 'Send a valid API key in the Authorization: Bearer header.');
      const [[key]] = await pool.execute('SELECT k.*,u.email AS issuer_email FROM dr_api_keys k JOIN dr_users u ON u.id=k.created_by WHERE k.token_hash=? AND k.revoked_at IS NULL AND k.expires_at>?', [digest(config.secret, `api-key:${token}`), Date.now()]);
      if (!key || !config.admins.includes(key.issuer_email)) throw new HttpError(401, 'This API key is invalid, expired or revoked.');
      const url = new URL(request.url), route = url.pathname.replace(/\/$/, '');
      const backend = route.startsWith('/api/v1/backend/');
      const permission = backend ? 'backend:read' : { '/api/v1/registrations': 'registrations:read', '/api/v1/rosters': 'rosters:read', '/api/v1/photos': 'photos:read' }[route];
      if (!permission) throw new HttpError(404, 'API endpoint not found.');
      if (!parse(key.scopes).includes(permission) && !parse(key.scopes).includes('backend:read')) throw new HttpError(403, `This key requires ${permission} permission.`);
      await rateLimit(pool, config, `api-key:${key.id}`, 120, 60000);
      await pool.execute('UPDATE dr_api_keys SET last_used_at=? WHERE id=?', [Date.now(), key.id]);
      if (backend) return readBackend(pool, storage, url, config);
      if (permission === 'photos:read') {
        const path = url.searchParams.get('path');
        if (!path || path.length > 512) throw new HttpError(400, 'Supply a valid portrait path.');
        const [[media]] = await pool.execute("SELECT m.object_key FROM dr_media m JOIN dr_registrations r ON r.photo_key=m.object_key WHERE m.object_key=? AND m.kind='portrait' AND JSON_UNQUOTE(JSON_EXTRACT(r.data,'$.status')) <> 'draft' LIMIT 1", [path]);
        if (!media) throw new HttpError(404, 'Submitted portrait not found.');
        return { url: await storage.url(path), expiresIn: 3600 };
      }
      const [[settings]] = await pool.query('SELECT current_year FROM dr_settings WHERE id=1');
      const year = Number(url.searchParams.get('year') || settings.current_year);
      const limit = Number(url.searchParams.get('limit') || 50), after = url.searchParams.get('after') || '';
      if (!Number.isInteger(year) || year < 2000 || year > 2200 || !Number.isInteger(limit) || limit < 1 || limit > 100 || after.length > 36)
        throw new HttpError(400, 'Use a valid year, limit from 1 to 100, and the returned pagination cursor.');
      const registrations = permission === 'registrations:read';
      const table = registrations ? 'dr_registrations' : 'dr_rosters', column = registrations ? 'user_id' : 'id';
      const [rows] = await pool.query(`SELECT ${column} AS page_id,data FROM ${table} WHERE registration_year=? AND ${column}>?${registrations ? " AND JSON_UNQUOTE(JSON_EXTRACT(data,'$.status')) <> 'draft'" : ''} ORDER BY ${column} LIMIT ${limit + 1}`, [year, after]);
      const data = rows.slice(0, limit).map(row => {
        const r = parse(row.data);
        if (!registrations) return { id: r.id, year: r.year, bishopId: r.bishopId, name: r.name, email: r.email, phone: r.phone, church: r.church, status: r.status };
        const d = r.data;
        return { userId: r.userId, year: r.year, status: r.status, firstName: d.firstName, lastName: d.lastName,
          name: d.name, role: d.role, email: d.email, phone: d.phone, country: d.country, city: d.city,
          organization: d.organization, denomination: d.denomination, bishopId: d.bishopId, photo: d.photo,
          submittedAt: r.submittedAt, updatedAt: r.updatedAt };
      });
      return { data, year, nextCursor: rows.length > limit ? rows[limit - 1].page_id : null };
    },
  };
}

// Explicit application-data allowlist. Authentication/provider tables are never exposed.
async function readBackend(pool, storage, url, config) {
  const resource = url.pathname.replace(/\/$/, '').slice('/api/v1/backend/'.length);
  if (resource === 'accounts') return readAccounts(pool, config, url);
  if (resource === 'logins') return readLogins(pool, config, url);
  if (resource === 'settings') {
    const [[settings]] = await pool.query('SELECT current_year FROM dr_settings WHERE id=1');
    const [years] = await pool.query('SELECT DISTINCT registration_year AS year FROM dr_registrations ORDER BY registration_year');
    return { currentYear: settings.current_year, years: years.map(r => r.year), amounts: AMOUNTS };
  }
  if (resource === 'reference') return { organizations: ORGANIZATIONS, denominations: DENOMINATIONS,
    bishops: JSON.parse(await readFile(new URL('../registration/reference-bishops.json', import.meta.url), 'utf8')) };
  if (resource === 'media-url') {
    const path = url.searchParams.get('path');
    if (!path || path.length > 512) throw new HttpError(400, 'Supply a valid media path.');
    const [[media]] = await pool.execute('SELECT object_key FROM dr_media WHERE object_key=?', [path]);
    if (!media) throw new HttpError(404, 'Media not found.');
    return { url: await storage.url(path), expiresIn: 3600 };
  }
  const resources = {
    registrations: ['dr_registrations', "CONCAT(registration_year, ':', user_id)", 'data', true],
    rosters: ['dr_rosters', 'id', 'data', true],
    profiles: ['dr_profiles', 'id', 'data'],
    users: ['dr_users', 'id', 'id,email'],
    history: ['dr_audit', 'id', 'data'],
    media: ['dr_media', 'object_key', 'object_key,owner_id,kind,content_type,size_bytes,created_at'],
    keys: ['dr_api_keys', 'id', 'id,name,token_prefix,scopes,created_by,created_at,expires_at,revoked_at,last_used_at'],
  };
  const spec = resources[resource];
  if (!spec) throw new HttpError(404, 'API endpoint not found.');
  const [table, cursor, fields, annual] = spec;
  const limit = Number(url.searchParams.get('limit') || 50), after = url.searchParams.get('after') || '';
  const year = url.searchParams.has('year') ? Number(url.searchParams.get('year')) : null;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || after.length > 512 ||
    (year !== null && (!annual || !Number.isInteger(year) || year < 2000 || year > 2200)))
    throw new HttpError(400, 'Use limit 1–100, the returned cursor, and a valid year for annual records.');
  const [rows] = await pool.query(`SELECT ${cursor} AS page_id,${fields} FROM ${table} WHERE ${cursor}>?${year === null ? '' : ' AND registration_year=?'} ORDER BY ${cursor} LIMIT ${limit + 1}`, year === null ? [after] : [after, year]);
  return { data: rows.slice(0, limit).map(({ page_id, ...row }) => fields === 'data' ? parse(row.data) :
    resource === 'keys' ? { ...metadata(row), createdBy: row.created_by } : row),
    nextCursor: rows.length > limit ? rows[limit - 1].page_id : null, ...(annual ? { year } : {}) };
}
