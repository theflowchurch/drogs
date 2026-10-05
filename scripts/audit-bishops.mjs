// Where do the office's photo folders and the official list disagree with the roll
// about which bishop a pastor is under? Writes data/folder-bishops.json (pastor id →
// bishop name, from the folder the pastor's photo sits in) and prints the audit.
import { readFileSync, writeFileSync } from 'node:fs';
import { namesAlike, normalName, pastorsOf } from '../src/registration/model.mjs';
const people = JSON.parse(readFileSync(new URL('../src/registration/reference-people.json', import.meta.url), 'utf8'));
const index = JSON.parse(readFileSync('/tmp/photo-index.json', 'utf8'));
const official = JSON.parse(readFileSync(new URL('../data/official-bishops.json', import.meta.url), 'utf8'));
const bishops = people.filter(p => p.role === 'bishop'), pastors = people.filter(p => p.role === 'pastor');
const byId = new Map(people.map(p => [p.id, p]));
const officialCount = new Map((Array.isArray(official) ? official : official.groups).flatMap(g => g.denominations.flatMap(d => d.bishops)).map(b => [normalName(b.name), b.pastors]));
// 1. Each pastor's folder bishop: the folder(s) whose files carry their name.
const folderOf = new Map(); // pastorId -> Set(bishopId)
for (const f of index) {
  if (!f.bishopId || f.own || !byId.has(f.bishopId)) continue;
  const hits = pastors.filter(q => normalName(q.name) === normalName(f.name)) ;
  const alike = hits.length ? hits : pastors.filter(q => namesAlike(q.name, f.name));
  if (alike.length !== 1) continue; // ambiguous or unknown name: skip
  (folderOf.get(alike[0].id) || folderOf.set(alike[0].id, new Set()).get(alike[0].id)).add(f.bishopId);
}
const current = new Map(); for (const b of bishops) for (const q of pastorsOf(b, people)) (current.get(q.id) || current.set(q.id, new Set()).get(q.id)).add(b.id);
// Folder photos naming nobody on the roll: once the file name is cleaned (prefixes, "-Qodesh",
// ", ITALY", stray "jpg"), the ones still unknown are pastors the roll does not have at all →
// data/folder-new-pastors.json, which the build adds under the folder's bishop.
const prefixOf = (raw) => { const m = String(raw).match(/^(lady rev\.?|rev\.?|lp\.?|ps\.?|pastor|pasotr|pst\.?|mother|sis\.?|bro\.?)\s+/i); return m ? m[1].toLowerCase().replace(/\./g, '') : ''; };
const clean = (n) => {
  let s = String(n).replace(/\.(jpe?g|png|heic|webp)$/i, '').replace(/\bjpg\b/ig, '');
  s = s.replace(/\s*[-–,(]\s*(qodesh|[A-Z][A-Za-z]+,?\s*ITALY|ITALY|GHANA|UK|USA|copy|\d+).*$/i, '');
  s = s.replace(/^(bishop|rev\.?|lady rev\.?|lp\.?|ps\.?|pastor|pasotr|pst\.?|mother|sis\.?|bro\.?)\s+/i, '').replace(/^(bishop|rev\.?|lady rev\.?|lp\.?|ps\.?|pastor|pasotr)\s+/i, '');
  s = s.replace(/[_]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return s.split(' ').filter(w => !/^\d+$/.test(w)).join(' ');
};
const tc = s => s.replace(/[^\s-]+/g, w => w.length > 2 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toUpperCase());
const known = (name) => pastors.some(q => namesAlike(q.name, name)) || bishops.some(b => namesAlike(b.name, name));
let prevList = []; try { prevList = JSON.parse(readFileSync(new URL('../data/folder-new-pastors.json', import.meta.url), 'utf8')); } catch {}
const cands = new Map(prevList.map(n => [`${n.bishopId}|${normalName(n.name)}`, n])); // earlier additions keep their place, so ids stay stable
let unusable = 0;
for (const f of index) {
  if (!f.bishopId || f.own || !byId.has(f.bishopId) || /appointment/i.test(f.folder || '')) continue;
  if (known(f.name)) continue;
  const name = clean(f.name);
  if (name.split(/\s+/).length < 2 || /[0-9@]/.test(name) || name.length < 5) { unusable++; continue; }
  if (known(name)) continue;
  const key = `${f.bishopId}|${normalName(name)}`;
  if (cands.has(key)) continue;
  const pre = prefixOf(f.name) || prefixOf(f.path.split('/').pop());
  cands.set(key, { name: tc(name), bishopId: f.bishopId, gender: /^(lp|lady rev|mother|sis)/.test(pre) ? 'female' : /^bro/.test(pre) ? 'male' : '', title: /^lady rev/.test(pre) ? 'Lady Rev.' : /^rev/.test(pre) ? 'Rev.' : 'Pastor', source: f.path.replace(process.env.HOME + '/Downloads/', '') });
}
writeFileSync(new URL('../data/folder-new-pastors.json', import.meta.url), JSON.stringify([...cands.values()], null, 1) + '\n');
console.log(`Folder-only pastors (added by the build): ${cands.size} · unusable file names skipped: ${unusable}`);
const moves = {}, placement = {}, perBishop = new Map();
for (const [pid, set] of folderOf) {
  if (set.size !== 1) continue; // in two bishops' folders: leave it
  const folderBishop = byId.get([...set][0]);
  placement[pid] = folderBishop.name; // every placement, not just the changes: the build gives the same roll however often this runs
  const now = current.get(pid) || new Set();
  if (now.has(folderBishop.id)) continue;
  moves[pid] = folderBishop.name;
  const key = `${folderBishop.name} (${folderBishop.id})`;
  const from = [...now].map(id => byId.get(id)?.name).join('/') || 'nobody';
  const m = perBishop.get(key) || perBishop.set(key, new Map()).get(key); m.set(from, (m.get(from) || 0) + 1);
}
writeFileSync(new URL('../data/folder-bishops.json', import.meta.url), JSON.stringify(placement, null, 1) + '\n');
console.log(`Pastors whose photo folder names a different bishop than the roll: ${Object.keys(moves).length}`);
for (const [b, m] of [...perBishop].sort((a, c) => [...c[1].values()].reduce((x, y) => x + y, 0) - [...a[1].values()].reduce((x, y) => x + y, 0))) console.log(`  → ${b}: ${[...m].map(([from, n]) => `${n} from ${from}`).join(', ')}`);
// 2. Official count vs roll count, after the folder moves would apply.
console.log('\nBishops with no pastors on the roll (official list count in brackets):');
for (const b of bishops) {
  const ours = pastorsOf(b, people).length + Object.values(moves).filter(n => n === b.name).length - Object.keys(moves).filter(pid => current.get(pid)?.has(b.id)).length;
  const off = officialCount.get(normalName(b.name));
  if (ours === 0) console.log(`  ${b.id} ${b.name} · ${b.denomination || '-'} · ${b.group || '-'} [official: ${off ?? 'not on list'}]`);
}
console.log('\nBiggest gaps between the official count and ours (after folder moves):');
const gaps = bishops.map(b => { const off = officialCount.get(normalName(b.name)); const ours = pastorsOf(b, people).length + Object.values(moves).filter(n => n === b.name).length - Object.keys(moves).filter(pid => current.get(pid)?.has(b.id)).length; return { b, off, ours, gap: off === undefined ? 0 : Math.abs(off - ours) }; }).filter(x => x.gap >= 10).sort((a, c) => c.gap - a.gap);
for (const { b, off, ours } of gaps.slice(0, 25)) console.log(`  ${b.name} (${b.id}): official ${off}, roll ${ours}`);
