// Assigns portraits from the office's photo folders (indexed by scripts/index-photos.mjs) to the
// people in reference-people.json, converts them to small WebP files under assets/portraits/, and
// writes data/photo-assignments.json for scripts/build-reference.mjs to pick up.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { extname } from 'node:path';
import { namesAlike, normalName } from '../src/registration/model.mjs';
import { exifOrientation } from './exif-orientation.mjs';
// ffmpeg applies a JPEG's camera orientation tag by itself; only stripped copies stored sideways need a hand rotation (data/photo-rotate-overrides.json).
const ROTATE = {};
const index = JSON.parse(readFileSync('/tmp/photo-index.json', 'utf8'));
const people = JSON.parse(readFileSync(new URL('../src/registration/reference-people.json', import.meta.url), 'utf8'));
const bishopName = new Map(people.filter((p) => p.role === 'bishop').map((p) => [p.id, p.name]));
const pastors = people.filter((p) => p.role === 'pastor');
const byToken = new Map();
for (const p of pastors) for (const t of new Set(normalName(p.name).split(' ').filter((x) => x.length > 2))) { if (!byToken.has(t)) byToken.set(t, []); byToken.get(t).push(p); }
const words = (n) => normalName(n).split(' ').filter(Boolean);
// Strict: every word of the shorter name appears exactly in the longer one. Loose: alike spellings (edit distance).
const strictMatch = (a, b) => { const A = words(a), B = words(b); const [sh, lo] = A.length <= B.length ? [A, B] : [B, A]; const pool = new Set(lo); return sh.length >= 2 && sh.every((w) => pool.has(w)); };
const candidates = (name) => { const seen = new Set(), out = []; for (const t of normalName(name).split(' ')) for (const p of byToken.get(t) || []) if (!seen.has(p.id)) { seen.add(p.id); if (namesAlike(p.name, name)) out.push(p); } return out; };
// Folders that hold bishops' own portraits: never a source for a pastor's photo.
const BISHOP_POOL = /BISHOPS PHOTOS|OTHER BISHOPS|RED JACKET|CONVENERS|\/UD BISHOPS\/|\/UC\//i;
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
  // A spelling-only match is trusted only inside the person's own bishop's folder; a pastor never takes a photo from a bishops' pool.
  const strict = strictMatch(c[0].name, e.name);
  const ownFolder = folderBishop && c[0].bishop && namesAlike(c[0].bishop, folderBishop);
  if (!strict && !ownFolder) { stats.looseSkipped = (stats.looseSkipped || 0) + 1; continue; }
  // Outside the person's own bishop's folder a partial match must agree on both first name and surname.
  if (strict && !ownFolder) { const A = words(c[0].name), B = words(e.name); if (A.length !== B.length && !(A[0] === B[0] && A.at(-1) === B.at(-1))) { stats.partialSkipped = (stats.partialSkipped || 0) + 1; continue; } }
  if (BISHOP_POOL.test(e.path) && !(strict && words(c[0].name).length === words(e.name).length)) { stats.poolSkipped = (stats.poolSkipped || 0) + 1; continue; }
  // A file that still carries its camera orientation tag is the original; stripped copies of sideways shots can't be righted.
  const original = /\.jpe?g$/i.test(e.path) && exifOrientation(e.path) !== 1 ? 3 : 0;
  const p = c[0], score = (folderBishop && p.bishop && namesAlike(p.bishop, folderBishop) ? 2 : 0) + (normalName(p.name) === normalName(e.name) ? 1 : 0) + original;
  const prev = chosen.get(p.id); if (!prev || score > prev.score) chosen.set(p.id, { path: e.path, score });
}
stats.assigned = chosen.size;
mkdirSync(new URL('../assets/portraits/', import.meta.url), { recursive: true });
const out = {};
const picksFile = new URL('../data/bishop-photo-picks.json', import.meta.url);
for (const [id, rel] of Object.entries(existsSync(picksFile) ? JSON.parse(readFileSync(picksFile, 'utf8')) : {})) {
  const dest = new URL(`../assets/portraits/${id}.webp`, import.meta.url);
  if (!existsSync(dest)) { try { execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', `${process.env.HOME}/Downloads/${rel}`, '-vf', "scale='min(640,iw)':-2", '-c:v', 'libwebp', '-quality', '78', dest.pathname], { stdio: 'ignore' }); } catch { continue; } }
  out[id] = `assets/portraits/${id}.webp`;
}
let converted = 0, failed = 0;
const prevSources = existsSync(new URL('../data/photo-sources.json', import.meta.url)) ? JSON.parse(readFileSync(new URL('../data/photo-sources.json', import.meta.url), 'utf8')) : {};
const overridesFile = new URL('../data/photo-rotate-overrides.json', import.meta.url);
const overrides = existsSync(overridesFile) ? JSON.parse(readFileSync(overridesFile, 'utf8')) : {};
const rotatedFile = new URL('../data/photo-rotated.json', import.meta.url);
const rotated = new Set(existsSync(rotatedFile) ? JSON.parse(readFileSync(rotatedFile, 'utf8')) : []);
for (const [id, { path }] of chosen) {
  const dest = new URL(`../assets/portraits/${id}.webp`, import.meta.url);
  if (overrides[id]) ROTATE[`o:${id}`] = overrides[id];
  const rotKey = overrides[id] ? `o:${id}` : 0;
  const needsRotation = Boolean(ROTATE[rotKey]) && !rotated.has(id);
  const sourceChanged = prevSources[id] && prevSources[id] !== path.replace(process.env.HOME + '/Downloads/', '');
  if (!existsSync(dest) || needsRotation || sourceChanged) {
    try {
      let src = path;
      if (extname(path).toLowerCase() === '.heic') { src = `/tmp/heic-${id}.jpg`; execFileSync('sips', ['-s', 'format', 'jpeg', path, '--out', src], { stdio: 'ignore' }); }
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf', `${ROTATE[rotKey] ? ROTATE[rotKey] + ',' : ''}scale='min(640,iw)':-2`, '-c:v', 'libwebp', '-quality', '75', dest.pathname], { stdio: 'ignore' });
      converted++; if (ROTATE[rotKey]) rotated.add(id);
    } catch { failed++; continue; }
  }
  if (!out[id]) out[id] = `assets/portraits/${id}.webp`;
}
writeFileSync(rotatedFile, JSON.stringify([...rotated]) + '\n');
// Which file each portrait came from, for checking a doubtful picture later.
writeFileSync(new URL('../data/photo-sources.json', import.meta.url), JSON.stringify(Object.fromEntries([...chosen].map(([id, c]) => [id, c.path.replace(process.env.HOME + '/Downloads/', '')]))) + '\n');
writeFileSync(new URL('../data/photo-assignments.json', import.meta.url), JSON.stringify(out, null, 0) + '\n');
console.log(JSON.stringify({ ...stats, converted, failed, total: Object.keys(out).length }));
