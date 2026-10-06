// One workbook: bishops and pastors missing a year appointed, ordained or consecrated.
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx'; import fs from 'node:fs'; XLSX.set_fs(fs);
import { placeOf, titleFor, bySurname } from '../src/registration/model.mjs';
const people = JSON.parse(readFileSync(new URL('../src/registration/reference-people.json', import.meta.url), 'utf8'));
const M = 'MISSING', y = (v) => v || M;
const order = (a, b) => (a.group || a.organization || '').localeCompare(b.group || b.organization || '') || (a.bishop || '').localeCompare(b.bishop || '') || bySurname(a, b);
const bishops = people.filter((p) => p.role === 'bishop' && (!p.yearAppointed || !p.yearOrdained || !p.yearConsecrated)).sort(order)
  .map((b) => ({ Bishop: b.name, Title: titleFor(b), Group: b.group || b.organization, Denomination: b.denomination || '', Place: placeOf(b), 'Year appointed': y(b.yearAppointed), 'Year ordained': y(b.yearOrdained), 'Year consecrated': y(b.yearConsecrated) }));
const pastors = people.filter((p) => p.role === 'pastor' && (!p.yearAppointed || (p.title === 'Rev.' && !p.yearOrdained))).sort(order)
  .map((p) => ({ Pastor: p.name, Title: titleFor(p), Group: p.group || p.organization, Denomination: p.denomination || '', Bishop: p.bishop || M, Place: placeOf(p), 'Year appointed': y(p.yearAppointed), 'Year ordained': p.title === 'Rev.' ? y(p.yearOrdained) : (p.yearOrdained || '') }));
const wb = XLSX.utils.book_new();
const add = (rows, name, widths) => { const ws = XLSX.utils.json_to_sheet(rows); ws['!cols'] = widths.map((w) => ({ wch: w })); XLSX.utils.book_append_sheet(wb, ws, name); };
add(bishops, 'Bishops missing years', [30, 16, 18, 34, 26, 14, 14, 16]);
add(pastors, 'Pastors missing years', [30, 10, 18, 34, 28, 26, 14, 14]);
const summary = [...new Set(people.map((p) => p.group || p.organization))].sort().map((g) => ({ Group: g, 'Bishops missing a year': bishops.filter((b) => b.Group === g).length, 'Pastors missing a year': pastors.filter((p) => p.Group === g).length }));
add([...summary, { Group: 'TOTAL', 'Bishops missing a year': bishops.length, 'Pastors missing a year': pastors.length }], 'Summary', [24, 22, 22]);
XLSX.writeFile(wb, `${process.env.HOME}/Downloads/Kuriake Castle - missing years.xlsx`);
console.log(`bishops ${bishops.length} · pastors ${pastors.length} → ~/Downloads/Kuriake Castle - missing years.xlsx`);
