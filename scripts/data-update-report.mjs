// One workbook for the office after a data update: who is unclaimed and why, who moved under
// a sheet's bishop, who was added from a sheet, and which duplicates were removed.
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx'; import fs from 'node:fs'; XLSX.set_fs(fs);
import { placeOf, titleFor, bySurname } from '../src/registration/model.mjs';
const people = JSON.parse(readFileSync(new URL('../src/registration/reference-people.json', import.meta.url), 'utf8'));
const dupes = JSON.parse(readFileSync(new URL('../data/duplicate-removals.json', import.meta.url), 'utf8')).removals;
const wb = XLSX.utils.book_new();
const add = (rows, name, widths) => { const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: 'Nothing to list' }]); ws['!cols'] = widths.map((w) => ({ wch: w })); XLSX.utils.book_append_sheet(wb, ws, name); };
const row = (p) => ({ Name: p.name, Title: titleFor(p), Group: p.group || p.organization, Denomination: p.denomination || '', Place: placeOf(p) });
const unclaimed = people.filter((p) => p.unclaimed).sort((a, b) => a.unclaimed.localeCompare(b.unclaimed) || bySurname(a, b));
add(unclaimed.map((p) => ({ ...row(p), 'Why Unclaimed': p.unclaimed })), 'Unclaimed Pastors', [30, 12, 18, 34, 26, 48]);
add(people.filter((p) => p.source === 'bishop sheet').sort(bySurname).map((p) => ({ ...row(p), Bishop: p.bishop || '' })), 'Added From Sheets', [30, 12, 18, 34, 26, 28]);
const byId = new Map(people.map((p) => [p.id, p]));
add(dupes.map((d) => ({ 'Removed Record': d.id, 'Kept As': byId.get(d.keep)?.name || d.keep, Reason: d.reason })), 'Duplicates Removed', [16, 30, 60]);
// Looser look-alikes the rules did not remove: two name words in common under the same bishop. For the office to judge.
import { normalName } from '../src/registration/model.mjs';
const w = (n) => normalName(n).split(' ').filter((x) => x.length > 1);
const maybe = [];
for (const b of new Set(people.filter((p) => p.role === 'pastor' && p.bishop).map((p) => p.bishop))) {
  const list = people.filter((p) => p.role === 'pastor' && p.bishop === b);
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { const A = w(list[i].name), B = new Set(w(list[j].name)); if (A.filter((x) => B.has(x)).length >= 2) maybe.push({ 'Name A': list[i].name, 'Name B': list[j].name, Bishop: b, 'Place A': placeOf(list[i]), 'Place B': placeOf(list[j]) }); }
}
add(maybe.sort((a, b) => a.Bishop.localeCompare(b.Bishop)), 'Possible Duplicates', [30, 30, 28, 24, 24]);
const summary = Object.entries(unclaimed.reduce((m, p) => m.set(p.unclaimed, (m.get(p.unclaimed) || 0) + 1), new Map())).map(([k, v]) => ({ 'Why Unclaimed': k, Pastors: v }));
add([...summary, { 'Why Unclaimed': 'TOTAL', Pastors: unclaimed.length }], 'Summary', [52, 10]);
const out = `${process.env.HOME}/Downloads/Kuriake Castle Project/02 Deliverables for the office/Kuriake Castle - data update ${new Date().toISOString().slice(0, 10)}.xlsx`;
XLSX.writeFile(wb, out);
console.log(`${unclaimed.length} unclaimed · ${people.filter((p) => p.source === 'bishop sheet').length} added from sheets · ${dupes.length} duplicates → ${out.split('/').pop()}`);
