// One spreadsheet per bishop (their own line, then every pastor under them), zipped for the office.
import { readFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as XLSX from 'xlsx'; import fs from 'node:fs'; XLSX.set_fs(fs);
import { pastorsOf, titleFor, bySurname, normalName, namesAlike } from '../src/registration/model.mjs';
const root = new URL('..', import.meta.url).pathname;
const people = JSON.parse(readFileSync(`${root}src/registration/reference-people.json`, 'utf8'));
const contacts = JSON.parse(readFileSync(`${root}data/reference-contacts.json`, 'utf8'));
const sheet = JSON.parse(readFileSync(`${root}data/pastors-sheet-2026.json`, 'utf8')).rows;
const ageOf = new Map(); for (const r of sheet) if (r.age) ageOf.set(normalName(r.fullName), r.age);
const M = 'MISSING';
const v = (x) => (x === undefined || x === null || String(x).trim() === '' ? M : String(x).trim());
const gender = (p) => p.gender === 'female' ? 'Female' : p.gender === 'male' ? 'Male' : M;
const row = (p) => ({
  'Full Name': v(p.name), 'Gender': gender(p), 'Rank': v(titleFor(p)), 'Number': v(contacts[p.id]?.phone), 'Date of Birth': M, 'Age (office sheet)': v(ageOf.get(normalName(p.name))),
  'Denomination': v(p.denomination), 'Branch': v(p.branch), 'City': v(p.city), 'Country': v(p.country), 'Year appointed': v(p.yearAppointed), 'Year ordained': v(p.yearOrdained), ...(p.role === 'bishop' ? { 'Year consecrated': v(p.yearConsecrated) } : {}), 'Photo on file': p.image ? 'Yes' : 'No', 'Email': v(contacts[p.id]?.email),
});
const dir = `${process.env.HOME}/Downloads/kuriake-bishop-sheets`; rmSync(dir, { recursive: true, force: true }); mkdirSync(`${dir}/Bishops and their pastors`, { recursive: true });
const safe = (s) => s.replace(/[\/\\:*?"<>|]/g, '-');
const bishops = people.filter((p) => p.role === 'bishop').sort(bySurname);
let withNone = 0;
for (const b of bishops) {
  const label = `${titleFor(b)} ${b.name}`;
  const ps = pastorsOf(b, people).sort(bySurname);
  const aoa = [[label], [`${b.group || b.organization}${b.denomination ? ' · ' + b.denomination : ''}`], []];
  const bRow = row(b); aoa.push(Object.keys(bRow)); aoa.push(Object.values(bRow)); aoa.push([]);
  aoa.push([`PASTORS UNDER ${label.toUpperCase()} (${ps.length})`]);
  if (ps.length) { const rows = ps.map(row); aoa.push(Object.keys(rows[0])); for (const r of rows) aoa.push(Object.values(r)); }
  else { aoa.push(['NO PASTORS UNDER THEM']); withNone++; }
  const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = [34, 9, 16, 18, 14, 16, 36, 22, 20, 18, 14, 13, 15, 13, 32].map((w) => ({ wch: w }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Pastors'); XLSX.writeFile(wb, `${dir}/Bishops and their pastors/${safe(label)}.xlsx`);
}
// Index workbook: every bishop with their count and file name.
const idx = bishops.map((b) => ({ 'Bishop': `${titleFor(b)} ${b.name}`, 'Group': b.group || b.organization, 'Denomination': v(b.denomination), 'Country': v(b.country), 'Pastors': pastorsOf(b, people).length, 'File': `${safe(`${titleFor(b)} ${b.name}`)}.xlsx` }));
const iw = XLSX.utils.book_new(); const iws = XLSX.utils.json_to_sheet(idx); iws['!cols'] = [40, 20, 36, 18, 9, 48].map((w) => ({ wch: w })); XLSX.utils.book_append_sheet(iw, iws, 'Index'); XLSX.writeFile(iw, `${dir}/INDEX - all bishops.xlsx`);
execFileSync('zip', ['-qr', `${process.env.HOME}/Downloads/Kuriake Castle - bishops and their pastors.zip`, '.'], { cwd: dir });
console.log(`${bishops.length} bishop files (${withNone} with no pastors) → ~/Downloads/Kuriake Castle - bishops and their pastors.zip`);
