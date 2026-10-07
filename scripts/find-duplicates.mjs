// Finds pastor records that duplicate another record and writes data/duplicate-removals.json
// (applied by scripts/build-reference.mjs). Rules are deliberately narrow:
//  1. a pastor whose name has exactly the same words as a bishop's, in the same country (or either blank) → the bishop is the person;
//  2. two pastors whose names have the same words in a different order, same country (or blank), not two different-looking records in different cities → one person;
//  3. two pastors under the same bishop where one name contains the other (≥2 shared words) → one person; the longer name stays.
// Hand-confirmed pairs that the rules cannot see sit in MANUAL.
import { readFileSync, writeFileSync } from 'node:fs';
import { normalName } from '../src/registration/model.mjs';
const people = JSON.parse(readFileSync(new URL('../src/registration/reference-people.json', import.meta.url), 'utf8'));
const bishops = people.filter((p) => p.role === 'bishop'), pastors = people.filter((p) => p.role === 'pastor');
const words = (n) => normalName(n).split(' ').filter(Boolean);
const tok = (n) => words(n).sort().join(' ');
const sameCountry = (a, b) => !a.country || !b.country || normalName(a.country) === normalName(b.country);
const richness = (p) => (p.image ? 4 : 0) + (p.yearAppointed ? 1 : 0) + (p.bishop ? 1 : 0) + (p.city ? 1 : 0) + words(p.name).length / 10 + (p.id.startsWith('PS') ? -2 : 0);
const removals = [];
const MANUAL = { P366: 'BO181', P1944: 'BO180', P5093: 'B78', P4547: 'B196', P4556: 'B59', P4589: 'B127', P4628: 'B187', P4708: 'B240' };
for (const [id, keep] of Object.entries(MANUAL)) { const p = pastors.find((x) => x.id === id), b = bishops.find((x) => x.id === keep); if (p && b) removals.push({ id, keep, reason: `same person as Bishop ${b.name} (hand-confirmed spelling)` }); }
// Pairs the office confirmed by name (the shorter record goes, the bishop stays).
const MANUAL_BY_NAME = { 'Serena Ababio': 'Serena Ariana Ababio', 'Alice Obaka': 'Alice Renatta Obaka', 'Esther Okyere': 'Esther-Richie Okyere', 'Mary Bandoh': 'Mary Rea Bandoh', 'Paula Mills-Thompson': 'Paula Chela Mills Thompson', 'Ruthie Denkyira': 'Ruthie Appiah Denkyira',
  // Bishop Emmanuel Sakyi, 7 Oct 2026: the pastor under Kenneth Agyei and the bishop at Leeds/Nottingham are the same men as these bishops.
  'Charles Kwame Bonsu': 'Charles Bonsu', 'Nana Kwame Adu Gyamfi': 'Kwame Adu Gyamfi' };
for (const [shortName, fullName] of Object.entries(MANUAL_BY_NAME)) { const b = bishops.find((x) => normalName(x.name) === normalName(fullName)); for (const p of pastors) if (b && normalName(p.name) === normalName(shortName)) removals.push({ id: p.id, keep: b.id, reason: `same person as Bishop ${b.name} (office confirmed)` }); }
for (const p of pastors) {
  if (removals.some((r) => r.id === p.id)) continue;
  // Same words, same country, and either the same organization or a bare roster line (no city) — a common name in another organization stays.
  const b = bishops.find((x) => tok(x.name) === tok(p.name) && sameCountry(x, p) && (x.organization === p.organization || !p.city));
  if (b) removals.push({ id: p.id, keep: b.id, reason: `same name as Bishop ${b.name}` });
}
const byTok = new Map(); for (const p of pastors) { const k = tok(p.name); if (!byTok.has(k)) byTok.set(k, []); byTok.get(k).push(p); }
for (const group of byTok.values()) {
  if (group.length < 2) continue;
  const live = group.filter((p) => !removals.some((r) => r.id === p.id)); if (live.length < 2) continue;
  const identical = new Set(live.map((p) => normalName(p.name))).size === 1;
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], b = live[j]; if (!sameCountry(a, b)) continue;
    if (identical && !(normalName(a.bishop || '') === normalName(b.bishop || '') && normalName(a.city || '') === normalName(b.city || ''))) continue; // two people may share a name
    const [keep, drop] = richness(a) >= richness(b) ? [a, b] : [b, a];
    if (!removals.some((r) => r.id === drop.id)) removals.push({ id: drop.id, keep: keep.id, reason: `same name as ${keep.name} (word order)` });
  }
}
const byBishop = new Map(); for (const p of pastors) { const k = normalName(p.bishop || ''); if (!k) continue; if (!byBishop.has(k)) byBishop.set(k, []); byBishop.get(k).push(p); }
for (const list of byBishop.values()) for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
  const a = list[i], b = list[j]; if (tok(a.name) === tok(b.name)) continue;
  const A = new Set(words(a.name)), B = new Set(words(b.name)); const shared = [...A].filter((w) => B.has(w)).length;
  if (shared >= 2 && (shared === A.size || shared === B.size)) { const [keep, drop] = A.size >= B.size ? [a, b] : [b, a]; if (!removals.some((r) => r.id === drop.id || r.id === keep.id)) removals.push({ id: drop.id, keep: keep.id, reason: `shorter form of ${keep.name} under the same bishop` }); }
}
//  4. a pastor known only from a photo folder whose first and last names are a misspelling, transposition or initials
//     of a roster pastor under the same bishop ("Kwaku Aseidu Badu" ~ "Kwaku Asiedu-Badu", "Isaac N K Kwarteng" ~ "Isaac Nana Kwabena Kwarteng") → the roster record is the person.
import { sameSoul } from './lib/names.mjs';
for (const list of byBishop.values()) for (const a of list.filter((p) => p.source === 'photo folder')) for (const b of list.filter((p) => p.source !== 'photo folder')) {
  if (removals.some((r) => r.id === a.id || r.id === b.id)) continue;
  if (sameSoul(a.name, b.name)) removals.push({ id: a.id, keep: b.id, reason: `photo-folder spelling of ${b.name} under the same bishop` });
}
//  5. two pastors with exactly the same name whom the office's own export lists twice with the same birthday and age → one person; the richer record stays.
import { birthRows } from './lib/office-dob.mjs';
for (const group of byTok.values()) {
  const live = group.filter((p) => !removals.some((r) => r.id === p.id)); if (live.length < 2) continue;
  const b = birthRows(live[0].name); if (b.length < 2 || new Set(b.map((x) => `${x.born}|${x.age}`)).size !== 1) continue;
  const [keep, ...rest] = [...live].sort((a, b) => richness(b) + (b.bishop ? 3 : 0) - richness(a) - (a.bishop ? 3 : 0));
  for (const d of rest) removals.push({ id: d.id, keep: keep.id, reason: `same name and birthday as ${keep.name} (${b[0].born}, age ${b[0].age}) in the office's export` });
}
const file = new URL('../data/duplicate-removals.json', import.meta.url);
let previous = []; try { previous = JSON.parse(readFileSync(file, 'utf8')).removals || []; } catch {}
for (const r of previous) if (!removals.some((x) => x.id === r.id)) removals.push(r);
writeFileSync(file, JSON.stringify({ generated: new Date().toISOString().slice(0, 10), removals }, null, 1) + '\n');
console.log('duplicate removals:', removals.length, '| to bishops', removals.filter((r) => /^B/.test(r.keep)).length, '| pastor merges', removals.filter((r) => /^P/.test(r.keep)).length);
for (const r of removals) { const p = pastors.find((x) => x.id === r.id); if (p) console.log(' -', p.name, '→', r.reason); }
