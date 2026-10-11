// The roll, rebuilt from the office's current data only (Joshua, 9 Oct 2026):
//   • the Bishops List (who is a bishop, their group, denomination and branch),
//   • every sheet the bishops sent back (their own details and the exact pastors under them),
//   • the group chat's rulings for pastors claimed by two bishops,
//   • pictures from the photo folders and the portraits already on file,
//   • the Google Form's verified years.
// Nothing comes from the original roster or the old office export. data/roll-continuity.json
// only carries ids and portrait paths forward so registrations and photos keep pointing at people.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as XLSX from 'xlsx'; import fs from 'node:fs'; XLSX.set_fs(fs);
import sharp from 'sharp';
import { normalName, namesAlike } from '../src/registration/model.mjs';
import { GROUPS } from '../src/registration/groups.mjs';
import { DENOMINATIONS } from '../src/registration/denominations.mjs';
import { sameSoul, words } from './lib/names.mjs';
import { dhash, hamming, SAME_PICTURE } from './lib/photo-hash.mjs';
import { birthAgrees } from './lib/birth.mjs';
const root = new URL('..', import.meta.url).pathname;
const BASE = `${process.env.HOME}/Downloads/Kuriake Castle Project/01 Office source data`;
const read = (rel, fallback) => { try { return JSON.parse(readFileSync(`${root}${rel}`, 'utf8')); } catch { return fallback; } };
const ap = (t) => String(t || '').replace(/[’'`]/g, '');
const key = (n) => normalName(ap(n));
// Countries as the sheets spell them → one spelling each.
const COUNTRY_FIX = { uk: 'United Kingdom', england: 'United Kingdom', scotland: 'United Kingdom', 'northern ireland': 'United Kingdom', wales: 'United Kingdom', usa: 'United States', us: 'United States', 'u s a': 'United States', drc: 'Congo, Democratic Republic', 'd r congo': 'Congo, Democratic Republic', rdc: 'Congo, Democratic Republic', 'dr congo': 'Congo, Democratic Republic', 'south african': 'South Africa', accra: 'Ghana', hawaii: 'United States', 'cote d ivoire ivory coast': "Cote D'Ivoire", 'ivory coast': "Cote D'Ivoire" };
const fixCountry = (c) => { const k = normalName(c); return COUNTRY_FIX[k] || (c ? tc(c) : ''); };
const tc = (t) => String(t || '').trim().replace(/\s+/g, ' ').toLowerCase().replace(/(^|[\s'’(-])\p{L}/gu, (c) => c.toUpperCase());
const subsetName = (a, b) => { const A = words(a), B = words(b); if (A.length < 2 || B.length < 2) return false; return A.every((w) => B.includes(w)) || B.every((w) => A.includes(w)); };
const blank = (v) => !v || /^(n\/?a|none|nil|missing|-+)$/i.test(String(v).trim());
// ---------- 1. The Bishops List: the anchor
const listRows = XLSX.utils.sheet_to_json(XLSX.readFile(`${BASE}/Bishops List (9 Oct 2026).xlsx`).Sheets.Sheet1, { raw: false, defval: '' }).filter((r) => r.NAME.trim());
const aliases = read('data/bishops-list-aliases.json', { aliases: {} }).aliases;
const stripTitle = (n) => String(n).replace(/^\s*(bishop|episcopal sister|es|mother|rev\.?|reverend)\s+/i, '').replace(/\s*\(jnr\)\s*$/i, ' Jnr').trim();
const aliasKeyed = Object.fromEntries(Object.entries(aliases).map(([k, v]) => [key(stripTitle(k)), v]));
const aliasesOf = (b) => aliasKeyed[key(b.name)] || aliasKeyed[key(stripTitle(b.listName))] || [];
const listBishops = listRows.map((r, i) => ({ n: i + 1, listName: r.NAME.trim(), name: tc(stripTitle(r.NAME)), listGroup: r['CHURCH GROUP'].trim(), listDenomination: r['DENOMINATION/COUNTRIES'].trim(), branch: tc(r['CURRENT BRANCH'].replace(/^n\/?a$/i, '')) }));
const variants = new Map(); // every spelling → list bishop
for (const b of listBishops) { variants.set(key(b.name), b); variants.set(key(b.listName), b); for (const a of aliasesOf(b)) variants.set(key(a), b); }
// Exact spelling → same words in another order → one name's words all inside the other's → close spelling with the same surname. Each step must be unambiguous.
const findBishop = (name) => { const k = key(stripTitle(name)); if (!k) return null; if (variants.has(k)) return variants.get(k); const w = words(k), sorted = [...w].sort().join(' ');
  for (const [v, b] of variants) if (words(v).sort().join(' ') === sorted) return b;
  if (w.length >= 2) { const subset = new Set(); for (const [v, b] of variants) { const vw = words(v); if (vw.length >= 2 && (vw.every((x) => w.includes(x)) || w.every((x) => vw.includes(x)))) subset.add(b); } if (subset.size === 1) return [...subset][0]; if (subset.size > 1) return null; }
  const alike = new Set(); for (const [v, b] of variants) if (namesAlike(v, k) && words(v).at(-1) === w.at(-1)) alike.add(b); return alike.size === 1 ? [...alike][0] : null; };
// ---------- 2. Continuity: ids, portraits, details we already held
const cont = read('data/roll-continuity.json', { bishops: [], pastors: [] });
const oldBishopByKey = new Map(cont.bishops.map((b) => [key(b.name), b]));
for (const b of listBishops) { let o = oldBishopByKey.get(key(b.name)); if (!o) for (const a of aliasesOf(b)) o = o || oldBishopByKey.get(key(a)); if (!o) { const alike = cont.bishops.filter((x) => namesAlike(ap(x.name), ap(b.name))); if (alike.length === 1) o = alike[0]; } b.old = o || null; }
const oldPastorsByKey = new Map(); for (const p of cont.pastors) { const k = key(p.name); if (!oldPastorsByKey.has(k)) oldPastorsByKey.set(k, []); oldPastorsByKey.get(k).push(p); }
// ---------- 3. Groups and denominations: list → our structure's spellings
const GROUP_NAME = { 'eschatos international': 'Eschatos', 'flow and healing jesus campaign bishops': 'FLOW', 'first love': 'First Love' };
const COUNTRYISH = /^(united cities|nicaragua|columbia|colombia|vietnam|middle east|guyana|brazil|panama|costa rica|bangladesh|chile|jamaica|taiwan|american samoa|mauritius|india|malawi|gabon.*|guinea conakry|central african republic|equatorial guinea.*|cape verde|lesotho|burkina faso|seychelles|suriname|n\/?a|other international)$/i;
const denKey = (d) => normalName(String(d || '').replace(/\(.*?\)/g, '')).replace(/\b(the|international|int|church|churches|chapel)\b/g, ' ').replace(/\s+/g, ' ').trim();
const canonDen = (group, raw) => { if (group === 'FLOW' || group === 'HJC' || group === 'Healing Jesus Campaign') return group === 'FLOW' ? 'FLOW' : 'Healing Jesus Campaign'; if (/^(first ?love( church)?|flc\b.*)$/i.test(String(raw || '').trim())) return 'First Love Church'; if (group === 'First Love') { const r = String(raw || '').trim(); if (!r || /^(first ?love( church)?|flc\b.*)$/i.test(r)) return 'First Love Church'; const fl = DENOMINATIONS['First Love'] || []; return fl.find((d) => denKey(d) === denKey(r)) || fl.find((d) => denKey(d).startsWith(denKey(r) + ' ')) || tc(r); } if (!raw || COUNTRYISH.test(raw.trim())) return group === 'Eschatos' ? 'Eschatos' : group === 'United Islands' ? 'United Islands' : group === 'UD Africa' ? 'United Cities' : ''; if (denKey(raw) === denKey(group) || denKey(raw) === denKey(group + ' churches')) return ''; /* a row that just repeats the group name ("Reasonable Service Churches") takes the bishop's denomination */ const pool = GROUPS[group]?.denominations || []; const curated = DENOMINATIONS['United Denominations'] || []; const hit = curated.find((d) => denKey(d) === denKey(raw)) || nearest(raw, curated, 1) || pool.find((d) => denKey(d) === denKey(raw)) || pool.find((d) => denKey(d).startsWith(denKey(raw) + ' ')) || nearest(raw, [...(DENOMINATIONS['United Denominations'] || []), ...pool]); return hit || tc(raw); }; // the curated list in denominations.mjs is the spelling authority // "The Mega Church – Grace Chapel" stays its own denomination, never shortened to "The Mega Church"
// A typed denomination that is a near-miss of a known one ("Makarios City Churh", "Strong Christian Chruch", "The Glorious Megachurch") is that one.
const squash = (d) => normalName(String(d || '').replace(/\(.*?\)/g, '')).replace(/\s+/g, ''); // whole spelling, spaces and brackets aside: "Makarios City Churh" is one letter from "Makarios City Church"
const nearest = (raw, pool, max = 2) => { const r = squash(raw); if (!r) return ''; let best = '', bestD = max + 1; for (const d of pool) { const k = squash(d); if (!k) continue; if (k === r) return d; const dist = Math.abs(k.length - r.length) > 2 ? 9 : (await0(k, r)); if (dist < bestD) { bestD = dist; best = d; } } return best; };
const await0 = (a, b) => { const m = a.length, n = b.length; const dp = Array.from({ length: m + 1 }, (_, i) => [i]); for (let j = 1; j <= n; j++) dp[0][j] = j; for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return dp[m][n]; };
const groupOfList = (b) => GROUP_NAME[b.listGroup.toLowerCase()] || b.listGroup;
const orgOfGroup = (g, b) => g === 'First Love' ? 'First Love' : g === 'FLOW' ? (b.old?.organization === 'HJC' ? 'HJC' : 'FLOW') : 'United Denominations';
// ---------- 4. Sheets
const subs = read('data/bishop-submissions.json', []);
for (const s of subs) if (!s.pastors.length && /no pastors/i.test(s.folder)) s.noPastors = true; // a sheet in the "no pastors" folder with nothing after the marker
const latestByBishop = new Map(); const nonList = [];
const fromFile = (f) => tc(f.replace(/\.xlsx$/, '').replace(/[-_ ]*(\d+|updated|completed|filled|copy|data)\b.*$/i, '').replace(/[-_]/g, ' ').replace(/^(bishop|episcopal sister|espiscopal sister|mother|rev)\s+/i, '').replace(/,.*$/, '').replace(/\(.*?\)/g, '').replace(/\s+(flc|first love|pastors?|jesus is the master|rpi|lsk|tamale north).*$/i, ''));
for (const s of subs) { const b = findBishop(fromFile(s.file)) || findBishop(s.bishop) || findBishop(s.titleRow || ''); if (!b) { nonList.push(s); continue; } s.bishopRef = b; if (s.bishopRow && findBishop(s.bishopRow.name) && findBishop(s.bishopRow.name) !== b) s.rowBelongsToAnother = s.bishopRow.name; latestByBishop.set(b.listName, s); } // the office named each file after its bishop; a bishop row that names someone else (Lokko's sheet carries Wisdom Ahiagah's row) is not used for details // folders are ordered oldest → newest, so the last wins
// ---------- 5. Bishops
const KEEP_OLD_PASTORS = []; // every bishop has now submitted (Toss Mills-Odoi's sheet arrived 10 Oct)
let newBishopN = 1; const bishops = [];
for (const b of listBishops) {
  const s = latestByBishop.get(b.listName); const row = s && !s.rowBelongsToAnother ? s.bishopRow : null; const o = b.old;
  const organization = orgOfGroup(groupOfList(b), b); const group = organization === 'HJC' ? 'Healing Jesus Campaign' : groupOfList(b); // the Healing Jesus Campaign is its own group, apart from FLOW (Joshua, 11 Oct)
  const selfName = row?.name ? tc(stripTitle(row.name).replace(/^(es|dr|rev)\.?\s+/gi, '').replace(/^(es|dr|rev)\.?\s+/gi, '')) : '';
  const name = (o?.name || (selfName && words(selfName).length >= 2 ? selfName : b.name)).replace(/\s*-\s*/g, '-'); // our curated spelling first, then the bishop's own row, then the list
  const gender = row?.gender || o?.gender || (/^(mother|episcopal sister)/i.test(b.listName) ? 'female' : '');
  // Only men are Bishops (Joshua, 9 Oct): a woman is an Episcopal Sister in the United Denominations and a Mother in First Love, FLOW and the Healing Jesus Campaign.
  const title = gender === 'female' ? (organization === 'United Denominations' ? 'Episcopal Sister' : 'Mother') : 'Bishop';
  bishops.push({ id: o?.id || `BL${newBishopN++}`, role: 'bishop', name, title, organization, denomination: (COUNTRYISH.test(b.listDenomination.trim()) && row?.denomination && !COUNTRYISH.test(row.denomination) ? canonDen(group, row.denomination) : '') || canonDen(organization === 'HJC' ? 'HJC' : group, b.listDenomination) || o?.denomination || '', denominationLogo: '', city: row?.city || b.branch || o?.city || '', branch: b.branch || row?.branch || '', country: fixCountry(row?.country) || o?.country || (COUNTRYISH.test(b.listDenomination) && !/n\/?a|other/i.test(b.listDenomination) ? tc(b.listDenomination.replace(/\s*[–(-].*$/, '')) : ''), image: o?.image || '', gender, yearAppointed: row?.yearAppointed || o?.yearAppointed || '', yearOrdained: row?.yearOrdained || o?.yearOrdained || '', yearConsecrated: row?.yearConsecrated || o?.yearConsecrated || '', group, sheet: s ? { file: s.file, folder: s.folder, noPastors: Boolean(s.noPastors), rows: s.pastors.length } : null });
}
const bishopByList = new Map(listBishops.map((b, i) => [b.listName, bishops[i]]));
const bishopKeys = new Set(bishops.map((b) => key(b.name))); for (const b of listBishops) { bishopKeys.add(key(b.name)); for (const a of aliasesOf(b)) bishopKeys.add(key(a)); }
// The same picture on both records makes them one person even when the birthdays were typed differently.
const hashCache = new Map();
const imageOnFile = (name) => { let olds = oldPastorsByKey.get(key(name)) || []; if (!olds.length) { const alike = cont.pastors.filter((x) => x.image && subsetName(key(x.name), key(name))); if (alike.length === 1) olds = alike; } return olds.find((x) => x.image)?.image || ''; };
const hashOf = async (p) => { const img = imageOnFile(p.row.name); if (!img || !existsSync(`${root}${img}`)) return null; if (!hashCache.has(img)) { try { hashCache.set(img, await dhash(`${root}${img.replace(/^(assets\/portraits)\/([^/]+)\.[^.]+$/, '$1/thumbs/$2.webp')}`)); } catch { try { hashCache.set(img, await dhash(`${root}${img}`)); } catch { hashCache.set(img, null); } } } return hashCache.get(img); };
const samePicture = async (a, b) => { if (imageOnFile(a.row.name) === imageOnFile(b.row.name)) return false; const x = await hashOf(a), y = await hashOf(b); return Boolean(x && y && hamming(x, y) <= SAME_PICTURE); };
// ---------- 6. Pastors from the sheets
const rulings = read('data/sheet-conflict-rulings.json', { rules: [], people: [], remove: [] });
const dupRulings = read('data/duplicate-rulings.json', { merge: [], distinct: [], pending: [] });
const bishopIn = (list, n) => list.some((b) => namesAlike(b, n) || key(b) === key(n));
const ruledDistinct = (x, y) => dupRulings.distinct.some((d) => d.bishops && d.names.some((n) => key(n) === key(x.row.name) || key(n) === key(y.row.name)) && [x, y].every((c) => bishopIn(d.bishops, c.bishop.name))); // Joshua: these namesakes are two people
const ruledTogether = (x, y) => rulings.people.some((p) => [x, y].some((c) => key(p.name) === key(c.row.name) || words(key(p.name)).sort().join(' ') === words(key(c.row.name)).sort().join(' ')) && [x, y].every((c) => bishopIn([p.winner, ...(p.losers || [])], c.bishop.name))); // the group ruled on exactly these two claims
const removeKeys = new Set([...rulings.remove.map((r) => key(r.name)), ...read('data/not-pastors.json', []).map((n) => key(n.name))]); // Walter, plus the office's Minister Shepherds / Shepherds / Elders (7 Oct)
const years = new Map(read('data/verified-years.json', []).map((v) => [words(key(v.name)).sort().join(' '), v]));
const claims = new Map(); // person key → [{bishop (record), row, sub}]
const bishopRankRows = [], skippedSelf = [];
const fate = new Map(), recFate = new Map(); // sheet row (or 'file|row' of a record later folded) → why it is not a record under its bishop (for the bishop-by-bishop reconciliation)
for (const [listName, s] of latestByBishop) {
  const bishop = bishopByList.get(listName); const seen = new Set();
  const rows = [...s.pastors]; const dropped = new Set();
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) { const a = rows[i], b = rows[j]; if (dropped.has(a) || dropped.has(b)) continue; const ka = key(a.name), kb = key(b.name); if (ka === kb) continue; if ((subsetName(ka, kb) || sameSoul(ka, kb)) && (!a.dobKeys?.length || !b.dobKeys?.length || a.dobKeys.some((d) => b.dobKeys.includes(d)) || await samePicture({ row: a, bishop }, { row: b, bishop }))) dropped.add(words(ka).length >= words(kb).length ? b : a); } // the same person twice on one sheet
  for (const r of rows) {
    if (dropped.has(r)) { fate.set(r, 'the same person twice on the sheet; one record kept'); continue; }
    const k = key(r.name); if (!k) { fate.set(r, 'blank name'); continue; } if (seen.has(k)) { fate.set(r, 'the same name twice on the sheet; one record kept'); continue; } seen.add(k);
    if (k === key(bishop.name) || k === key(listName) || subsetName(k, key(bishop.name))) { skippedSelf.push({ name: r.name, sheet: s.file }); fate.set(r, "the bishop's own row"); continue; } // the bishop's own row, under any spelling
    if (/Bishop|Mother|Episcopal/.test(r.title) || bishopKeys.has(k)) { bishopRankRows.push({ name: r.name, title: r.title, onSheetOf: bishop.name, file: s.file, row: r.row, onList: bishopKeys.has(k) }); fate.set(r, bishopKeys.has(k) ? 'a bishop on the Bishops List, not a pastor' : `titled ${r.title}, not a pastor`); continue; }
    if (removeKeys.has(k)) { fate.set(r, 'removed by the office (not a pastor)'); continue; }
    if (!claims.has(k)) claims.set(k, []); claims.get(k).push({ bishop, row: r, sub: s });
  }
}
// Spelling variants of one person claimed by two bishops are one claim set (same country or unknown).
const keys = [...claims.keys()];
// Two rows are one person when the names are the same words (any order) or one name's words all sit inside the other's,
// in the same country, and the birthdays agree (Joshua, 11 Oct: same name and same date of birth; the age stands in for a
// blank birthday) — or the group ruled on exactly these two claims. Different birthdays = two people, whatever the name.
for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) { const a = keys[i], b = keys[j]; if (!claims.has(a) || !claims.has(b)) continue; const ca = claims.get(a), cb = claims.get(b); if (ca[0].bishop === cb[0].bishop) continue; if (!(words(a).sort().join(' ') === words(b).sort().join(' ') || subsetName(a, b))) continue; { const ba = birthAgrees(ca[0].row, cb[0].row); if (ba !== true && !(ba === null && ruledTogether(ca[0], cb[0]))) continue; } claims.set(a, [...ca, ...cb]); claims.delete(b); }
for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) { const a = keys[i], b = keys[j]; if (!claims.has(a) || !claims.has(b)) continue; const ca = claims.get(a), cb = claims.get(b); if (ca[0].bishop === cb[0].bishop) continue; if (!(words(a).sort().join(' ') === words(b).sort().join(' ') || subsetName(a, b) || sameSoul(a, b))) continue; if (birthAgrees(ca[0].row, cb[0].row) === false) continue; if (await samePicture(ca[0], cb[0])) { claims.set(a, [...ca, ...cb]); claims.delete(b); } }
// Even an identical name on two sheets is two people when the birthdays (or ages) differ, or Joshua ruled them two — unless the picture says otherwise.
for (const [k, list] of claims) if (list.length > 1) { const groups = []; for (const c of list) { let g = null; for (const grp of groups) { const ba = birthAgrees(grp[0].row, c.row); if (ba !== false && (!ruledDistinct(grp[0], c) || await samePicture(grp[0], c))) { g = grp; break; } } /* different birthdays are two people, whatever the group ruled or the picture shows (Joshua, 11 Oct) */ if (g) g.push(c); else groups.push([c]); } if (groups.length > 1) { claims.set(k, groups[0]); groups.slice(1).forEach((g, n) => claims.set(`${k}#${n + 2}`, g)); } }
// Rulings
const ruleWinner = (name, list) => {
  const names = list.map((c) => key(c.bishop.name));
  const has = (n) => names.some((x) => x === key(n) || namesAlike(x, n));
  const person = rulings.people.find((p) => [name, ...list.map((c) => c.row.name)].some((n) => key(p.name) === key(n) || words(key(p.name)).sort().join(' ') === words(key(n)).sort().join(' '))); // the ruling may use either sheet's spelling
  if (person) { const w = list.find((c) => namesAlike(c.bishop.name, person.winner) || key(c.bishop.name) === key(person.winner)); if (w) return { winner: w, by: person.source }; } // a namesake claimed by other bishops is not this ruling's person
  const by = (n) => list.find((c) => key(c.bishop.name) === key(n)); // Joshua 11 Oct: Roger, Toss and Samuel Baidoo win any clash they are in
  for (const n of ['Roger Hiltbrunner', 'Toss Mills-Odoi', 'Emmanuel Samuel Baidoo']) { const w = by(n); if (w) return { winner: w, by: `Joshua 11 Oct: a clash with Bishop ${n} goes to him` }; }
  const geraldo = list.find((c) => key(c.bishop.name) === 'geraldo amoa');
  if (geraldo && has('Clement Asante') && list.some((c) => /lusaka/i.test(c.row.city || c.bishop.city))) return { winner: geraldo, by: 'Amonoo-Neizer 10 Oct: Lusaka city pastors are all directly under Bishop Geraldo Amoa' };
  const bjosh = list.find((c) => key(c.bishop.name) === 'joshua heward mills');
  if (bjosh && (has('Isaac Agyeman') || has('Paul Baidoo') || has('Frank Opoku'))) return { winner: bjosh, by: 'Sakyi 9 Oct: clashes with Isaac Agyeman, Paul Baidoo or Frank Opoku go to Bishop Joshua Heward-Mills' };
  const joy = list.find((c) => key(c.bishop.name) === 'joy bruce');
  if (joy && has('Isaac Agyeman') && list.some((c) => /kumasi/i.test(c.row.city || c.bishop.city))) return { winner: joy, by: 'Sakyi 9 Oct: First Love Kumasi pastors belong to Sister Joy Bruce' };
  if (bjosh && list.length === 2 && !/penney/i.test(name)) return { winner: list.find((c) => c !== bjosh), by: 'Joshua 11 Oct: any other clash with Bishop Joshua Heward-Mills goes to the other bishop' };
  return null;
};
const pastors = [], conflicts = [], resolved = [], rulingNotOnSheet = [];
const usedIds = new Set();
const idFor = (name, bishopName) => { const olds = oldPastorsByKey.get(key(name)) || []; const o = olds.find((x) => key(x.bishop || '') === key(bishopName) && !usedIds.has(x.id)) || olds.find((x) => !usedIds.has(x.id)); let id = o?.id || `S${createHash('sha1').update(key(name)).digest('hex').slice(0, 8)}`; if (usedIds.has(id)) id = `${id}-${createHash('sha1').update(key(bishopName)).digest('hex').slice(0, 4)}`; usedIds.add(id); return id; }; // two people with one name (different birthdays) never share an id
const usedImages = new Set();
const oldImage = (name, bishopName) => { let olds = oldPastorsByKey.get(key(name)) || []; if (!olds.length) { const alike = cont.pastors.filter((x) => x.image && subsetName(key(x.name), key(name))); if (alike.length === 1) olds = alike; } const img = (olds.find((x) => x.image && key(x.bishop || '') === key(bishopName)) || olds.find((x) => x.image && !usedImages.has(x.image)))?.image || ''; if (img) usedImages.add(img); return img; }; // one picture on file goes to one record: namesakes under another bishop do not inherit it // "Joshua Korsi Gbafa" keeps the picture filed as "Joshua Gbafa"
const make = (c, extra = {}) => { const { bishop, row } = c; const v = years.get(words(key(row.name)).sort().join(' ')); const base = { id: idFor(row.name, bishop.name), role: 'pastor', name: row.name, title: row.title || 'Pastor', organization: bishop.organization, denomination: (() => { const raw = row.denomination || ''; if (!raw) return bishop.denomination; if (bishop.denomination && nearest(raw, [bishop.denomination])) return bishop.denomination; const d = canonDen(bishop.group, raw); const pool = GROUPS[bishop.group]?.denominations || []; return !d || (bishop.denomination && denKey(bishop.denomination).startsWith(denKey(d) + ' ')) || (pool.length && !pool.some((x) => denKey(x) === denKey(d)) && bishop.organization === 'United Denominations') ? bishop.denomination : d; })(), denominationLogo: '', city: row.city || '', branch: row.branch || '', country: fixCountry(row.country) || bishop.country || '', image: oldImage(row.name, bishop.name), gender: row.gender || (/^Lady/.test(row.title) ? 'female' : ''), yearAppointed: row.yearAppointed || v?.yearAppointed || '', yearOrdained: row.yearOrdained || v?.yearOrdained || '', yearConsecrated: '', bishop: bishop.name, group: bishop.group, source: { file: c.sub.file, row: row.row }, ...extra }; return base; };
for (const [k, list] of claims) {
  if (list.length === 1) { pastors.push(make(list[0])); continue; }
  const r = ruleWinner(list[0].row.name, list);
  if (r) { pastors.push(make(r.winner)); for (const c of list) if (c !== r.winner) fate.set(c.row, `ruled to ${r.winner.bishop.name} (${r.by})`); resolved.push({ name: r.winner.row.name, winner: r.winner.bishop.name, losers: list.filter((c) => c !== r.winner).map((c) => c.bishop.name), by: r.by }); continue; }
  const first = list[0]; for (const c of list) fate.set(c.row, `claimed by ${list.map((x) => 'Bishop ' + x.bishop.name).join(' and ')} — Unclaimed for the office`);
  const rec = make(first, { bishop: '', unclaimed: `Claimed by ${list.map((c) => `Bishop ${c.bishop.name}`).join(' and ')} — the office must decide` }); pastors.push(rec);
  conflicts.push({ name: first.row.name, id: rec.id, claims: list.map((c) => ({ bishop: c.bishop.name, group: c.bishop.group, file: c.sub.file, folder: c.sub.folder, row: c.row.row, cells: c.row.cells, city: c.row.city, country: c.row.country, title: c.row.title })) });
}
// Lay Presidents (data/lay-presidents.json): not on the Bishops List, not counted as bishops, but their sheets claim pastors.
const layNames = read('data/lay-presidents.json', { names: [] }).names;
const groupByDen = new Map(Object.entries(GROUPS).flatMap(([g, v]) => v.denominations.map((d) => [denKey(d), g])));
const commonest = (list) => [...list.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map())].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
const layPresidents = [];
for (const s of nonList.filter((x) => layNames.some((n) => key(n) === key(x.bishop) || namesAlike(n, x.bishop)))) {
  const own = s.pastors.find((r) => key(r.name) === key(s.bishop)); const rows = s.pastors.filter((r) => r !== own); if (own) fate.set(own, 'the lay president\'s own row');
  const den = s.denomination || commonest(rows.map((r) => r.denomination).filter(Boolean)); const country = commonest(rows.map((r) => r.country).filter(Boolean));
  const REGION = { 'united states': 'UD North America', canada: 'UD North America', switzerland: 'UD Europe', germany: 'UD Europe', 'united kingdom': 'UD Europe', italy: 'UD Europe', spain: 'UD Europe', france: 'UD Europe', belgium: 'UD Europe', netherlands: 'UD Europe', ghana: 'UD Ghana' };
  const group = s.group || groupByDen.get(denKey(den)) || REGION[key(country)] || '';
  const o = oldPastorsByKey.get(key(s.bishop))?.[0];
  const lp = { id: o?.id || `LP${layPresidents.length + 1}`, role: 'bishop', title: 'Lay President', lay: true, name: s.bishop, organization: orgOfGroup(group || 'UD Ghana', {}), denomination: canonDen(group, den) || den, denominationLogo: '', city: own?.city || commonest(rows.map((r) => r.city).filter(Boolean)), branch: own?.branch || '', country: own?.country || commonest(rows.map((r) => r.country).filter(Boolean)), image: o?.image || '', gender: own?.gender || 'male', yearAppointed: own?.yearAppointed || '', yearOrdained: own?.yearOrdained || '', yearConsecrated: '', group, sheet: { file: s.file, folder: s.folder, noPastors: false, rows: rows.length } };
  bishops.push(lp); layPresidents.push(lp); s.lay = lp;
  for (const r of rows) { const k = key(r.name); if (!k || removeKeys.has(k) || bishopKeys.has(k)) { fate.set(r, !k ? 'blank name' : removeKeys.has(k) ? 'removed by the office (not a pastor)' : 'a bishop on the Bishops List, not a pastor'); continue; } const already = pastors.find((p) => key(p.name) === k); if (already) { fate.set(r, `already on the roll under ${already.bishop || 'Unclaimed'}`); continue; } pastors.push(make({ bishop: lp, row: r, sub: s })); }
}
// Sheets from other people who are not on the Bishops List: their pastors are unclaimed, with the name kept.
const nonListPastors = [];
for (const s of nonList.filter((x) => !x.lay)) for (const r of s.pastors) { const k = key(r.name); if (!k || removeKeys.has(k) || bishopKeys.has(k)) continue; if (pastors.some((p) => key(p.name) === k)) continue; const fake = { name: s.bishop, group: '', organization: 'United Denominations', denomination: '', country: '' }; pastors.push({ ...make({ bishop: fake, row: r, sub: s }), bishop: '', group: '', unclaimed: `Listed by ${s.bishop}, who is not on the Bishops List` }); nonListPastors.push(r.name); }
// Kent and Toss have not sent sheets: their current pastors stay as they were.
for (const n of KEEP_OLD_PASTORS) { const b = bishops.find((x) => key(x.name) === key(n)); if (!b) continue; for (const o of cont.pastors.filter((p) => key(p.bishop || '') === key(n))) if (!pastors.some((p) => p.id === o.id || key(p.name) === key(o.name))) pastors.push({ id: o.id, role: 'pastor', name: o.name, title: o.title || 'Pastor', organization: b.organization, denomination: b.denomination, denominationLogo: '', city: o.city || '', branch: '', country: o.country || b.country || '', image: o.image || '', gender: o.gender || '', yearAppointed: o.yearAppointed || '', yearOrdained: o.yearOrdained || '', yearConsecrated: '', bishop: b.name, group: b.group, source: { file: 'kept until the sheet arrives', row: 0 } }); }
// ---------- 7. Pictures from the photo folders for anyone still without one
const index = read('/tmp/photo-index.json', null) || JSON.parse(readFileSync('/tmp/photo-index.json', 'utf8'));
const indexByKey = new Map(); for (const e of index) { const k = key(e.name); if (!indexByKey.has(k)) indexByKey.set(k, []); indexByKey.get(k).push(e); }
mkdirSync(`${root}assets/portraits/thumbs`, { recursive: true });
let converted = 0, photoFromFolder = 0;
const nameCount = new Map(); for (const p of pastors) nameCount.set(key(p.name), (nameCount.get(key(p.name)) || 0) + 1);
for (const p of pastors) {
  if (p.image && existsSync(`${root}${p.image}`)) continue;
  let hits = indexByKey.get(key(p.name)) || [];
  if (!hits.length) { const sorted = words(key(p.name)).sort().join(' '); for (const [k, list] of indexByKey) if (words(k).sort().join(' ') === sorted) { hits = list; break; } }
  if (!hits.length) continue;
  const own = hits.find((h) => p.bishop && h.folder && namesAlike(h.folder, p.bishop)) || (nameCount.get(key(p.name)) > 1 ? null : hits[0]); if (!own) continue; // namesakes only take a picture from their own bishop's folder
  const rel = `assets/portraits/${p.id}.webp`;
  if (!existsSync(`${root}${rel}`)) { try { const buf = readFileSync(own.path); await sharp(buf).rotate().resize({ width: 640, withoutEnlargement: true }).webp({ quality: 75 }).toFile(`${root}${rel}`); await sharp(buf).rotate().resize({ width: 400, withoutEnlargement: true }).webp({ quality: 80 }).toFile(`${root}assets/portraits/thumbs/${p.id}.webp`); converted++; } catch { continue; } }
  p.image = rel; photoFromFolder++;
}
for (const b of bishops) if (!b.image) { const hits = (indexByKey.get(key(b.name)) || []).filter((h) => h.own) ; if (hits.length) { const rel = `assets/portraits/${b.id}.webp`; try { if (!existsSync(`${root}${rel}`)) { const buf = readFileSync(hits[0].path); await sharp(buf).rotate().resize({ width: 640, withoutEnlargement: true }).webp({ quality: 78 }).toFile(`${root}${rel}`); await sharp(buf).rotate().resize({ width: 400, withoutEnlargement: true }).webp({ quality: 80 }).toFile(`${root}assets/portraits/thumbs/${b.id}.webp`); } b.image = rel; } catch {} } }
// Official portraits the office shared on Drive (scripts/bishop-photos-from-drive.mjs) beat any other picture.
const overrides = read('data/bishop-photo-overrides.json', {});
for (const b of bishops) if (overrides[b.id] && existsSync(`${root}${overrides[b.id]}`)) b.image = overrides[b.id];
// Second look once every picture is in place: the same picture on two records under different bishops with
// alike names is one person claimed twice — settled by the rulings, otherwise Unclaimed for the office.
{
  const hashes = []; const withPic = pastors.filter((p) => p.bishop && p.image && existsSync(`${root}${p.image}`));
  for (let i = 0; i < withPic.length; i += 50) await Promise.all(withPic.slice(i, i + 50).map(async (p) => { const t = p.image.replace(/^(assets\/portraits)\/([^/]+)\.[^.]+$/, '$1/thumbs/$2.webp'); try { hashes.push([p, await dhash(`${root}${existsSync(`${root}${t}`) ? t : p.image}`)]); } catch {} }));
  const bishopOf = (name) => bishops.find((b) => b.name === name);
  const rowOfRec = (p) => subs.find((s) => s.file === p.source?.file)?.pastors.find((r) => r.row === p.source?.row);
  const gone = new Set(); let merged = 0;
  for (let i = 0; i < hashes.length; i++) for (let j = i + 1; j < hashes.length; j++) {
    const [a, ha] = hashes[i], [b, hb] = hashes[j]; if (gone.has(a.id) || gone.has(b.id) || a.bishop === b.bishop || a.image === b.image) continue; // one file on two records is no evidence
    if (hamming(ha, hb) > SAME_PICTURE) continue;
    if (birthAgrees(rowOfRec(a), rowOfRec(b)) === false) continue; // different birthdays are two people (Joshua, 11 Oct), whatever the picture
    const ka = key(a.name), kb = key(b.name); if (!(words(ka).sort().join(' ') === words(kb).sort().join(' ') || subsetName(ka, kb) || sameSoul(ka, kb))) continue;
    const list = [a, b].map((p) => ({ bishop: bishopOf(p.bishop), row: { name: p.name, city: p.city, dobKeys: [] }, sub: { file: p.source?.file || '' }, rec: p }));
    const r = ruleWinner(a.name, list);
    if (r) { const loser = list.find((c) => c !== r.winner).rec; gone.add(loser.id); recFate.set(`${loser.source?.file}|${loser.source?.row}`, `ruled to ${r.winner.bishop.name} (${r.by}, same picture)`); resolved.push({ name: r.winner.rec.name, winner: r.winner.bishop.name, losers: [loser.bishop], by: r.by + ' (same picture)' }); }
    else { gone.add(b.id); for (const p of [a, b]) recFate.set(`${p.source?.file}|${p.source?.row}`, `claimed by Bishop ${list[0].bishop.name} and Bishop ${list[1].bishop.name} (same picture) — Unclaimed for the office`); a.bishop = ''; a.unclaimed = `Claimed by Bishop ${list[0].bishop.name} and Bishop ${list[1].bishop.name} — the office must decide`; conflicts.push({ name: a.name, id: a.id, claims: list.map((c) => ({ bishop: c.bishop.name, group: c.bishop.group, file: c.sub.file, folder: '', row: c.rec.source?.row || 0, cells: [`${c.rec.name}`, c.rec.title, c.rec.city, c.rec.country, 'same picture on both sheets'], city: c.rec.city, country: c.rec.country, title: c.rec.title })) }); }
    merged++;
  }
  for (let i = pastors.length - 1; i >= 0; i--) if (gone.has(pastors[i].id)) pastors.splice(i, 1);
  if (merged) console.log(`Same picture under two bishops: ${merged} pairs (${gone.size} records folded)`);
}
// Joshua's rulings on the duplicates report (data/duplicate-rulings.json): two records that are one person become one,
// kept under the ruled bishop with the blanks filled from the record that goes.
const dupMerged = [];
for (const m of dupRulings.merge) {
  const under = bishops.find((b) => namesAlike(b.name, m.bishop) || key(b.name) === key(m.bishop));
  const all = pastors.filter((p) => key(p.name) === key(m.keep)); const keep = all.find((p) => under && p.bishop === under.name) || all[0];
  const drop = pastors.find((p) => key(p.name) === key(m.drop) && p !== keep);
  if (!keep || !drop) { dupMerged.push({ ...m, applied: false, missing: !keep ? m.keep : m.drop }); continue; }
  for (const f of ['title', 'city', 'branch', 'country', 'image', 'gender', 'yearAppointed', 'yearOrdained', 'yearConsecrated']) if (!keep[f] && drop[f]) keep[f] = drop[f];
  if (under) Object.assign(keep, { bishop: under.name, group: under.group, organization: under.organization, denomination: keep.organization === under.organization ? keep.denomination : under.denomination, unclaimed: '' });
  Object.assign(keep, m.set || {}); if (!keep.unclaimed) delete keep.unclaimed;
  pastors.splice(pastors.indexOf(drop), 1); recFate.set(`${drop.source?.file}|${drop.source?.row}`, `one person with ${m.keep}, kept under ${keep.bishop} (Joshua 11 Oct)`); dupMerged.push({ ...m, applied: true, keptId: keep.id, droppedId: drop.id, under: keep.bishop });
}
if (dupMerged.length) console.log(`Duplicate rulings: ${dupMerged.filter((m) => m.applied).length} of ${dupMerged.length} merges applied`);
// Pairs the office must still confirm (Joshua, 11 Oct): both records are Unclaimed, like any double claim, and head the report.
const dupPending = [];
for (const d of dupRulings.pending) {
  const recs = d.names.map((n) => pastors.find((p) => key(p.name) === key(n))).filter(Boolean);
  if (recs.length < 2) { dupPending.push({ ...d, applied: false }); continue; }
  const claims = recs.map((p) => ({ bishop: p.bishop || p.unclaimed, group: p.group, file: p.source?.file || '', folder: '', row: p.source?.row || 0, cells: [p.name, p.title, p.denomination, p.city, p.country].filter(Boolean), city: p.city, country: p.country, title: p.title, id: p.id }));
  const notes = recs.map((p) => { const o = recs.find((x) => x !== p); return `Possibly the same person as ${o.name}, listed by Bishop ${o.bishop || 'no one'} — the office must confirm`; });
  recs.forEach((p, i) => { recFate.set(`${p.source?.file}|${p.source?.row}`, `${notes[i]} (Joshua 11 Oct)`); p.unclaimed = notes[i]; p.bishop = ''; });
  conflicts.unshift({ name: recs.map((p) => p.name).join(' / '), id: recs[0].id, pending: true, why: d.source, claims });
  dupPending.push({ ...d, applied: true });
}
if (dupPending.length) console.log(`To confirm: ${dupPending.filter((m) => m.applied).length} of ${dupPending.length} pairs set Unclaimed for the office`);
// A thumbnail for every portrait that lacks one (the grids load thumbs; the dialog loads the full picture).
for (const p of [...bishops, ...pastors]) { if (!p.image || !/^assets\/portraits\//.test(p.image)) continue; const t = `${root}${p.image.replace('assets/portraits/', 'assets/portraits/thumbs/')}`; if (!existsSync(t) && existsSync(`${root}${p.image}`)) { try { await sharp(`${root}${p.image}`).resize({ width: 400, withoutEnlargement: true }).webp({ quality: 80 }).toFile(t); } catch {} } }
// The structure (Settings → Denominations) follows the roll: each United Denominations group lists the denominations its bishops and pastors use.
const structure = {};
for (const b of bishops.filter((x) => x.organization === 'United Denominations' && x.group)) { structure[b.group] = structure[b.group] || { organization: 'United Denominations', denominations: new Set() }; if (b.denomination) structure[b.group].denominations.add(b.denomination); }
const held = (d) => Object.values(structure).some((g) => g.denominations.has(d));
for (const p of pastors.filter((x) => x.organization === 'United Denominations' && x.group && x.denomination)) if (structure[p.group] && !held(p.denomination)) structure[p.group].denominations.add(p.denomination);
const GROUP_ENTRIES = Object.fromEntries(Object.entries(structure).map(([g, v]) => [g, { organization: v.organization, denominations: [...v.denominations].sort() }]));
writeFileSync(`${root}src/registration/groups.mjs`, `// Generated by scripts/build-roll.mjs from the Bishops List and the bishops' sheets. Do not edit by hand.\nexport const GROUPS = ${JSON.stringify(GROUP_ENTRIES, null, 2)};\n`);
// ---------- Reconcile, bishop by bishop: every row on a bishop's latest sheet is a record under them, or has a reason.
const reconcile = [];
for (const s of [...latestByBishop.values(), ...nonList.filter((x) => x.lay)]) {
  const bishop = s.lay || bishopByList.get([...latestByBishop].find(([, v]) => v === s)[0]);
  const under = pastors.filter((p) => p.bishop === bishop.name);
  const rows = s.pastors.map((r) => {
    const known = fate.get(r) || recFate.get(`${s.file}|${r.row}`); if (known) return { row: r.row, name: r.name, fate: known };
    const rec = under.find((p) => p.source?.file === s.file && p.source?.row === r.row);
    if (rec) return null;
    const k = key(r.name);
    const elsewhere = pastors.find((p) => p.source?.file === s.file && p.source?.row === r.row) || pastors.find((p) => key(p.name) === k || words(key(p.name)).sort().join(' ') === words(k).sort().join(' '));
    const ruled = resolved.find((x) => key(x.name) === k || words(key(x.name)).sort().join(' ') === words(k).sort().join(' '));
    const merged = dupMerged.find((m) => m.applied && key(m.drop) === k);
    const why = merged ? `one person with ${merged.keep}, kept under ${merged.under} (Joshua 11 Oct)` : elsewhere?.unclaimed ? `claimed by two bishops — Unclaimed for the office` : ruled ? `ruled to ${ruled.winner}: ${ruled.by}` : elsewhere ? `on the roll under ${elsewhere.bishop} (${elsewhere.name})` : 'MISSING';
    return { row: r.row, name: r.name, fate: why };
  }).filter(Boolean);
  const extra = under.filter((p) => p.source?.file !== s.file).map((p) => ({ id: p.id, name: p.name, from: p.source?.file || 'no sheet' }));
  reconcile.push({ bishop: bishop.name, lay: Boolean(s.lay), file: s.file, folder: s.folder, sheetRows: s.pastors.length, onRoll: under.length, notUnder: rows, extra });
}
const reconcileProblems = reconcile.flatMap((r) => [...r.notUnder.filter((x) => x.fate === 'MISSING').map((x) => ({ bishop: r.bishop, file: r.file, row: x.row, name: x.name, problem: 'sheet row not on the roll' })), ...r.extra.map((x) => ({ bishop: r.bishop, file: r.file, name: x.name, problem: `under the bishop but not on their sheet (from ${x.from})` }))]);
console.log(`Reconciled ${reconcile.length} sheets: ${reconcile.reduce((n, r) => n + r.sheetRows, 0)} rows → ${reconcile.reduce((n, r) => n + r.onRoll, 0)} records under their bishops, ${reconcile.reduce((n, r) => n + r.notUnder.length, 0)} rows accounted for otherwise, ${reconcileProblems.length} problems`);
// ---------- 8. Write
const people = [...bishops.filter((b) => !b.lay), ...layPresidents, ...pastors]; // lay presidents after the bishops
writeFileSync(`${root}src/registration/reference-people.json`, JSON.stringify(people.map(({ sheet, source, ...rest }) => rest)) + '\n');
const noSheet = listBishops.filter((b) => !latestByBishop.has(b.listName) && !KEEP_OLD_PASTORS.some((n) => key(n) === key(b.name) || aliasesOf(b).some((a) => key(a) === key(n))));
const report = {
  generated: new Date().toISOString(),
  totals: { bishops: bishops.length - layPresidents.length, layPresidents: layPresidents.length, pastors: pastors.length, assigned: pastors.filter((p) => !p.unclaimed).length, unclaimed: pastors.filter((p) => p.unclaimed).length, withPhoto: pastors.filter((p) => p.image).length, sheets: subs.length, bishopsWithSheet: latestByBishop.size, noPastorsSheets: [...latestByBishop.values()].filter((s) => s.noPastors).length },
  noSheet: noSheet.map((b) => ({ id: bishopByList.get(b.listName)?.id, name: bishopByList.get(b.listName)?.name || b.name, listName: b.listName, group: b.listGroup, denomination: b.listDenomination, branch: b.branch, hadPastorsBefore: cont.pastors.filter((p) => key(p.bishop || '') === key(b.old?.name || b.name)).length })),
  sheetsNotOnList: nonList.filter((s) => !s.lay).map((s) => ({ bishop: s.bishop, file: s.file, folder: s.folder, pastors: s.pastors.length, noPastors: s.noPastors })),
  rowBelongsToAnother: [...latestByBishop.values()].filter((s) => s.rowBelongsToAnother).map((s) => ({ file: s.file, bishopRowNames: s.rowBelongsToAnother })),
  bishopRankRows, skippedSelf, resolved, conflicts, nonListPastors, rulingNotOnSheet, dupMerged, dupPending, reconcile, reconcileProblems,
  rulingsNotFound: rulings.people.filter((r) => !pastors.some((p) => key(p.name) === key(r.name) || words(key(p.name)).sort().join(' ') === words(key(r.name)).sort().join(' '))).map((r) => ({ name: r.name, ruledTo: r.winner, source: r.source })),
  newBishops: bishops.filter((b) => /^BL/.test(b.id)).map((b) => b.name),
  oldBishopsNotOnList: cont.bishops.filter((o) => !bishops.some((b) => b.id === o.id)).map((o) => o.name),
  noPhoto: pastors.filter((p) => !p.image).map((p) => ({ id: p.id, name: p.name, bishop: p.bishop, group: p.group, denomination: p.denomination, place: [p.city, p.country].filter(Boolean).join(', ') })),
  photos: { fromFolders: photoFromFolder, converted },
};
mkdirSync(`${root}data/reports`, { recursive: true });
writeFileSync(`${root}data/reports/roll-build.json`, JSON.stringify(report, null, 1) + '\n');
console.log(`Roll: ${bishops.length - layPresidents.length} bishops + ${layPresidents.length} lay presidents (${report.newBishops.length} new from the list, ${report.oldBishopsNotOnList.length} dropped) · ${pastors.length} pastors (${report.totals.assigned} under a bishop, ${report.totals.unclaimed} unclaimed) · ${report.totals.withPhoto} with a picture (${photoFromFolder} from folders, ${converted} newly converted)`);
console.log(`Sheets: ${subs.length} read · ${latestByBishop.size} bishops covered · ${report.totals.noPastorsSheets} say no pastors · ${nonList.length} from people not on the list · ${noSheet.length} list bishops with no sheet (besides Kent and Toss)`);
console.log(`Conflicts: ${resolved.length} settled by the chat rulings · ${conflicts.length} left for the office · ${bishopRankRows.length} bishop-rank rows skipped · ${skippedSelf.length} self rows skipped`);
