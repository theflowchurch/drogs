// Assigns portraits from the office's photo folders (indexed by scripts/index-photos.mjs) to the
// people in reference-people.json, converts them to small WebP files under assets/portraits/, and
// writes data/photo-assignments.json for scripts/build-reference.mjs to pick up.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { extname } from 'node:path';
import { namesAlike, normalName } from '../src/registration/model.mjs';
const index = JSON.parse(readFileSync('/tmp/photo-index.json', 'utf8'));
const people = JSON.parse(readFileSync(new URL('../src/registration/reference-people.json', import.meta.url), 'utf8'));
const bishopName = new Map(people.filter((p) => p.role === 'bishop').map((p) => [p.id, p.name]));
const pastors = people.filter((p) => p.role === 'pastor');
const byToken = new Map();
for (const p of pastors) for (const t of new Set(normalName(p.name).split(' ').filter((x) => x.length > 2))) { if (!byToken.has(t)) byToken.set(t, []); byToken.get(t).push(p); }
const candidates = (name) => { const seen = new Set(), out = []; for (const t of normalName(name).split(' ')) for (const p of byToken.get(t) || []) if (!seen.has(p.id)) { seen.add(p.id); if (namesAlike(p.name, name)) out.push(p); } return out; };
const chosen = new Map(); // person id -> { path, score }
const stats = { files: index.length, own: 0, assigned: 0, ambiguous: 0, unmatched: 0, bishopsFilled: 0 };
for (const e of index) {
  if (e.own && e.bishopId) { const b = people.find((p) => p.id === e.bishopId); if (b && !b.image && !chosen.has(b.id)) { chosen.set(b.id, { path: e.path, score: 3 }); stats.bishopsFilled++; } stats.own++; continue; }
  if (e.name.split(' ').length < 2) { stats.unmatched++; continue; }
  let c = candidates(e.name);
  const folderBishop = e.bishopId ? bishopName.get(e.bishopId) : '';
  if (c.length > 1 && folderBishop) { const under = c.filter((p) => p.bishop && namesAlike(p.bishop, folderBishop)); if (under.length) c = under; }
  if (c.length > 1) { const exact = c.filter((p) => normalName(p.name) === normalName(e.name)); if (exact.length === 1) c = exact; }
  if (c.length !== 1) { stats[c.length ? 'ambiguous' : 'unmatched']++; continue; }
  const p = c[0], score = (folderBishop && p.bishop && namesAlike(p.bishop, folderBishop) ? 2 : 0) + (normalName(p.name) === normalName(e.name) ? 1 : 0);
  const prev = chosen.get(p.id); if (!prev || score > prev.score) chosen.set(p.id, { path: e.path, score });
}
stats.assigned = chosen.size;
mkdirSync(new URL('../assets/portraits/', import.meta.url), { recursive: true });
const out = JSON.parse(existsSync(new URL('../data/photo-assignments.json', import.meta.url)) ? readFileSync(new URL('../data/photo-assignments.json', import.meta.url), 'utf8') : '{}');
let converted = 0, failed = 0;
for (const [id, { path }] of chosen) {
  const dest = new URL(`../assets/portraits/${id}.webp`, import.meta.url);
  if (!existsSync(dest)) {
    try {
      let src = path;
      if (extname(path).toLowerCase() === '.heic') { src = `/tmp/heic-${id}.jpg`; execFileSync('sips', ['-s', 'format', 'jpeg', path, '--out', src], { stdio: 'ignore' }); }
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf', "scale='min(640,iw)':-2", '-c:v', 'libwebp', '-quality', '75', dest.pathname], { stdio: 'ignore' });
      converted++;
    } catch { failed++; continue; }
  }
  out[id] = `assets/portraits/${id}.webp`;
}
writeFileSync(new URL('../data/photo-assignments.json', import.meta.url), JSON.stringify(out, null, 0) + '\n');
console.log(JSON.stringify({ ...stats, converted, failed, total: Object.keys(out).length }));
