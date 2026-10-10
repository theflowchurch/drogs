// Possible duplicates on the roll: the same picture on two records, the same name (any order), or a name that is a
// fuller, shorter or respelled form of another's in the same country. Birthdays (from the sheets) split namesakes.
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { normalName, namesAlike, placeOf, titleFor, bySurname } from '../src/registration/model.mjs';
import { words, sameSoul } from './lib/names.mjs';
import { dhash, hamming, SAME_PICTURE } from './lib/photo-hash.mjs';
const root = new URL('..', import.meta.url).pathname;
const people = JSON.parse(readFileSync(`${root}src/registration/reference-people.json`, 'utf8'));
const subs = JSON.parse(readFileSync(`${root}data/bishop-submissions.json`, 'utf8'));
const key = (n) => normalName(String(n).replace(/[’'`]/g, ''));
// birthday keys per person, from the sheet rows (never stored on the roll)
const dob = new Map(); for (const s of subs) for (const r of s.pastors) { const k = key(r.name); if (r.dobKeys?.length) dob.set(k, [...(dob.get(k) || []), ...r.dobKeys]); }
const sameDob = (a, b) => { const x = dob.get(key(a.name)) || [], y = dob.get(key(b.name)) || []; return !x.length || !y.length || x.some((k) => y.includes(k)); };
const parent = new Map(people.map((p) => [p.id, p.id])); const find = (x) => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x))), parent.get(x)));
const why = new Map(); const link = (a, b, reason) => { if (a.role === 'bishop' && b.role === 'bishop') return; parent.set(find(a.id), find(b.id)); why.set([a.id, b.id].sort().join('+'), reason); };
const sorted = (n) => words(n).sort().join(' ');
const bySorted = new Map(); for (const p of people) { const k = sorted(p.name); if (!bySorted.has(k)) bySorted.set(k, []); bySorted.get(k).push(p); }
for (const g of bySorted.values()) for (let i = 1; i < g.length; i++) if (sameDob(g[0], g[i])) link(g[0], g[i], 'same name');
const country = (p) => words(p.country || '')[0] || '';
const byCountry = new Map(); for (const p of people) { const k = country(p); if (!byCountry.has(k)) byCountry.set(k, []); byCountry.get(k).push(p); }
for (const [k, list] of byCountry) { const pool = k ? [...list, ...(byCountry.get('') || [])] : list; for (const a of list) for (const b of pool) { if (a.id >= b.id || sorted(a.name) === sorted(b.name)) continue; if (words(a.name).length < 2 || words(b.name).length < 2) continue; if ((namesAlike(a.name, b.name) || sameSoul(a.name, b.name)) && sameDob(a, b)) link(a, b, words(a.name).length !== words(b.name).length ? 'fuller or shorter form of the name' : 'spelling differs'); } }
const pictured = people.filter((p) => p.image && existsSync(`${root}${p.image}`));
const thumbPath = (p) => { const t = p.image.replace(/^(assets\/(?:portraits|bishops|pastors))\/([^/]+)\.[^.]+$/, '$1/thumbs/$2.webp'); return existsSync(`${root}${t}`) ? t : p.image; };
const hashes = []; for (let i = 0; i < pictured.length; i += 50) await Promise.all(pictured.slice(i, i + 50).map(async (p) => { try { hashes.push([p, await dhash(`${root}${thumbPath(p)}`)]); } catch {} }));
for (let i = 0; i < hashes.length; i++) for (let j = i + 1; j < hashes.length; j++) if (hamming(hashes[i][1], hashes[j][1]) <= SAME_PICTURE) link(hashes[i][0], hashes[j][0], 'same picture');
const groups = new Map(); for (const p of people) { const r = find(p.id); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(p); }
const dupes = [...groups.values()].filter((g) => g.length > 1).map((g) => { g.sort(bySurname); const reasons = new Set(); for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) { const r = why.get([g[i].id, g[j].id].sort().join('+')); if (r) reasons.add(r); } const sameBishop = new Set(g.map((p) => p.bishop || p.name)).size === 1; return { g, reasons: [...reasons], sameBishop, likely: reasons.has('same picture') || reasons.has('same name') || sameBishop }; });
dupes.sort((a, b) => (a.likely ? 0 : 1) - (b.likely ? 0 : 1) || bySurname(a.g[0], b.g[0]));
writeFileSync(`${root}data/reports/duplicates-scan.json`, JSON.stringify(dupes.map((d) => ({ likely: d.likely, reasons: d.reasons, people: d.g.map((p) => ({ id: p.id, name: p.name, title: titleFor(p), bishop: p.bishop || (p.role === 'bishop' ? '(bishop)' : ''), group: p.group, denomination: p.denomination, place: placeOf(p), photo: Boolean(p.image), unclaimed: p.unclaimed || '' })) })), null, 1) + '\n');
console.log(`${dupes.length} groups · ${dupes.filter((d) => d.likely).length} likely (same picture, same name, or same bishop) · ${dupes.filter((d) => !d.likely).length} to check · reasons: ${JSON.stringify([...new Set(dupes.flatMap((d) => d.reasons))])}`);
for (const d of dupes.filter((d) => d.likely)) console.log(`  ${d.reasons.join(', ')}: ${d.g.map((p) => `${p.name} [${p.bishop || 'bishop'}${p.city ? ', ' + p.city : ''}]`).join('  ~  ')}`);
