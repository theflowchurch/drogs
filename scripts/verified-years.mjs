// The office's Google Form "First Love - Consecration, Appointment and Ordination dates"
// (Responses) → data/verified-years.json. The form branches by rank, so the same fact
// sits in different columns; this folds them into one year each. Later answers win.
import * as XLSX from 'xlsx'; import fs from 'node:fs'; XLSX.set_fs(fs);
import { writeFileSync } from 'node:fs';
const file = process.argv[2] || `${process.env.HOME}/Downloads/Kuriake Castle Project/01 Office source data/First Love - Consecration, Appointment and Ordination t dates (Responses).xlsx`;
const wb = XLSX.readFile(file);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false });
const hdr = rows[0].map((h) => String(h || '').trim().toLowerCase());
const cols = (word) => hdr.map((h, i) => (h.includes(word) ? i : -1)).filter((i) => i >= 0);
const C = { yearAppointed: cols('appointment'), yearOrdained: cols('ordination'), yearConsecrated: cols('consecration') };
const year = (v) => (String(v || '').match(/\b(19|20)\d\d\b/) || [''])[0]; // "11th September 2023", "21.05.2021", "N/A" → 2023, 2021, ''
const RANK = { pastor: 'pastor', reverend: 'reverend', bishop: 'bishop', mother: 'mother' };
const key = (n) => String(n || '').trim().toLowerCase().replace(/\s+/g, ' ');
const out = new Map();
for (const r of rows.slice(1)) {
  const name = String(r[1] || '').trim().replace(/\s+/g, ' ');
  if (!name) continue;
  const rec = out.get(key(name)) || { name, country: '', rank: '', yearAppointed: '', yearOrdained: '', yearConsecrated: '', submitted: '' };
  rec.country = String(r[2] || '').trim() || rec.country;
  rec.rank = RANK[String(r[3] || '').trim().toLowerCase()] || rec.rank;
  for (const [k, idx] of Object.entries(C)) { const v = idx.map((i) => year(r[i])).find(Boolean); if (v) rec[k] = v; }
  rec.submitted = r[0];
  out.set(key(name), rec);
}
const list = [...out.values()];
writeFileSync(new URL('../data/verified-years.json', import.meta.url), JSON.stringify(list, null, 1) + '\n');
console.log(`${rows.length - 1} responses → ${list.length} people (${list.filter((x) => x.rank === 'bishop' || x.rank === 'mother').length} bishops/mothers, ${list.filter((x) => x.rank === 'reverend').length} reverends, ${list.filter((x) => x.rank === 'pastor').length} pastors); no usable year: ${list.filter((x) => !x.yearAppointed && !x.yearOrdained && !x.yearConsecrated).map((x) => x.name).join(', ') || 'none'}`);
