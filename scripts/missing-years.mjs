// One workbook: bishops and pastors missing a year appointed, ordained or consecrated.
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx'; import fs from 'node:fs'; XLSX.set_fs(fs);
import { placeOf, titleFor, bySurname } from '../src/registration/model.mjs';
const people = JSON.parse(readFileSync(new URL('../src/registration/reference-people.json', import.meta.url), 'utf8'));
const M = 'MISSING', y = (v) => v || M;
const order = (a, b) => (a.group || a.organization || '').localeCompare(b.group || b.organization || '') || (a.bishop || '').localeCompare(b.bishop || '') || bySurname(a, b);
const bishops = people.filter((p) => p.role === 'bishop' && (!p.yearAppointed || !p.yearOrdained || !p.yearConsecrated)).sort(order)
  .map((b) => ({ Bishop: b.name, Title: titleFor(b), Group: b.group || b.organization, Denomination: b.denomination || '', Place: placeOf(b), 'Year Appointed': y(b.yearAppointed), 'Year Ordained': y(b.yearOrdained), 'Year Consecrated': y(b.yearConsecrated) }));
const pastors = people.filter((p) => p.role === 'pastor' && (!p.yearAppointed || (p.title === 'Rev.' && !p.yearOrdained))).sort(order)
  .map((p) => ({ Pastor: p.name, Title: titleFor(p), Group: p.group || p.organization, Denomination: p.denomination || '', Bishop: p.bishop || M, Place: placeOf(p), 'Year Appointed': y(p.yearAppointed), 'Year Ordained': p.title === 'Rev.' ? y(p.yearOrdained) : (p.yearOrdained || '') }));
const wb = XLSX.utils.book_new();
const add = (rows, name, widths) => { const ws = XLSX.utils.json_to_sheet(rows); ws['!cols'] = widths.map((w) => ({ wch: w })); XLSX.utils.book_append_sheet(wb, ws, name); };
add(bishops, 'Bishops Missing Years', [30, 16, 18, 34, 26, 14, 14, 16]);
add(pastors, 'Pastors Missing Years', [30, 10, 18, 34, 28, 26, 14, 14]);
const summary = [...new Set(people.map((p) => p.group || p.organization))].sort().map((g) => ({ Group: g, 'Bishops Missing A Year': bishops.filter((b) => b.Group === g).length, 'Pastors Missing A Year': pastors.filter((p) => p.Group === g).length }));
add([...summary, { Group: 'TOTAL', 'Bishops Missing A Year': bishops.length, 'Pastors Missing A Year': pastors.length }], 'Summary', [24, 22, 22]);
// What the office's verified-dates form could not be applied automatically (data/reports/verified-years.json, written by build-reference).
const v = JSON.parse(readFileSync(new URL('../data/reports/verified-years.json', import.meta.url), 'utf8'));
const rank = (r) => ({ pastor: 'Pastor', reverend: 'Rev.', bishop: 'Bishop', mother: 'Mother' })[r] || r;
add(v.unmatched.map((u) => ({ 'Name On The Form': u.name, Country: u.country, 'Rank On The Form': rank(u.rank), 'Year Appointed': u.yearAppointed, 'Year Ordained': u.yearOrdained, 'Year Consecrated': u.yearConsecrated, Submitted: u.submitted })), 'Form Names Not Found', [34, 20, 16, 14, 14, 16, 20]);
add(v.rankDiffers.map((u) => ({ 'Name On The Form': u.name, 'Rank On The Form': rank(u.rank), 'Our Record': u.record, 'Our Title': u.recordTitle, Country: u.country })), 'Rank Differs From Record', [34, 16, 34, 16, 20]);
add(v.kept.map((u) => ({ Name: u.name, Field: u.field.replace('year', 'Year '), 'Our Record': u.record, 'On The Form': u.form, 'Rank On The Form': rank(u.formRank), 'Our Title': u.recordTitle })), 'Years Not Changed', [34, 18, 12, 12, 16, 14]);
add(v.changed.map((u) => ({ Name: u.name, Field: u.field.replace('year', 'Year '), Was: u.was, Now: u.now })), 'Years Corrected', [34, 18, 10, 10]);
XLSX.writeFile(wb, `${process.env.HOME}/Downloads/Kuriake Castle Project/02 Deliverables for the office/Kuriake Castle - missing years.xlsx`);
console.log(`bishops ${bishops.length} · pastors ${pastors.length} → Kuriake Castle Project/02 Deliverables for the office`);
