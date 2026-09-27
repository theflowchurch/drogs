import { HttpError } from './auth.mjs';
export async function readAccounts(pool, config, url) {
  const search = (url.searchParams.get('search') || '').trim();
  const page = Number(url.searchParams.get('page') || 1);
  if (search.length > 254 || !Number.isInteger(page) || page < 1 || page > 1000000) throw new HttpError(400, 'Invalid account search or page.');
  const filter = " WHERE LOCATE(?,u.email)>0 OR LOCATE(?,COALESCE(JSON_UNQUOTE(JSON_EXTRACT(p.data,'$.name')),''))>0";
  const joins = ' FROM dr_users u LEFT JOIN dr_profiles p ON p.id=u.id';
  const [[counts]] = await pool.execute('SELECT COUNT(*) AS total'+joins+filter, [search, search]);
  const [rows] = await pool.execute(`SELECT u.id,u.email,p.data AS profile,a.signed_up_at,a.last_login_at,a.login_count,r.data AS registration${joins} LEFT JOIN dr_account_activity a ON a.user_id=u.id LEFT JOIN dr_registrations r ON r.user_id=u.id AND r.registration_year=(SELECT current_year FROM dr_settings WHERE id=1)${filter} ORDER BY a.last_login_at DESC,u.id LIMIT 50 OFFSET ${(page - 1) * 50}`, [search, search]);
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
