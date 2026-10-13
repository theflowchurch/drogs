// Merges the contact-sheet reviews (/tmp/attire/review-*.json, cell numbers) with the sheet manifest into
// data/reports/attire-review.json (id → { codes, note }); adds LOW from the measured size and sharpness.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const manifest = JSON.parse(readFileSync('/tmp/attire/manifest.json', 'utf8')); const metrics = JSON.parse(readFileSync('/tmp/attire/metrics.json', 'utf8'));
const cell = new Map(); for (const s of manifest) for (const c of s.cells) cell.set(`${s.sheet}:${c.n}`, c);
const out = {}; let unreviewed = [];
for (const f of readdirSync('/tmp/attire').filter((f) => /^review-\d+\.json$/.test(f)).sort()) for (const r of JSON.parse(readFileSync(`/tmp/attire/${f}`, 'utf8'))) { if (r.n === 0 || r.codes.includes('UNREVIEWED')) { unreviewed.push(r.sheet); continue; } const c = cell.get(`${r.sheet}:${r.n}`); if (!c) { console.error('no cell', r); continue; } const codes = [...new Set(r.codes.filter((x) => x !== 'OK'))]; if (!codes.length) continue; out[c.id] = { codes, note: r.note || '', sheet: r.sheet, n: r.n }; }
// Background must be a shade of white (Joshua, 13 Oct): only clearly not white fails — dark, or strongly coloured and not bright.
// Measured above the shoulders (top band and upper side bands); warm or grey whites and badly lit white walls pass.
for (const [id, m] of Object.entries(metrics)) if (m.width < 300 || m.blur < 60) { out[id] = out[id] || { codes: [], note: '' }; if (!out[id].codes.includes('LOW')) out[id].codes.push('LOW'); }
const bg = JSON.parse(readFileSync('/tmp/attire/background2.json', 'utf8'));
for (const [id, v] of Object.entries(bg)) if (v.dark >= 50 || v.lum < 150 || (v.lum < 195 && v.coloured >= 40)) { out[id] = out[id] || { codes: [], note: '' }; if (!out[id].codes.includes('BGCOLOUR')) out[id].codes.push('BGCOLOUR'); }
// Joshua, 13 Oct: black and white is fine for women; blue suits are fine (especially Eschatos); so COLOUR is dropped and WDRESS
// stays only when the note says the clothes are clearly not the attire. Named approvals from his screenshots are cleared.
const CASUAL_WORDS = /t-?shirt|polo|print|floral|pattern|strip|casual|grey|gray|brown|green|pink|purple|orange|jeans|sweater|hoodie|jumper|cardigan|traditional|kente|lace|denim|sport|sleeveless|tank|vest|scarf|turtleneck|blouse only|no jacket/i;
const APPROVED = ['Paula Headley', 'Brittney Bobby Hemmings', 'Cordia Chambers Johnson', 'Toniann Mitchell', 'Staciann Sampson', 'Sharon Spence', 'Mataiasi Lomu Tavo', 'Shine Nyarkoh-Mensah', 'Esther Nyamekye Okokon', 'Jermaine Cargill', 'Jordan Fray', 'Felix Kofi Apeti', 'Asiantewen Chosen Godwin Bawa', 'Emmanuel Nii Okai', 'Latoya Adjetey', 'Nicole Femola Brown', 'Gayrol Taylor', 'Shanice Webb', 'Dorcas Asare-Duah', 'Raphael Fred Assefuah', 'Lloyd Akeem George', 'Kenrick Haynes', 'Orin Jonas', 'Calvin Elroy Kelvin'].map((n) => n.toLowerCase());
for (const [id, v] of Object.entries(out)) {
  v.codes = v.codes.filter((c) => c !== 'COLOUR');
  if (v.codes.includes('WDRESS') && !CASUAL_WORDS.test(v.note || '')) v.codes = v.codes.filter((c) => c !== 'WDRESS');
  const c = [...cell.values()].find((x) => x.id === id); if (c && APPROVED.includes(c.name.toLowerCase())) v.codes = [];
  if (!v.codes.length) delete out[id];
}
writeFileSync(`${root}data/reports/attire-review.json`, JSON.stringify(out, null, 1) + '\n');
console.log(`${Object.keys(out).length} photos flagged · sheets unreviewed: ${unreviewed.join(', ') || 'none'}`);
