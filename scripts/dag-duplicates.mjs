// First Love pastors whose "bishop in charge" is still Dag Heward-Mills come from the old roster; most are the same
// people who now sit under a real First Love bishop with a fuller or respelled name. One workbook for the office.
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx'; import fs from 'node:fs'; XLSX.set_fs(fs);
import { namesAlike, placeOf, titleFor, bySurname } from '../src/registration/model.mjs';
import { sameSoul, words } from './lib/names.mjs';
const people = JSON.parse(readFileSync(new URL('../src/registration/reference-people.json', import.meta.url), 'utf8'));
const dag = people.filter((p) => p.role === 'pastor' && /dag heward/i.test(p.bishop || '')).sort(bySurname);
const others = people.filter((p) => p.role === 'pastor' && !/dag heward/i.test(p.bishop || ''));
const how = (a, b) => { const A = words(a.name).join(' '), B = words(b.name).join(' '); if (A === B) return 'Same name'; if ([...words(a.name)].sort().join() === [...words(b.name)].sort().join()) return 'Same name, other order'; if (namesAlike(a.name, b.name)) return words(a.name).length !== words(b.name).length ? 'Fuller or shorter form of the name' : 'Spelling differs'; return 'Spelling differs'; };
const rows = [], none = [];
for (const d of dag) {
  // Two-word names only count on a near-exact match: "Erica Lamptey" is not "Eric Lartey".
  const hits = others.filter((o) => namesAlike(d.name, o.name) || (sameSoul(d.name, o.name) && Math.max(words(d.name).length, words(o.name).length) > 2)).filter((o) => !o.country || !d.country || words(o.country)[0] === words(d.country)[0]);
  if (!hits.length) { none.push(d); continue; }
  for (const o of hits) rows.push({ 'Under Dag Heward-Mills': d.name, 'Title': titleFor(d), 'Place': placeOf(d), 'Looks Like': o.name, 'Their Title': titleFor(o), 'Their Bishop': o.bishop || (o.unclaimed ? 'Unclaimed' : ''), 'Their Denomination': o.denomination, 'Their Place': placeOf(o), 'How They Match': how(d, o), 'Confidence': namesAlike(d.name, o.name) || words(d.name).join() === words(o.name).join() ? 'High' : 'Check', 'Same Place': words(placeOf(d)).join() === words(placeOf(o)).join() ? 'Yes' : 'No', 'Record': d.id, 'Their Record': o.id });
}
const wb = XLSX.utils.book_new();
const add = (list, name, widths) => { const ws = XLSX.utils.json_to_sheet(list.length ? list : [{ Note: 'Nothing to list' }]); ws['!cols'] = widths.map((w) => ({ wch: w })); XLSX.utils.book_append_sheet(wb, ws, name); };
add(rows, 'Suspected Duplicates', [30, 10, 26, 30, 10, 28, 24, 26, 30, 10, 10, 8, 10]);
add(none.map((d) => ({ Name: d.name, Title: titleFor(d), Denomination: d.denomination, Place: placeOf(d), Record: d.id })), 'No Match Found', [30, 10, 24, 28, 8]);
add([{ 'Pastors under Dag Heward-Mills': dag.length, 'With a look-alike elsewhere': dag.length - none.length, 'Suspected pairs': rows.length, 'No look-alike': none.length }], 'Summary', [30, 26, 16, 14]);
const out = `${process.env.HOME}/Downloads/Kuriake Castle Project/02 Deliverables for the office/Kuriake Castle - Dag Heward-Mills suspected duplicates.xlsx`;
XLSX.writeFile(wb, out);
console.log(`${dag.length} under Dag Heward-Mills · ${dag.length - none.length} have a look-alike (${rows.length} pairs) · ${none.length} none → ${out.split('/').pop()}`);
for (const r of rows) console.log(`  ${r.Confidence === 'High' ? '✓' : '?'} ${r['Under Dag Heward-Mills']} (${r.Place})  ~  ${r['Looks Like']} (${r['Their Place']}; ${r['Their Bishop']})  [${r['How They Match']}]`);
