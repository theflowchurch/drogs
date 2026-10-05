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
// Folder names that match nobody on the roll: pastors the roll does not have at all.
const missing = {};
for (const f of index) {
  if (!f.bishopId || f.own || !byId.has(f.bishopId) || /appointment/i.test(f.folder || '')) continue;
  if (pastors.some(q => namesAlike(q.name, f.name)) || bishops.some(b => namesAlike(b.name, f.name))) continue;
  (missing[f.bishopId] ||= new Set()).add(f.name);
}
writeFileSync(new URL('../data/folder-new-pastors.json', import.meta.url), JSON.stringify(Object.fromEntries(Object.entries(missing).map(([id, set]) => [id, [...set].sort()])), null, 1) + '\n');
console.log(`Folder photos naming nobody on the roll: ${Object.values(missing).reduce((n, s) => n + s.size, 0)} names across ${Object.keys(missing).length} bishops`);
for (const [id, set] of Object.entries(missing).sort((a, c) => c[1].size - a[1].size).slice(0, 15)) console.log(`  ${byId.get(id).name} (${id}): ${set.size} · e.g. ${[...set].slice(0, 4).join(', ')}`);
const moves = {}, perBishop = new Map();
for (const [pid, set] of folderOf) {
  if (set.size !== 1) continue; // in two bishops' folders: leave it
  const folderBishop = byId.get([...set][0]);
  const now = current.get(pid) || new Set();
  if (now.has(folderBishop.id)) continue;
  moves[pid] = folderBishop.name;
  const key = `${folderBishop.name} (${folderBishop.id})`;
  const from = [...now].map(id => byId.get(id)?.name).join('/') || 'nobody';
  const m = perBishop.get(key) || perBishop.set(key, new Map()).get(key); m.set(from, (m.get(from) || 0) + 1);
}
writeFileSync(new URL('../data/folder-bishops.json', import.meta.url), JSON.stringify(moves, null, 1) + '\n');
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
