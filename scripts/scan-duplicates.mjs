// Possible duplicates on the roll after a build: the same name with the same birthday (or age) on two records, the same
// picture on two records (two files), and the pairs Joshua asked the office to confirm (data/duplicate-rulings.json).
// Look-alike names are not flagged: Joshua went through them on 11 Oct — anyone he did not rule on is a different person.
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { normalName, placeOf, titleFor, bySurname } from '../src/registration/model.mjs';
import { words } from './lib/names.mjs';
import { birthAgrees } from './lib/birth.mjs';
import { dhash, hamming, SAME_PICTURE } from './lib/photo-hash.mjs';
const root = new URL('..', import.meta.url).pathname;
const people = JSON.parse(readFileSync(`${root}src/registration/reference-people.json`, 'utf8'));
const subs = JSON.parse(readFileSync(`${root}data/bishop-submissions.json`, 'utf8'));
const rulings = JSON.parse(readFileSync(`${root}data/duplicate-rulings.json`, 'utf8'));
const key = (n) => normalName(String(n).replace(/[’'`]/g, ''));
// the sheet row behind each record (name + bishop); folders run oldest → newest, so the latest sheet's row stays
const rowsBy = new Map(); for (const s of subs) for (const r of s.pastors) rowsBy.set(`${key(r.name)}|${key(s.bishop)}`, r);
const rowOf = (p) => rowsBy.get(`${key(p.name)}|${key(p.bishop || '')}`) || null;
const parent = new Map(people.map((p) => [p.id, p.id])); const find = (x) => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x))), parent.get(x)));
const why = new Map(); const link = (a, b, reason) => { if (a.role === 'bishop' && b.role === 'bishop') return; parent.set(find(a.id), find(b.id)); why.set([a.id, b.id].sort().join('+'), reason); };
const sorted = (n) => words(n).sort().join(' ');
const bySorted = new Map(); for (const p of people) { const k = sorted(p.name); if (!bySorted.has(k)) bySorted.set(k, []); bySorted.get(k).push(p); }
for (const g of bySorted.values()) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) if (birthAgrees(rowOf(g[i]), rowOf(g[j])) === true) link(g[i], g[j], 'same name and birthday');
const pictured = people.filter((p) => p.image && existsSync(`${root}${p.image}`));
const thumbPath = (p) => { const t = p.image.replace(/^(assets\/(?:portraits|bishops|pastors))\/([^/]+)\.[^.]+$/, '$1/thumbs/$2.webp'); return existsSync(`${root}${t}`) ? t : p.image; };
const hashes = []; for (let i = 0; i < pictured.length; i += 50) await Promise.all(pictured.slice(i, i + 50).map(async (p) => { try { hashes.push([p, await dhash(`${root}${thumbPath(p)}`)]); } catch {} }));
for (let i = 0; i < hashes.length; i++) for (let j = i + 1; j < hashes.length; j++) if (hashes[i][0].image !== hashes[j][0].image && hamming(hashes[i][1], hashes[j][1]) <= SAME_PICTURE) link(hashes[i][0], hashes[j][0], 'same picture');
const pendingIds = new Set();
for (const d of rulings.pending) { const recs = d.names.map((n) => people.find((p) => key(p.name) === key(n))).filter(Boolean); for (let i = 1; i < recs.length; i++) link(recs[0], recs[i], 'the office must confirm'); recs.forEach((p) => pendingIds.add(p.id)); }
const groups = new Map(); for (const p of people) { const r = find(p.id); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(p); }
const dupes = [...groups.values()].filter((g) => g.length > 1).map((g) => { g.sort(bySurname); const reasons = new Set(); for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) { const r = why.get([g[i].id, g[j].id].sort().join('+')); if (r) reasons.add(r); } return { g, reasons: [...reasons], pending: g.some((p) => pendingIds.has(p.id)), likely: true }; });
dupes.sort((a, b) => (a.pending ? 0 : 1) - (b.pending ? 0 : 1) || bySurname(a.g[0], b.g[0]));
writeFileSync(`${root}data/reports/duplicates-scan.json`, JSON.stringify(dupes.map((d) => ({ likely: d.likely, pending: d.pending, reasons: d.reasons, people: d.g.map((p) => ({ id: p.id, name: p.name, title: titleFor(p), bishop: p.bishop || (p.role === 'bishop' ? '(bishop)' : ''), group: p.group, denomination: p.denomination, place: placeOf(p), photo: Boolean(p.image), unclaimed: p.unclaimed || '' })) })), null, 1) + '\n');
console.log(`${dupes.length} groups · ${dupes.filter((d) => d.pending).length} awaiting the office · reasons: ${JSON.stringify([...new Set(dupes.flatMap((d) => d.reasons))])}`);
for (const d of dupes) console.log(`  ${d.reasons.join(', ')}: ${d.g.map((p) => `${p.name} [${p.bishop || 'bishop'}${p.city ? ', ' + p.city : ''}]`).join('  ~  ')}`);
