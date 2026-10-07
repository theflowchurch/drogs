// Birthdays from the office's PASTORS DATA.xlsx (read from Downloads, never stored in the repo).
// The export holds month/day and age only ("05/13/", 36), so a birthday is "13 May · age 36".
import { existsSync } from 'node:fs';
import * as XLSX from 'xlsx'; import fs from 'node:fs'; XLSX.set_fs(fs);
import { normalName } from '../../src/registration/model.mjs';
const file = `${process.env.HOME}/Downloads/Kuriake Castle Project/01 Office source data/PASTORS DATA.xlsx`;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const rows = new Map();
if (existsSync(file)) for (const r of XLSX.utils.sheet_to_json(XLSX.readFile(file).Sheets['Sheet1'], { raw: false, defval: '' })) {
  const m = String(r.DATEOFBIRTH).match(/^(\d{1,2})\/(\d{1,2})/); if (!m) continue;
  const k = normalName(r.FULLNAME).split(' ').sort().join(' ');
  rows.set(k, [...(rows.get(k) || []), { born: `${Number(m[2])} ${MONTHS[Number(m[1]) - 1] || m[1]}`, age: String(r.AGE || ''), city: r.CITY, bishop: r.BISHOPINCHARGE }]);
}
export const birthRows = (name) => rows.get(normalName(name).split(' ').sort().join(' ')) || [];
export const birthText = (r) => (r ? `${r.born}${r.age ? ` · age ${r.age}` : ''}` : '');
// One birthday for a person: the export row in their city when the name appears more than once.
export const birthOf = (p) => { const list = birthRows(p.name); if (!list.length) return null; if (list.length === 1) return list[0]; return list.find((x) => normalName(x.city) === normalName(p.city || '')) || list[0]; };
