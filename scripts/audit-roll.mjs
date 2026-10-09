// Audit of the roll after a build: every check prints PASS or FAIL with the evidence. Exit code 1 if anything fails.
import { readFileSync, existsSync } from 'node:fs';
import * as XLSX from 'xlsx'; import fs from 'node:fs'; XLSX.set_fs(fs);
import { normalName, structureConflicts, catalogOf, titleFor, pastorsByBishop } from '../src/registration/model.mjs';
const root = new URL('..', import.meta.url).pathname;
const read = (rel) => JSON.parse(readFileSync(`${root}${rel}`, 'utf8'));
const people = read('src/registration/reference-people.json'), report = read('data/reports/roll-build.json'), subs = read('data/bishop-submissions.json');
const rulings = read('data/sheet-conflict-rulings.json'), notPastors = read('data/not-pastors.json'), lay = read('data/lay-presidents.json').names;
const list = XLSX.utils.sheet_to_json(XLSX.readFile(`${process.env.HOME}/Downloads/Kuriake Castle Project/01 Office source data/Bishops List (9 Oct 2026).xlsx`).Sheets.Sheet1, { raw: false, defval: '' }).filter((r) => r.NAME.trim());
const bishops = people.filter((p) => p.role === 'bishop' && !p.lay), lays = people.filter((p) => p.lay), pastors = people.filter((p) => p.role === 'pastor');
const key = (n) => normalName(String(n).replace(/[’'`]/g, ''));
let fails = 0; const out = [];
const check = (name, ok, evidence = '') => { out.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${evidence ? ' — ' + evidence : ''}`); if (!ok) fails++; };
// 1. Who is on the roll
check('Bishops on the roll = Bishops List', bishops.length === list.length, `${bishops.length} vs ${list.length}`);
check('Lay Presidents are exactly the three named', lays.length === 3 && lay.every((n) => lays.some((l) => key(l.name) === key(n))), lays.map((l) => l.name).join(', '));
check('Lay Presidents come after every bishop', people.findIndex((p) => p.lay) > people.findLastIndex((p) => p.role === 'bishop' && !p.lay));
check('Only men hold the title Bishop', bishops.every((b) => b.gender === 'female' ? b.title !== 'Bishop' : true), bishops.filter((b) => b.gender === 'female' && b.title === 'Bishop').map((b) => b.name).join(', '));
check('Women are Episcopal Sister (UD) or Mother (First Love, FLOW, HJC)', bishops.filter((b) => b.gender === 'female').every((b) => b.title === (b.organization === 'United Denominations' ? 'Episcopal Sister' : 'Mother')));
check('No record from the purged roster survives', !people.some((p) => /^P\d+$|^PF\d+|^PS\d+|^PB\d+/.test(p.id) && !subs.some((s) => s.pastors.some((r) => key(r.name) === key(p.name))) && !(p.bishop === 'Toss Mills-Odoi')), 'every pastor id traces to a sheet row (Toss Mills-Odoi excepted)');
check('Nobody filed under Dag Heward-Mills', !pastors.some((p) => /dag heward/i.test(p.bishop || '')));
check('No Minister Shepherd / Shepherd / Elder from the office list', !pastors.some((p) => notPastors.some((n) => key(n.name) === key(p.name))));
check('Removed names are gone', rulings.remove.every((r) => !people.some((p) => key(p.name) === key(r.name))), rulings.remove.map((r) => r.name).join(', '));
// 2. Structure of every record
const ids = new Set(); const dup = people.filter((p) => ids.has(p.id) ? true : (ids.add(p.id), false));
check('Ids are unique', dup.length === 0, dup.map((p) => p.id).join(', '));
check('Every pastor is under one bishop or Unclaimed with a reason', pastors.every((p) => Boolean(p.unclaimed) !== Boolean(p.bishop)));
const bishopNames = new Set([...bishops, ...lays].map((b) => b.name));
check("Every pastor's bishop exists on the roll", pastors.filter((p) => p.bishop).every((p) => bishopNames.has(p.bishop)), pastors.filter((p) => p.bishop && !bishopNames.has(p.bishop)).map((p) => p.bishop).slice(0, 5).join(', '));
check('Every bishop has a group and organization', [...bishops, ...lays].every((b) => b.group && b.organization), [...bishops, ...lays].filter((b) => !b.group).map((b) => b.name).join(', '));
check("Every pastor carries their bishop's group and organization", pastors.filter((p) => p.bishop).every((p) => { const b = [...bishops, ...lays].find((x) => x.name === p.bishop); return b && p.group === b.group && p.organization === b.organization; }));
check('Every title is a known one', people.every((p) => ['Bishop', 'Mother', 'Episcopal Sister', 'Lay President', 'Pastor', 'Rev.', 'Lady Rev.', 'Apostle'].includes(p.title)), [...new Set(people.map((p) => p.title))].join(', '));
check('No pastor is listed twice under the same bishop', (() => { const seen = new Set(); return !pastors.some((p) => { const k = `${key(p.name)}|${key(p.bishop || '')}`; if (seen.has(k)) return true; seen.add(k); return false; }); })());
check('No email, phone or birthday in the public file', !people.some((p) => p.email || p.phone || p.dob || p.dobKeys));
// 3. Sheets and rulings
check('Every sheet downloaded was read', report.totals.sheets === subs.length && subs.filter((s) => !s.pastors.length && !s.noPastors).length <= 3, `${subs.length} sheets; empty without a "no pastors" line: ${subs.filter((s) => !s.pastors.length && !s.noPastors).map((s) => s.file).join(', ') || 'none'}`);
check('Each named ruling that matches a sheet row is honoured', report.rulingNotOnSheet.length === 0, JSON.stringify(report.rulingNotOnSheet));
// A ruling is honoured when the ruled bishop's sheet lists the person. When it does not, the sheet stands and the office is told.
const sheetOf = (bishopName) => subs.find((s) => key(s.bishop) === key(bishopName) || key(s.bishop).includes(key(bishopName).split(' ').pop()));
for (const r of rulings.people) { const ps = pastors.filter((x) => key(x.name) === key(r.name)); if (!ps.length) continue; const ok = ps.some((p) => p.bishop && (key(p.bishop) === key(r.winner) || key(p.bishop).includes(key(r.winner).split(' ').pop()))); const listed = sheetOf(r.winner)?.pastors.some((x) => key(x.name) === key(r.name)); if (ok) check(`Ruling: ${r.name} → ${r.winner}`, true); else if (!listed) out.push(`NOTE  Ruling: ${r.name} → ${r.winner} — ${r.winner}'s sheet does not list them; left under ${ps.map((p) => p.bishop || 'Unclaimed').join(' / ')} as the sheets say`); else check(`Ruling: ${r.name} → ${r.winner}`, false, ps.map((p) => p.bishop || p.unclaimed).join(' / ')); }
const badConf = report.conflicts.filter((c) => { const p = pastors.find((x) => key(x.name) === key(c.name) && /^Claimed by/.test(x.unclaimed || '')); return !(p && c.claims.every((k) => p.unclaimed.includes(k.bishop))); });
check('Unresolved double claims are Unclaimed with both bishops named', badConf.length === 0, badConf.map((c) => c.name).join(', '));
check('Only Toss Mills-Odoi carries a pre-reset list', pastors.filter((p) => p.bishop && !subs.some((s) => s.pastors.some((r) => key(r.name) === key(p.name)))).every((p) => p.bishop === 'Toss Mills-Odoi'));
// 4. Pictures
const missing = people.filter((p) => p.image && !existsSync(`${root}${p.image}`));
check('Every picture path exists on disk', missing.length === 0, missing.slice(0, 5).map((p) => p.image).join(', '));
const noThumb = people.filter((p) => p.image && /^assets\/portraits\//.test(p.image) && !existsSync(`${root}${p.image.replace('assets/portraits/', 'assets/portraits/thumbs/')}`));
check('Every portrait has a thumbnail', noThumb.length === 0, noThumb.map((p) => p.image).join(', '));
check('Bishops without a photo are only the known two', bishops.filter((b) => !b.image).length <= 2, bishops.filter((b) => !b.image).map((b) => b.name).join(', '));
const drive = Object.keys(read('data/bishop-photo-overrides.json')).length;
check('Drive portraits applied', bishops.filter((b) => /-[0-9a-f]{8}\.webp$/.test(b.image)).length === drive, `${drive} overrides`);
// 5. Structure
const conflicts = structureConflicts(catalogOf({}), people.filter((p) => !p.unclaimed));
check('Structure conflicts', conflicts.length === 0, `${conflicts.length}: ${[...new Set(conflicts.map((c) => c.kind))].join(', ')}`);
// 6. Office views depend on these helpers
const index = pastorsByBishop(people);
check('Pastor index covers every bishop and lay president', [...bishops, ...lays].every((b) => index.has(b.id)));
check('titleFor shows Lay President', lays.every((l) => titleFor(l) === 'Lay President'));
console.log(out.join('\n'));
console.log(`\n${out.length - fails} passed · ${fails} failed`);
process.exit(fails ? 1 : 0);
