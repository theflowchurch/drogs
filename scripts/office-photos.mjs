// Portraits uploaded through the office portal ("Add photo" on a roll record) live on the server. This pulls every
// one for a roll id into the repo as an override (assets/portraits/<id>-<hash>.webp + thumb, data/bishop-photo-overrides.json),
// so the build, the PDFs and the site agree and the pictures survive a server reset. Run before build-roll.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
const root = new URL('..', import.meta.url).pathname; const SITE = process.env.SITE || 'https://kuriakecastle.org';
const people = JSON.parse(readFileSync(`${root}src/registration/reference-people.json`, 'utf8')); const ids = new Set(people.map((p) => p.id));
const file = `${root}data/bishop-photo-overrides.json`; const overrides = JSON.parse(readFileSync(file, 'utf8'));
const seen = JSON.parse(existsSync(`${root}data/office-photos-seen.json`) ? readFileSync(`${root}data/office-photos-seen.json`, 'utf8') : '{}'); // id → media key already pulled
const dir = await (await fetch(`${SITE}/api/registration/public-directory`)).json();
let pulled = 0, skipped = 0, failed = [];
for (const [id, o] of Object.entries(dir.overrides || {})) {
  if (!o.photo || !ids.has(id)) continue; if (seen[id] === o.photo) { skipped++; continue; }
  try {
    const { url } = await (await fetch(`${SITE}/api/registration/media?path=${encodeURIComponent(o.photo)}`)).json();
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer()); if (buf.length < 1000) throw new Error('empty download');
    const hash = createHash('sha1').update(buf).digest('hex').slice(0, 8); const rel = `assets/portraits/${id}-${hash}.webp`;
    if (!existsSync(`${root}${rel}`)) { await sharp(buf).rotate().resize({ width: 640, withoutEnlargement: true }).webp({ quality: 78 }).toFile(`${root}${rel}`); await sharp(buf).rotate().resize({ width: 400, withoutEnlargement: true }).webp({ quality: 80 }).toFile(`${root}assets/portraits/thumbs/${id}-${hash}.webp`); }
    overrides[id] = rel; seen[id] = o.photo; pulled++; console.log(`  ${id} ${people.find((p) => p.id === id).name} → ${rel}`);
  } catch (e) { failed.push(`${id}: ${e.message}`); }
}
writeFileSync(file, JSON.stringify(overrides, null, 1) + '\n'); writeFileSync(`${root}data/office-photos-seen.json`, JSON.stringify(seen, null, 1) + '\n');
console.log(`Office photos: ${pulled} pulled, ${skipped} already on file, ${failed.length} failed${failed.length ? ' — ' + failed.join('; ') : ''}`);
