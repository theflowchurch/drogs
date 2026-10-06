// One workbook for the office: missing years, people without a photo, and photos that need
// replacing (from data/photo-quality.json written by scripts/photo-quality.mjs).
import { readFileSync, mkdirSync } from 'node:fs';
import * as XLSX from 'xlsx'; import fs from 'node:fs'; XLSX.set_fs(fs);
import { placeOf, titleFor } from '../src/registration/model.mjs';
const people = JSON.parse(readFileSync(new URL('../src/registration/reference-people.json', import.meta.url), 'utf8'));
import { photoProblems, quality } from './lib/photo-problems.mjs';
const sources = JSON.parse(readFileSync(new URL('../data/photo-sources.json', import.meta.url), 'utf8'));
const bishops = people.filter(p => p.role === 'bishop'), pastors = people.filter(p => p.role === 'pastor');
const who = (p) => ({ Name: p.name, Title: titleFor(p), Group: p.group || p.organization, Denomination: p.denomination || '', Place: placeOf(p), ...(p.role === 'pastor' ? { Bishop: p.bishop || '' } : {}) });
const yearsB = bishops.filter(b => !b.yearAppointed || !b.yearOrdained || !b.yearConsecrated).map(b => ({ ...who(b), 'Year appointed': b.yearAppointed || 'MISSING', 'Year ordained': b.yearOrdained || 'MISSING', 'Year consecrated': b.yearConsecrated || 'MISSING' }));
const yearsP = pastors.filter(p => !p.yearAppointed || (p.title === 'Rev.' && !p.yearOrdained)).map(p => ({ ...who(p), 'Year appointed': p.yearAppointed || 'MISSING', 'Year ordained': p.title === 'Rev.' ? (p.yearOrdained || 'MISSING') : (p.yearOrdained || '') }));
const noPhoto = people.filter(p => !p.image).map(p => ({ Role: p.role === 'bishop' ? 'Bishop' : 'Pastor', ...who(p) }));
// Photo problems, from the shared rules.
const problems = [];
for (const p of people) { if (!p.image) continue; const reasons = photoProblems(p); if (reasons.length) problems.push({ Role: p.role === 'bishop' ? 'Bishop' : 'Pastor', ...who(p), 'What is wrong': reasons.join('; '), 'Photo file': sources[p.id] || p.image }); }
const sev = (r) => (/no face|more than one/.test(r['What is wrong']) ? 0 : /attire|jacket|suit/.test(r['What is wrong']) ? 1 : 2);
problems.sort((a, b) => (a.Role === 'Bishop' ? 0 : 1) - (b.Role === 'Bishop' ? 0 : 1) || sev(a) - sev(b) || a.Name.localeCompare(b.Name));
const wb = XLSX.utils.book_new();
const add = (rows, name, widths) => { const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: 'nothing to report' }]); ws['!cols'] = widths.map(w => ({ wch: w })); XLSX.utils.book_append_sheet(wb, ws, name); };
add(yearsB, 'Bishops missing years', [30, 16, 18, 32, 26, 14, 14, 16]);
add(yearsP, 'Pastors missing years', [30, 10, 18, 32, 26, 28, 14, 14]);
add(noPhoto, 'No photo', [8, 30, 10, 18, 32, 26, 28]);
add(problems, 'Photos to replace', [8, 30, 16, 18, 32, 26, 28, 60, 80]);
const dir = `${process.env.HOME}/Downloads/Kuriake Castle Project/02 Deliverables for the office/kuriake-data-quality`; mkdirSync(dir, { recursive: true });
XLSX.writeFile(wb, `${dir}/Kuriake Castle - data to correct.xlsx`);
console.log(JSON.stringify({ bishopsMissingYears: yearsB.length, pastorsMissingYears: yearsP.length, noPhoto: noPhoto.length, photosToReplace: problems.length, bishopsToReplace: problems.filter(r => r.Role === 'Bishop').length, checked: Object.keys(quality).length }));
console.log('bishops to replace:', problems.filter(r => r.Role === 'Bishop').map(r => `${r.Name}: ${r['What is wrong']}`).join('\n  '));
