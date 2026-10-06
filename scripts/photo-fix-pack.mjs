// The zip for the office: the photos PDF (bishops first), the no-photo PDF, and one workbook with
// three sheets — bishops to update their photo, pastors to update theirs, pastors with no photo.
import { readFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as XLSX from 'xlsx'; import fs from 'node:fs'; XLSX.set_fs(fs);
import { placeOf, titleFor, bySurname } from '../src/registration/model.mjs';
import { photoProblems } from './lib/photo-problems.mjs';
const root = new URL('..', import.meta.url).pathname;
const people = JSON.parse(readFileSync(`${root}src/registration/reference-people.json`, 'utf8'));
const row = (p, why) => ({ Name: p.name, Title: titleFor(p), Group: p.group || p.organization, Denomination: p.denomination || '', Place: placeOf(p), ...(p.role === 'pastor' ? { Bishop: p.bishop || '' } : {}), ...(why ? { 'What is wrong': why } : {}) });
const bishops = people.filter((p) => p.role === 'bishop' && p.image && photoProblems(p).length).sort(bySurname).map((p) => row(p, photoProblems(p).join('; ')));
const pastors = people.filter((p) => p.role === 'pastor' && p.image && photoProblems(p).length).sort((a, b) => (a.group || '').localeCompare(b.group || '') || (a.bishop || '').localeCompare(b.bishop || '') || bySurname(a, b)).map((p) => row(p, photoProblems(p).join('; ')));
const none = people.filter((p) => p.role === 'pastor' && !p.image).sort((a, b) => (a.group || '').localeCompare(b.group || '') || (a.bishop || '').localeCompare(b.bishop || '') || bySurname(a, b)).map((p) => row(p));
const wb = XLSX.utils.book_new();
const add = (rows, name, widths) => { const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: 'nothing to report' }]); ws['!cols'] = widths.map((w) => ({ wch: w })); XLSX.utils.book_append_sheet(wb, ws, name); };
add(bishops, 'Bishops - update photo', [30, 16, 18, 32, 26, 50]);
add(pastors, 'Pastors - update photo', [30, 10, 18, 32, 26, 28, 60]);
add(none, 'Pastors - no photo', [30, 10, 18, 32, 26, 28]);
const base = `${process.env.HOME}/Downloads/Kuriake Castle Project/02 Deliverables for the office`; const dir = `${base}/kuriake-photo-fix`; rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
XLSX.writeFile(wb, `${dir}/Kuriake Castle - photos to fix.xlsx`);
const q = `${base}/kuriake-data-quality`;
copyFileSync(`${q}/Kuriake Castle - Photos to replace.pdf`, `${dir}/Kuriake Castle - Photos to replace (with pictures).pdf`);
copyFileSync(`${q}/Kuriake Castle - Pastors - no photo.pdf`, `${dir}/Kuriake Castle - Pastors with no photo.pdf`);
execFileSync('zip', ['-qrj', `${base}/Kuriake Castle - photos to fix.zip`, dir]);
console.log(JSON.stringify({ bishopsToUpdate: bishops.length, pastorsToUpdate: pastors.length, pastorsNoPhoto: none.length }), '→ Kuriake Castle Project/02 Deliverables for the office');
