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
import { sameSoul, words } from './lib/names.mjs';
const root = new URL('..', import.meta.url).pathname;
const BASE = `${process.env.HOME}/Downloads/Kuriake Castle Project/01 Office source data`;
const read = (rel, fallback) => { try { return JSON.parse(readFileSync(`${root}${rel}`, 'utf8')); } catch { return fallback; } };
const ap = (t) => String(t || '').replace(/[’'`]/g, '');
const key = (n) => normalName(ap(n));
const tc = (t) => String(t || '').trim().replace(/\s+/g, ' ').toLowerCase().replace(/(^|[\s'’(-])\p{L}/gu, (c) => c.toUpperCase());
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
const COUNTRYISH = /^(nicaragua|columbia|colombia|vietnam|middle east|guyana|brazil|panama|costa rica|bangladesh|chile|jamaica|taiwan|american samoa|mauritius|india|malawi|gabon.*|guinea conakry|central african republic|equatorial guinea.*|cape verde|lesotho|burkina faso|seychelles|suriname|n\/?a|other international)$/i;
const denKey = (d) => normalName(d).replace(/\b(the|international|int|church|churches|chapel)\b/g, ' ').replace(/\s+/g, ' ').trim();
const canonDen = (group, raw) => { if (group === 'FLOW' || group === 'HJC') return group === 'HJC' ? 'Healing Jesus Campaign' : 'FLOW'; if (!raw || COUNTRYISH.test(raw.trim())) return group === 'Eschatos' ? 'Eschatos' : /^(UD Africa|United Islands)$/.test(group) ? 'United Cities' : ''; const pool = GROUPS[group]?.denominations || []; const hit = pool.find((d) => denKey(d) === denKey(raw)) || pool.find((d) => denKey(d).startsWith(denKey(raw)) || denKey(raw).startsWith(denKey(d))); return hit || tc(raw); };
const groupOfList = (b) => GROUP_NAME[b.listGroup.toLowerCase()] || b.listGroup;
const orgOfGroup = (g, b) => g === 'First Love' ? 'First Love' : g === 'FLOW' ? (b.old?.organization === 'HJC' ? 'HJC' : 'FLOW') : 'United Denominations';
// ---------- 4. Sheets
const subs = read('data/bishop-submissions.json', []);
for (const s of subs) if (!s.pastors.length && /no pastors/i.test(s.folder)) s.noPastors = true; // a sheet in the "no pastors" folder with nothing after the marker
const latestByBishop = new Map(); const nonList = [];
const fromFile = (f) => tc(f.replace(/\.xlsx$/, '').replace(/[-_ ]*(\d+|updated|completed|filled|copy|data)\b.*$/i, '').replace(/[-_]/g, ' ').replace(/^(bishop|episcopal sister|espiscopal sister|mother|rev)\s+/i, '').replace(/,.*$/, '').replace(/\(.*?\)/g, '').replace(/\s+(flc|first love|pastors?|jesus is the master|rpi|lsk|tamale north).*$/i, ''));
for (const s of subs) { const b = findBishop(fromFile(s.file)) || findBishop(s.bishop) || findBishop(s.titleRow || ''); if (!b) { nonList.push(s); continue; } s.bishopRef = b; if (s.bishopRow && findBishop(s.bishopRow.name) && findBishop(s.bishopRow.name) !== b) s.rowBelongsToAnother = s.bishopRow.name; latestByBishop.set(b.listName, s); } // the office named each file after its bishop; a bishop row that names someone else (Lokko's sheet carries Wisdom Ahiagah's row) is not used for details // folders are ordered oldest → newest, so the last wins
// ---------- 5. Bishops
const KEEP_OLD_PASTORS = ['Kent Njeru', 'Toss Mills-Odoi']; // not yet submitted: their current lists stay
let newBishopN = 1; const bishops = [];
for (const b of listBishops) {
  const s = latestByBishop.get(b.listName); const row = s && !s.rowBelongsToAnother ? s.bishopRow : null; const o = b.old;
  const group = groupOfList(b); const organization = orgOfGroup(group, b);
  const selfName = row?.name ? tc(stripTitle(row.name).replace(/^(es|dr|rev)\.?\s+/gi, '').replace(/^(es|dr|rev)\.?\s+/gi, '')) : '';
  const name = o?.name || (selfName && words(selfName).length >= 2 ? selfName : b.name); // our curated spelling first, then the bishop's own row, then the list
  const gender = row?.gender || o?.gender || (/^(mother|episcopal sister)/i.test(b.listName) ? 'female' : '');
  const title = row && /Mother|Episcopal/.test(row.title) ? row.title : o?.title && o.title !== 'Bishop' ? o.title : /^mother/i.test(b.listName) ? 'Mother' : /^episcopal/i.test(b.listName) ? 'Episcopal Sister' : 'Bishop';
  bishops.push({ id: o?.id || `BL${newBishopN++}`, role: 'bishop', name, title, organization, denomination: canonDen(organization === 'HJC' ? 'HJC' : group, b.listDenomination) || o?.denomination || '', denominationLogo: '', city: row?.city || b.branch || o?.city || '', branch: b.branch || row?.branch || '', country: row?.country || o?.country || (COUNTRYISH.test(b.listDenomination) && !/n\/?a|other/i.test(b.listDenomination) ? tc(b.listDenomination.replace(/\s*[–(-].*$/, '')) : ''), image: o?.image || '', gender, yearAppointed: row?.yearAppointed || o?.yearAppointed || '', yearOrdained: row?.yearOrdained || o?.yearOrdained || '', yearConsecrated: row?.yearConsecrated || o?.yearConsecrated || '', group: group === 'First Love' ? (o?.group && o.group !== 'First Love' ? o.group : 'First Love') : group, sheet: s ? { file: s.file, folder: s.folder, noPastors: Boolean(s.noPastors), rows: s.pastors.length } : null });
}
const bishopByList = new Map(listBishops.map((b, i) => [b.listName, bishops[i]]));
const bishopKeys = new Set(bishops.map((b) => key(b.name))); for (const b of listBishops) { bishopKeys.add(key(b.name)); for (const a of aliasesOf(b)) bishopKeys.add(key(a)); }
// ---------- 6. Pastors from the sheets
const rulings = read('data/sheet-conflict-rulings.json', { rules: [], people: [], remove: [] });
const removeKeys = new Set([...rulings.remove.map((r) => key(r.name)), ...read('data/not-pastors.json', []).map((n) => key(n.name))]); // Walter, plus the office's Minister Shepherds / Shepherds / Elders (7 Oct)
const years = new Map(read('data/verified-years.json', []).map((v) => [words(key(v.name)).sort().join(' '), v]));
const claims = new Map(); // person key → [{bishop (record), row, sub}]
const bishopRankRows = [], skippedSelf = [];
for (const [listName, s] of latestByBishop) {
  const bishop = bishopByList.get(listName); const seen = new Set();
  for (const r of s.pastors) {
    const k = key(r.name); if (!k || seen.has(k)) continue; seen.add(k);
    if (k === key(bishop.name) || k === key(listName)) { skippedSelf.push({ name: r.name, sheet: s.file }); continue; }
    if (/Bishop|Mother|Episcopal/.test(r.title) || bishopKeys.has(k)) { bishopRankRows.push({ name: r.name, title: r.title, onSheetOf: bishop.name, file: s.file, row: r.row, onList: bishopKeys.has(k) }); continue; }
    if (removeKeys.has(k)) continue;
    if (!claims.has(k)) claims.set(k, []); claims.get(k).push({ bishop, row: r, sub: s });
  }
}
// Spelling variants of one person claimed by two bishops are one claim set (same country or unknown).
const keys = [...claims.keys()];
// Two rows are one person when the names are the same words (any order) or one name's words all sit inside the other's,
// in the same country, and the birthdays do not disagree. Different birthdays = two people, whatever the name.
const sameDob = (x, y) => !x.length || !y.length || x.some((k) => y.includes(k));
const subsetName = (a, b) => { const A = words(a), B = words(b); if (A.length < 2 || B.length < 2) return false; return A.every((w) => B.includes(w)) || B.every((w) => A.includes(w)); };
for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) { const a = keys[i], b = keys[j]; if (!claims.has(a) || !claims.has(b)) continue; const ca = claims.get(a), cb = claims.get(b); if (ca[0].bishop === cb[0].bishop) continue; if (!(words(a).sort().join(' ') === words(b).sort().join(' ') || subsetName(a, b))) continue; const countryA = ca[0].row.country || ca[0].bishop.country, countryB = cb[0].row.country || cb[0].bishop.country; if (countryA && countryB && key(countryA) !== key(countryB)) continue; if (!sameDob(ca[0].row.dobKeys || [], cb[0].row.dobKeys || [])) continue; claims.set(a, [...ca, ...cb]); claims.delete(b); }
// Even an identical name on two sheets is two people when the birthdays differ.
for (const [k, list] of claims) if (list.length > 1) { const groups = []; for (const c of list) { const g = groups.find((grp) => sameDob(grp[0].row.dobKeys || [], c.row.dobKeys || [])); if (g) g.push(c); else groups.push([c]); } if (groups.length > 1) { claims.set(k, groups[0]); groups.slice(1).forEach((g, n) => claims.set(`${k}#${n + 2}`, g)); } }
// Rulings
const ruleWinner = (name, list) => {
  const names = list.map((c) => key(c.bishop.name));
  const has = (n) => names.some((x) => x === key(n) || namesAlike(x, n));
  const person = rulings.people.find((p) => key(p.name) === key(name) || words(key(p.name)).sort().join(' ') === words(key(name)).sort().join(' '));
  if (person) { const w = list.find((c) => namesAlike(c.bishop.name, person.winner) || key(c.bishop.name) === key(person.winner)); if (w) return { winner: w, by: person.source }; rulingNotOnSheet.push({ name, ruledTo: person.winner, claimedBy: list.map((c) => c.bishop.name), source: person.source }); }
  const bjosh = list.find((c) => key(c.bishop.name) === 'joshua heward mills');
  if (bjosh && (has('Isaac Agyeman') || has('Paul Baidoo') || has('Frank Opoku'))) return { winner: bjosh, by: 'Sakyi 9 Oct: clashes with Isaac Agyeman, Paul Baidoo or Frank Opoku go to Bishop Joshua Heward-Mills' };
  const joy = list.find((c) => key(c.bishop.name) === 'joy bruce');
  if (joy && has('Isaac Agyeman') && list.some((c) => /kumasi/i.test(c.row.city || c.bishop.city))) return { winner: joy, by: 'Sakyi 9 Oct: First Love Kumasi pastors belong to Sister Joy Bruce' };
  return null;
};
const pastors = [], conflicts = [], resolved = [], rulingNotOnSheet = [];
const idFor = (name, bishopName) => { const olds = oldPastorsByKey.get(key(name)) || []; const o = olds.length === 1 ? olds[0] : olds.find((x) => key(x.bishop || '') === key(bishopName)) || olds[0]; return o?.id || `S${createHash('sha1').update(key(name)).digest('hex').slice(0, 8)}`; };
const oldImage = (name, bishopName) => { let olds = oldPastorsByKey.get(key(name)) || []; if (!olds.length) { const alike = cont.pastors.filter((x) => x.image && namesAlike(ap(x.name), ap(name))); if (alike.length === 1) olds = alike; } return (olds.find((x) => x.image && key(x.bishop || '') === key(bishopName)) || olds.find((x) => x.image))?.image || ''; }; // "Joshua Korsi Gbafa" keeps the picture filed as "Joshua Gbafa"
const make = (c, extra = {}) => { const { bishop, row } = c; const v = years.get(words(key(row.name)).sort().join(' ')); const base = { id: idFor(row.name, bishop.name), role: 'pastor', name: row.name, title: row.title || 'Pastor', organization: bishop.organization, denomination: canonDen(bishop.group, row.denomination) || bishop.denomination, denominationLogo: '', city: row.city || '', branch: row.branch || '', country: row.country || bishop.country || '', image: oldImage(row.name, bishop.name), gender: row.gender || (/^Lady/.test(row.title) ? 'female' : ''), yearAppointed: row.yearAppointed || v?.yearAppointed || '', yearOrdained: row.yearOrdained || v?.yearOrdained || '', yearConsecrated: '', bishop: bishop.name, group: bishop.group, source: { file: c.sub.file, row: row.row }, ...extra }; return base; };
for (const [k, list] of claims) {
  if (list.length === 1) { pastors.push(make(list[0])); continue; }
  const r = ruleWinner(list[0].row.name, list);
  if (r) { pastors.push(make(r.winner)); resolved.push({ name: r.winner.row.name, winner: r.winner.bishop.name, losers: list.filter((c) => c !== r.winner).map((c) => c.bishop.name), by: r.by }); continue; }
  const first = list[0];
  pastors.push(make(first, { bishop: '', unclaimed: `Claimed by ${list.map((c) => `Bishop ${c.bishop.name}`).join(' and ')} — the office must decide` }));
  conflicts.push({ name: first.row.name, claims: list.map((c) => ({ bishop: c.bishop.name, group: c.bishop.group, file: c.sub.file, folder: c.sub.folder, row: c.row.row, cells: c.row.cells, city: c.row.city, country: c.row.country, title: c.row.title })) });
}
// Sheets from people who are not on the Bishops List: their pastors are unclaimed, with the name kept.
const nonListPastors = [];
for (const s of nonList) for (const r of s.pastors) { const k = key(r.name); if (!k || removeKeys.has(k) || bishopKeys.has(k)) continue; if (pastors.some((p) => key(p.name) === k)) continue; const fake = { name: s.bishop, group: '', organization: 'United Denominations', denomination: '', country: '' }; pastors.push({ ...make({ bishop: fake, row: r, sub: s }), bishop: '', group: '', unclaimed: `Listed by ${s.bishop}, who is not on the Bishops List` }); nonListPastors.push(r.name); }
// Kent and Toss have not sent sheets: their current pastors stay as they were.
for (const n of KEEP_OLD_PASTORS) { const b = bishops.find((x) => key(x.name) === key(n)); if (!b) continue; for (const o of cont.pastors.filter((p) => key(p.bishop || '') === key(n))) if (!pastors.some((p) => p.id === o.id || key(p.name) === key(o.name))) pastors.push({ id: o.id, role: 'pastor', name: o.name, title: o.title || 'Pastor', organization: b.organization, denomination: b.denomination, denominationLogo: '', city: o.city || '', branch: '', country: o.country || b.country || '', image: o.image || '', gender: o.gender || '', yearAppointed: o.yearAppointed || '', yearOrdained: o.yearOrdained || '', yearConsecrated: '', bishop: b.name, group: b.group, source: { file: 'kept until the sheet arrives', row: 0 } }); }
// ---------- 7. Pictures from the photo folders for anyone still without one
const index = read('/tmp/photo-index.json', null) || JSON.parse(readFileSync('/tmp/photo-index.json', 'utf8'));
const indexByKey = new Map(); for (const e of index) { const k = key(e.name); if (!indexByKey.has(k)) indexByKey.set(k, []); indexByKey.get(k).push(e); }
mkdirSync(`${root}assets/portraits/thumbs`, { recursive: true });
let converted = 0, photoFromFolder = 0;
for (const p of pastors) {
  if (p.image && existsSync(`${root}${p.image}`)) continue;
  let hits = indexByKey.get(key(p.name)) || [];
  if (!hits.length) { const sorted = words(key(p.name)).sort().join(' '); for (const [k, list] of indexByKey) if (words(k).sort().join(' ') === sorted) { hits = list; break; } }
  if (!hits.length) continue;
  const own = hits.find((h) => p.bishop && h.folder && namesAlike(h.folder, p.bishop)) || hits[0];
  const rel = `assets/portraits/${p.id}.webp`;
  if (!existsSync(`${root}${rel}`)) { try { const buf = readFileSync(own.path); await sharp(buf).rotate().resize({ width: 640, withoutEnlargement: true }).webp({ quality: 75 }).toFile(`${root}${rel}`); await sharp(buf).rotate().resize({ width: 400, withoutEnlargement: true }).webp({ quality: 80 }).toFile(`${root}assets/portraits/thumbs/${p.id}.webp`); converted++; } catch { continue; } }
  p.image = rel; photoFromFolder++;
}
for (const b of bishops) if (!b.image) { const hits = (indexByKey.get(key(b.name)) || []).filter((h) => h.own) ; if (hits.length) { const rel = `assets/portraits/${b.id}.webp`; try { if (!existsSync(`${root}${rel}`)) { const buf = readFileSync(hits[0].path); await sharp(buf).rotate().resize({ width: 640, withoutEnlargement: true }).webp({ quality: 78 }).toFile(`${root}${rel}`); await sharp(buf).rotate().resize({ width: 400, withoutEnlargement: true }).webp({ quality: 80 }).toFile(`${root}assets/portraits/thumbs/${b.id}.webp`); } b.image = rel; } catch {} } }
// ---------- 8. Write
const people = [...bishops, ...pastors];
writeFileSync(`${root}src/registration/reference-people.json`, JSON.stringify(people.map(({ sheet, source, ...rest }) => rest)) + '\n');
const noSheet = listBishops.filter((b) => !latestByBishop.has(b.listName) && !KEEP_OLD_PASTORS.some((n) => key(n) === key(b.name) || aliasesOf(b).some((a) => key(a) === key(n))));
const report = {
  generated: new Date().toISOString(),
  totals: { bishops: bishops.length, pastors: pastors.length, assigned: pastors.filter((p) => !p.unclaimed).length, unclaimed: pastors.filter((p) => p.unclaimed).length, withPhoto: pastors.filter((p) => p.image).length, sheets: subs.length, bishopsWithSheet: latestByBishop.size, noPastorsSheets: [...latestByBishop.values()].filter((s) => s.noPastors).length },
  noSheet: noSheet.map((b) => ({ id: bishopByList.get(b.listName)?.id, name: bishopByList.get(b.listName)?.name || b.name, listName: b.listName, group: b.listGroup, denomination: b.listDenomination, branch: b.branch, hadPastorsBefore: cont.pastors.filter((p) => key(p.bishop || '') === key(b.old?.name || b.name)).length })),
  sheetsNotOnList: nonList.map((s) => ({ bishop: s.bishop, file: s.file, folder: s.folder, pastors: s.pastors.length, noPastors: s.noPastors })),
  rowBelongsToAnother: [...latestByBishop.values()].filter((s) => s.rowBelongsToAnother).map((s) => ({ file: s.file, bishopRowNames: s.rowBelongsToAnother })),
  bishopRankRows, skippedSelf, resolved, conflicts, nonListPastors, rulingNotOnSheet,
  rulingsNotFound: rulings.people.filter((r) => !pastors.some((p) => key(p.name) === key(r.name) || words(key(p.name)).sort().join(' ') === words(key(r.name)).sort().join(' '))).map((r) => ({ name: r.name, ruledTo: r.winner, source: r.source })),
  newBishops: bishops.filter((b) => /^BL/.test(b.id)).map((b) => b.name),
  oldBishopsNotOnList: cont.bishops.filter((o) => !bishops.some((b) => b.id === o.id)).map((o) => o.name),
  noPhoto: pastors.filter((p) => !p.image).map((p) => ({ id: p.id, name: p.name, bishop: p.bishop, group: p.group, denomination: p.denomination, place: [p.city, p.country].filter(Boolean).join(', ') })),
  photos: { fromFolders: photoFromFolder, converted },
};
mkdirSync(`${root}data/reports`, { recursive: true });
writeFileSync(`${root}data/reports/roll-build.json`, JSON.stringify(report, null, 1) + '\n');
console.log(`Roll: ${bishops.length} bishops (${report.newBishops.length} new from the list, ${report.oldBishopsNotOnList.length} dropped) · ${pastors.length} pastors (${report.totals.assigned} under a bishop, ${report.totals.unclaimed} unclaimed) · ${report.totals.withPhoto} with a picture (${photoFromFolder} from folders, ${converted} newly converted)`);
console.log(`Sheets: ${subs.length} read · ${latestByBishop.size} bishops covered · ${report.totals.noPastorsSheets} say no pastors · ${nonList.length} from people not on the list · ${noSheet.length} list bishops with no sheet (besides Kent and Toss)`);
console.log(`Conflicts: ${resolved.length} settled by the chat rulings · ${conflicts.length} left for the office · ${bishopRankRows.length} bishop-rank rows skipped · ${skippedSelf.length} self rows skipped`);
