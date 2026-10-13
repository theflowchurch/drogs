// Merges the contact-sheet reviews (/tmp/attire/review-*.json, cell numbers) with the sheet manifest into
// data/reports/attire-review.json (id → { codes, note }); adds LOW from the measured size and sharpness.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const manifest = JSON.parse(readFileSync('/tmp/attire/manifest.json', 'utf8')); const metrics = JSON.parse(readFileSync('/tmp/attire/metrics.json', 'utf8'));
const cell = new Map(); for (const s of manifest) for (const c of s.cells) cell.set(`${s.sheet}:${c.n}`, c);
const out = {}; let unreviewed = [];
for (const f of readdirSync('/tmp/attire').filter((f) => /^review-\d+\.json$/.test(f)).sort()) for (const r of JSON.parse(readFileSync(`/tmp/attire/${f}`, 'utf8'))) { if (r.n === 0 || r.codes.includes('UNREVIEWED')) { unreviewed.push(r.sheet); continue; } const c = cell.get(`${r.sheet}:${r.n}`); if (!c) { console.error('no cell', r); continue; } const codes = [...new Set(r.codes.filter((x) => x !== 'OK'))]; if (!codes.length) continue; out[c.id] = { codes, note: r.note || '', sheet: r.sheet, n: r.n }; }
// Background must be a shade of white (Joshua, 13 Oct): measured at the image edges — share of near-white pixels, mean luminance, colour cast.
const bg = JSON.parse(readFileSync('/tmp/attire/background.json', 'utf8'));
for (const [id, v] of Object.entries(bg)) if (v.whiteish < 40 || (v.whiteish < 70 && (v.chroma > 25 || v.lum < 175))) { out[id] = out[id] || { codes: [], note: '' }; if (!out[id].codes.includes('BGCOLOUR')) out[id].codes.push('BGCOLOUR'); }
for (const [id, m] of Object.entries(metrics)) if (m.width < 300 || m.blur < 60) { out[id] = out[id] || { codes: [], note: '' }; if (!out[id].codes.includes('LOW')) out[id].codes.push('LOW'); }
writeFileSync(`${root}data/reports/attire-review.json`, JSON.stringify(out, null, 1) + '\n');
console.log(`${Object.keys(out).length} photos flagged · sheets unreviewed: ${unreviewed.join(', ') || 'none'}`);
