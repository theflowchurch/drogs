// Official bishop portraits the office shared on Drive (folder 1-wdiuowHX8obdZyYAPw86VqT31a45daL, downloaded to
// ~/Downloads/Kuriake Castle Project/01 Office source data/Bishop photos (Drive, 7 Oct 2026)/) → assets/portraits/<id>-<hash>.webp
// (+ thumbs) and data/bishop-photo-overrides.json, which build-reference applies over whatever portrait a bishop had.
// A new file name per picture: the CDN caches a path for a year.
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { namesAlike, normalName } from '../src/registration/model.mjs';
const root = new URL('..', import.meta.url).pathname;
const DIR = process.argv[2] || `${process.env.HOME}/Downloads/Kuriake Castle Project/01 Office source data/Bishop photos (Drive, 7 Oct 2026)`;
const people = JSON.parse(readFileSync(`${root}src/registration/reference-people.json`, 'utf8'));
const bishops = people.filter((p) => p.role === 'bishop');
// File names that differ from the roll's spelling.
const ALIAS = { 'kay francis quao': 'Kay Francis Kwao', 'aundrae wood': 'Andrae George Woode', 'kweku sompa osei': 'Sompa Osei', 'michael tingabo': 'Michael Vengkomwine Tengabo', 'sam sawyer': 'Sam Sawyerr' };
const SKIP = /^(Isaac Commey 2|Sister Phillippa-Marker Coker 02.*)$/i; // second copies of a bishop already covered
const file = new URL('../data/bishop-photo-overrides.json', import.meta.url);
const overrides = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
mkdirSync(`${root}assets/portraits/thumbs`, { recursive: true });
const unmatched = [];
for (const f of readdirSync(DIR).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort()) {
  const base = f.replace(/\.[^.]+$/, '').replace(/^(bishop|sister)\s+/i, '').replace(/\s+/g, ' ').trim();
  if (SKIP.test(base)) continue;
  const want = ALIAS[normalName(base)] || base;
  let b = bishops.find((x) => normalName(x.name) === normalName(want)); if (!b) { const a = bishops.filter((x) => namesAlike(x.name, want)); if (a.length === 1) b = a[0]; }
  if (!b) { unmatched.push(f); continue; }
  const buf = readFileSync(`${DIR}/${f}`); const hash = createHash('sha1').update(buf).digest('hex').slice(0, 8);
  const rel = `assets/portraits/${b.id}-${hash}.webp`;
  if (!existsSync(`${root}${rel}`)) {
    await sharp(buf).rotate().resize({ width: 640, withoutEnlargement: true }).webp({ quality: 78 }).toFile(`${root}${rel}`);
    await sharp(buf).rotate().resize({ width: 400, withoutEnlargement: true }).webp({ quality: 80 }).toFile(`${root}assets/portraits/thumbs/${b.id}-${hash}.webp`);
  }
  overrides[b.id] = rel;
}
writeFileSync(file, JSON.stringify(overrides, null, 1) + '\n');
console.log(`${Object.keys(overrides).length} bishop portraits set from the office's Drive folder${unmatched.length ? ` · no bishop record for: ${unmatched.join(', ')}` : ''}`);
