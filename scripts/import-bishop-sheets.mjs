// The sheets bishops filled in and sent back → data/bishop-submissions.json (contact-free).
// Folders are read oldest first; a bishop's newer sheet replaces an older one downstream.
// Layouts seen: the office template (bishop row, "PASTORS UNDER…", pastor rows), the same with a
// shifted header (Michael Amoh), FIRST NAME/LAST NAME columns (Nee Nunoo), "NO./FULL NAME/REV-PASTOR"
// lists (Jude Orraca-Tetteh, Harry Dodd), and a bare Name/Title/Date list (Isaac Koranteng's campus).
import * as XLSX from 'xlsx'; import fs from 'node:fs'; XLSX.set_fs(fs);
import { readdirSync, writeFileSync } from 'node:fs';
import { submittedBirthKeys, submittedSheetBanner, submittedFileOwner, selectSubmittedBishop, joinSplitBishopDetails } from './lib/submitted-sheet-authority.mjs';
const BASE = `${process.env.HOME}/Downloads/Kuriake Castle Project/01 Office source data`;
const DIRS = process.argv.length > 2 ? process.argv.slice(2) : [`${BASE}/Bishop submitted sheets`, `${BASE}/Bishop sheets - no pastors (9 Oct 2026)`, `${BASE}/Bishop submitted sheets (9 Oct 2026)`, `${BASE}/Bishop submitted sheets (10 Oct 2026)`, `${BASE}/Bishop submitted sheets (11 Oct 2026)`, `${BASE}/Bishop submitted sheets (13 Oct 2026)`];
const blank = (v) => !v || /^(missing|n\/?a|nil|none|not applicable|-+|\.)$/i.test(String(v).trim());
const clean = (v) => (blank(v) ? '' : String(v).replace(/\s+/g, ' ').trim());
const tc = (t) => clean(t).toLowerCase().replace(/(^|[\s'’(-])\p{L}/gu, (c) => c.toUpperCase());
const year = (v) => (String(v || '').match(/\b(19|20)\d\d\b/) || [''])[0];
const COLS = {
  name: /^full ?name|^name$|^name\s|full name \(/, first: /^first ?name/, last: /^last ?name|^surname/, gender: /gender|male\s*\/\s*female/, rank: /^rank|^title|rev\s*\/\s*pastor/,
  denomination: /denomination/, branch: /^branch|^campus\s*\/\s*branch/i, city: /^city|area of residence/, country: /^country/,
  dob: /date of birth|^dob/, age: /^age\b/, phone: /^number|phone|contact/, email: /e-?mail/,
  yearAppointed: /year appointed|pastoral appoint/, yearOrdained: /year ordained|ordination/, yearConsecrated: /year consecrated|consecration/,
};
// Birthdays are not stored; only keys to tell two people with one name apart. "8/11/77", "11 Aug 1977" and "11/08/1977"
// all yield the key 11-8-77 (day-month-2-digit-year) — both day/month orders are kept because sheets mix US and UK order.
const dobKeys = submittedBirthKeys;
const words_ = (n) => String(n).split(/\s+/).filter((w) => /\p{L}/u.test(w)).length;
const title = (rank, gender) => { const r = clean(rank).toLowerCase(), f = /^f/i.test(clean(gender)); if (/bishop/.test(r)) return 'Bishop'; if (/mother/.test(r)) return 'Mother'; if (/episcopal|sister/.test(r)) return 'Episcopal Sister'; if (/rev/.test(r)) return f ? 'Lady Rev.' : 'Rev.'; if (/apostle/.test(r)) return 'Apostle'; return 'Pastor'; };
const isHeader = (r) => r.filter((c) => Object.values(COLS).some((re) => re.test(c.toLowerCase().trim()))).length >= 3;
const mapHeader = (r) => { const map = {}; r.forEach((h, i) => { for (const [k, re] of Object.entries(COLS)) if (re.test(h.toLowerCase().trim()) && map[k] === undefined) map[k] = i; });
  if (map.name === undefined && map.first === undefined) { // shifted header (no name cell): names sit one column before "Gender"
    const g = map.gender ?? 1; if (g === 0) { for (const k of Object.keys(map)) map[k] += 1; map.name = 0; } else map.name = g - 1; }
  return map; };
const out = [];
for (const DIR of DIRS) for (const file of readdirSync(DIR).filter((f) => f.endsWith('.xlsx')).sort()) {
  let wb; try { wb = XLSX.readFile(`${DIR}/${file}`); } catch { console.log(`unreadable: ${file}`); continue; }
  // Every sheet of the workbook in order; a sheet called "Pastors removed" lists people the bishop took off their list.
  const removed = wb.SheetNames.filter((n) => /remov/i.test(n)).flatMap((n) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '' })).map((r) => String(r[0] || '').trim()).filter((v) => v && !/full name/i.test(v));
  const rows = wb.SheetNames.filter((n) => !/remov/i.test(n)).flatMap((n) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '' })).map((r) => r.map((c) => String(c))).filter((r) => r.some((c) => c.trim()));
  const fromFile = tc(file.replace(/\.xlsx$/, '').replace(/[-_ ]*(\d+|updated|completed|filled|copy|data)\b.*$/i, '').replace(/[-_]/g, ' ').replace(/^(bishop|episcopal sister|espiscopal sister|mother|rev)\s+/i, '').replace(/,.*$/, '').replace(/\(.*?\)/g, ''));
  const sub = { file, folder: DIR.split('/').pop(), bishop: fromFile, titleRow: '', group: '', denomination: '', bishopRow: null, noPastors: false, pastors: [], removed };
  let map = null, section = 'bishop'; const bishopRows = [], consumed = new Set();
  rows.forEach((r, rowIndex) => {
    if (consumed.has(rowIndex)) return;
    const joined = section === 'bishop' && joinSplitBishopDetails(r, rows[rowIndex + 1], map);
    if (joined) { r = joined; consumed.add(rowIndex + 1); }
    const text = r.join(' ').trim(), low = text.toLowerCase();
    const banner = submittedSheetBanner(r);
    if (banner && map) (sub.metadataRows ||= []).push({ row: rowIndex + 1, name: clean(text), kind: banner.kind });
    if (banner?.kind === 'bishop') { if (!map) sub.titleRow = clean(banner.titleRow); return; }
    if (banner?.kind === 'group') { if (!map) { sub.group = clean(banner.group); sub.denomination = clean(banner.denomination); } return; }
    if (/^no pastors? under|^none$|^no pastors?$/.test(low)) { sub.noPastors = true; return; }
    if (/pastors under/.test(low)) { section = 'pastors'; if (isHeader(r)) map = mapHeader(r.map((c, i) => (i === 0 ? 'Full Name' : c))); return; }
    if (isHeader(r)) { map = mapHeader(r); return; }
    if (!map) return;
    const g = (k) => (map[k] === undefined ? '' : r[map[k]] || '');
    // Names come without row numbers, titles or stray labels: "23 Richard Tetteh", "Bishop Luke Mensah", "Rev Samuel Boateng", "L P Nora Sewornu".
    let rawName = (map.name !== undefined ? g('name') : `${g('first')} ${g('last')}`).replace(/^[\s\d.)-]+/, '').replace(/^(bishop|rev\.?|reverend|pastor|ps\.?|lp|l\s?p|mr\.?|mrs\.?|ms\.?|dr\.?|sister|mother)\s+/i, '').replace(/^(bishop|rev\.?|reverend|pastor)\s+/i, '').trim();
    if (blank(rawName) || /^full name$/i.test(rawName) || /\bpastors?\b|under bishop|^names? /i.test(rawName) || words_(rawName) < 2) return;
    const rec = { name: tc(rawName.replace(/\s*\.\s*/g, ' ').replace(/\s*-\s*/g, '-')), gender: /^f/i.test(clean(g('gender'))) ? 'female' : /^m/i.test(clean(g('gender'))) ? 'male' : '', title: title(g('rank'), g('gender')), rawRank: clean(g('rank')), denomination: clean(g('denomination')), branch: tc(g('branch')), city: tc(g('city')), country: tc(g('country')), yearAppointed: year(g('yearAppointed')), yearOrdained: year(g('yearOrdained')), yearConsecrated: year(g('yearConsecrated')), phone: clean(g('phone')).replace(/^'+/, ''), email: clean(g('email')).toLowerCase().replace(/^(missing|n\/?a|none|-)$/, ''), dobKeys: dobKeys(g('dob')), age: (() => { const n = parseInt(clean(g('age')), 10); return n > 10 && n < 110 ? n : null; })(), row: rowIndex + 1, cells: r.filter((c) => c.trim()).map((c) => c.replace(/[\d+][\d\s\/()-]{6,}\d/g, '…').replace(/\S+@\S+/g, '…').slice(0, 40)) };
    if (section === 'bishop' && /Bishop|Mother|Episcopal/.test(rec.title)) { bishopRows.push(rec); return; }
    sub.pastors.push(rec);
  });
  sub.bishopRow = selectSubmittedBishop(bishopRows, submittedFileOwner(file));
  if (bishopRows.length > 1) sub.additionalBishopRows = bishopRows.filter(row => row !== sub.bishopRow).map(({name, row}) => ({name, row}));
  if (sub.bishopRow) sub.bishop = sub.bishopRow.name; else if (sub.titleRow) sub.bishop = sub.titleRow; // the bishop's own row beats a copied title row (Mawusi Adagbe's says "Ishmael Sam")
  if (!sub.denomination && sub.bishopRow?.denomination) sub.denomination = sub.bishopRow.denomination;
  out.push(sub);
}
writeFileSync(process.env.KC_SUBMISSIONS_OUTPUT || new URL('../data/bishop-submissions.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
const empty = out.filter((s) => !s.pastors.length && !s.noPastors);
console.log(`${out.length} sheets from ${DIRS.length} folders · ${out.reduce((n, s) => n + s.pastors.length, 0)} pastor rows · ${out.filter((s) => s.noPastors).length} say no pastors · ${empty.length} with no rows read${empty.length ? ': ' + empty.map((s) => s.file).join(', ') : ''}`);
