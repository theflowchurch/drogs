// The sheets bishops filled in and sent back (Drive folder → ~/Downloads/Kuriake Castle Project/
// 01 Office source data/Bishop submitted sheets/*.xlsx) → data/bishop-submissions.json, contact-free.
// A submitted sheet is the whole truth for that bishop: who is under them and where they are.
import * as XLSX from 'xlsx'; import fs from 'node:fs'; XLSX.set_fs(fs);
import { readdirSync, writeFileSync } from 'node:fs';
const DIR = process.argv[2] || `${process.env.HOME}/Downloads/Kuriake Castle Project/01 Office source data/Bishop submitted sheets`;
const blank = (v) => !v || /^(missing|n\/?a|nil|none|-+)$/i.test(String(v).trim());
const clean = (v) => (blank(v) ? '' : String(v).replace(/\s+/g, ' ').trim());
const tc = (t) => clean(t).toLowerCase().replace(/(^|[\s'’-])\p{L}/gu, (c) => c.toUpperCase());
const year = (v) => (String(v || '').match(/\b(19|20)\d\d\b/) || [''])[0];
const COLS = { name: /full name/, gender: /gender|male\s*\/\s*female/, rank: /^rank|rev\s*\/\s*pastor/, denomination: /denomination/, branch: /branch/, city: /city/, country: /country/, yearAppointed: /year appointed/, yearOrdained: /year ordained/, yearConsecrated: /year consecrated/ };
const title = (rank, gender) => { const r = clean(rank).toLowerCase(), f = /^f/i.test(clean(gender)); if (/bishop/.test(r)) return 'Bishop'; if (/mother/.test(r)) return 'Mother'; if (/episcopal|sister/.test(r)) return 'Episcopal Sister'; if (/rev/.test(r)) return f ? 'Lady Rev.' : 'Rev.'; if (/apostle/.test(r)) return 'Apostle'; return 'Pastor'; };
const out = [];
for (const file of readdirSync(DIR).filter((f) => f.endsWith('.xlsx')).sort()) {
  const wb = XLSX.readFile(`${DIR}/${file}`);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' }).map((r) => r.map((c) => String(c))).filter((r) => r.some((c) => c.trim()));
  const sub = { file, bishop: tc(file.replace(/\.xlsx$/, '').replace(/[-_ ]*(\d+|updated|vietnam)$/i, '').replace(/^(bishop|episcopal sister|mother)\s+/i, '').replace(/,.*$/, '')), group: '', denomination: '', bishopRow: null, pastors: [] };
  let map = null, section = 'bishop';
  for (const r of rows) {
    const text = r.join(' ').trim(), low = text.toLowerCase();
    if (/^(bishop|episcopal sister|mother)\s/i.test(text) && !map) { sub.bishop = clean(text.replace(/^(bishop|episcopal sister|mother)\s+/i, '')); continue; }
    if (/ · /.test(text) && !map) { const [g, d] = text.split(' · '); sub.group = clean(g); sub.denomination = clean(d); continue; }
    if (/^ud (ghana|africa|europe|north america)$/i.test(text.trim())) { sub.group = clean(text); continue; }
    if (/pastors under/.test(low)) { section = 'pastors'; continue; }
    if (/full name/.test(low)) { map = {}; r.forEach((h, i) => { for (const [k, re] of Object.entries(COLS)) if (re.test(h.toLowerCase().trim()) && map[k] === undefined) map[k] = i; }); continue; }
    if (!map || map.name === undefined || blank(r[map.name])) continue;
    const g = (k) => (map[k] === undefined ? '' : r[map[k]]);
    const rec = { name: tc(clean(g('name')).replace(/\s*\.\s*/g, ' ').replace(/\s*-\s*/g, '-')), gender: /^f/i.test(clean(g('gender'))) ? 'female' : /^m/i.test(clean(g('gender'))) ? 'male' : '', title: title(g('rank'), g('gender')), denomination: clean(g('denomination')), branch: tc(g('branch')), city: tc(g('city')), country: tc(g('country')), yearAppointed: year(g('yearAppointed')), yearOrdained: year(g('yearOrdained')), yearConsecrated: year(g('yearConsecrated')) };
    if (section === 'bishop' && /Bishop|Mother|Episcopal/.test(rec.title)) { sub.bishopRow = rec; continue; }
    sub.pastors.push(rec);
  }
  if (!sub.denomination && sub.bishopRow?.denomination) sub.denomination = sub.bishopRow.denomination;
  out.push(sub);
}
writeFileSync(new URL('../data/bishop-submissions.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
for (const s of out) console.log(`${s.bishop.padEnd(32)} ${String(s.pastors.length).padStart(3)} pastors · ${s.group || '?'} · ${s.denomination || '?'}${s.bishopRow ? '' : ' · (no bishop row)'}`);
