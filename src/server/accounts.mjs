import { HttpError } from './auth.mjs';
export async function readAccounts(pool, config, url) {
  const search = (url.searchParams.get('search') || '').trim();
  const page = Number(url.searchParams.get('page') || 1);
  if (search.length > 254 || !Number.isInteger(page) || page < 1 || page > 1000000) throw new HttpError(400, 'Invalid account search or page.');
  // Matches the sign-in email, or the name/email on the profile or this year's registration (case-insensitive).
  const filter = " WHERE LOCATE(?,u.email)>0 OR LOCATE(?,LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(p.data,'$.name')),'')))>0 OR LOCATE(?,COALESCE(JSON_UNQUOTE(JSON_EXTRACT(p.data,'$.email')),''))>0 OR LOCATE(?,LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(r.data,'$.data.name')),'')))>0 OR LOCATE(?,COALESCE(JSON_UNQUOTE(JSON_EXTRACT(r.data,'$.data.email')),''))>0";
  const joins = ' FROM dr_users u LEFT JOIN dr_profiles p ON p.id=u.id LEFT JOIN dr_registrations r ON r.user_id=u.id AND r.registration_year=(SELECT current_year FROM dr_settings WHERE id=1)';
  const term = search.toLowerCase(), params = [term, term, term, term, term];
  const [[counts]] = await pool.execute('SELECT COUNT(*) AS total'+joins+filter, params);
  const [rows] = await pool.execute(`SELECT u.id,u.email,p.data AS profile,a.signed_up_at,a.last_login_at,a.login_count,r.data AS registration${joins} LEFT JOIN dr_account_activity a ON a.user_id=u.id${filter} ORDER BY a.last_login_at DESC,u.id LIMIT 50 OFFSET ${(page - 1) * 50}`, params);
  const parse = value => typeof value === 'string' ? JSON.parse(value) : value;
  return { total: counts.total, page, pageSize: 50, data: rows.map(r => {
    const profile = parse(r.profile), registration = parse(r.registration);
    return { id: r.id, email: registration?.data?.email || profile?.email || r.email, name: registration?.data?.name || profile?.name || '', role: profile?.role || registration?.data?.role || '',
      office: config.admins.includes(r.email), signedUpAt: r.signed_up_at ? Number(r.signed_up_at) : null,
      lastLoginAt: r.last_login_at ? Number(r.last_login_at) : null, loginCount: Number(r.login_count || 0),
      registrationStatus: registration?.status || 'not_started', registrationYear: registration?.year || null };
  }) };
}
export async function readLogins(pool, config, url) {
  const user = url.searchParams.get('user') || '', before = url.searchParams.get('before') || '';
  if (user.length > 36 || (before && !/^\d{1,20}$/.test(before))) throw new HttpError(400, 'Invalid login filter.');
  const filters = [], params = [];
  if (user) { filters.push('l.user_id=?'); params.push(user); }
  if (before) { filters.push('l.id<?'); params.push(before); }
  const [rows] = await pool.execute(`SELECT CAST(l.id AS CHAR) AS id,l.user_id AS userId,u.email,l.logged_in_at AS loggedInAt FROM dr_logins l JOIN dr_users u ON u.id=l.user_id${filters.length ? ' WHERE '+filters.join(' AND ') : ''} ORDER BY l.id DESC LIMIT 51`, params);
  return { data: rows.slice(0,50).map(r => ({...r, loggedInAt: Number(r.loggedInAt)})), nextCursor: rows.length > 50 ? rows[49].id : null };
}
// Remove one member account, or every account that is not an office member.
// Everything keyed to the user goes; roster rows that pointed at a removed
// pastor become unclaimed again so the bishop's list stays intact.
export async function removeAccounts(pool, config, actor, body) {
  const { user, all } = body || {};
  if (!all && (typeof user !== 'string' || !user || user.length > 36)) throw new HttpError(400, 'Which account?');
  const params = all ? [] : [user];
  const [rows] = await pool.execute(`SELECT id,email FROM dr_users${all ? '' : ' WHERE id=?'}`, params);
  const ids = rows.filter(r => !config.admins.includes(r.email) && r.id !== actor.id).map(r => r.id);
  if (!ids.length) return { removed: 0 };
  const marks = ids.map(() => '?').join(',');
  const run = sql => pool.execute(sql, ids);
  await run(`UPDATE dr_rosters SET data=JSON_REMOVE(data,'$.pastorId') WHERE JSON_UNQUOTE(JSON_EXTRACT(data,'$.pastorId')) IN (${marks})`);
  for (const [table, column] of [['dr_rosters', 'bishop_id'], ['dr_registrations', 'user_id'], ['dr_profiles', 'id'], ['dr_sessions', 'user_id'], ['dr_logins', 'user_id'], ['dr_account_activity', 'user_id'], ['dr_media', 'owner_id'], ['dr_users', 'id']])
    await run(`DELETE FROM ${table} WHERE ${column} IN (${marks})`);
  return { removed: ids.length };
}
