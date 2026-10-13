// Second pass (13 Oct): the reviewers looked again at every flagged photo at larger size with Joshua's corrected rules
// (/tmp/attire2/review-*.json, cell n → KEEP with final codes, or CLEAR). Joshua's own rulings (data/attire-rulings.json)
// are applied last. Writes data/reports/attire-review.json (id → { codes, note }).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const manifest = JSON.parse(readFileSync('/tmp/attire2/manifest.json', 'utf8')); const rulings = JSON.parse(readFileSync(`${root}data/attire-rulings.json`, 'utf8'));
const cell = new Map(); for (const s of manifest) for (const c of s.cells) cell.set(c.n, c);
const out = {}; const unreviewed = [];
for (const f of readdirSync('/tmp/attire2').filter((f) => /^review-\d+\.json$/.test(f)).sort()) for (const r of JSON.parse(readFileSync(`/tmp/attire2/${f}`, 'utf8'))) { if (r.n === 0) { unreviewed.push(r.note); continue; } const c = cell.get(r.n); if (!c) { console.error('no cell', r.n); continue; } if (r.verdict !== 'KEEP') continue; const codes = [...new Set((r.codes || []).filter((x) => x && x !== 'OK'))]; if (!codes.length) continue; out[c.id] = { codes, note: r.note || '' }; }
const seen = new Set([...readdirSync('/tmp/attire2').filter((f) => /^review-\d+\.json$/.test(f)).flatMap((f) => JSON.parse(readFileSync(`/tmp/attire2/${f}`, 'utf8')).map((r) => r.n))]);
const missed = [...cell.keys()].filter((n) => !seen.has(n));
const people = JSON.parse(readFileSync(`${root}src/registration/reference-people.json`, 'utf8')).filter((p) => p.role === 'pastor');
const byName = new Map(people.map((p) => [p.name.toLowerCase(), p])); // rulings may name someone the first pass had already cleared
for (const n of rulings.approved) { const c = byName.get(n.toLowerCase()); if (c) delete out[c.id]; }
for (const [n, codes] of Object.entries(rulings.forced)) { const c = byName.get(n.toLowerCase()); if (!c) continue; if (codes.length) out[c.id] = { codes, note: (out[c.id]?.note) || 'Joshua, 13 Oct' }; else delete out[c.id]; }
writeFileSync(`${root}data/reports/attire-review.json`, JSON.stringify(out, null, 1) + '\n');
console.log(`${Object.keys(out).length} photos flagged after the second pass · cells not covered by a reviewer: ${missed.length} · unreviewed sheets: ${unreviewed.join('; ') || 'none'}`);
