// Backdrop behind each bishop: lightness and unevenness of the band above the head
// (the top 14 % of the picture). Writes data/bishop-backdrops.json for the photo review.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import sharp from 'sharp';
const root = new URL('..', import.meta.url).pathname;
const people = JSON.parse(readFileSync(`${root}src/registration/reference-people.json`, 'utf8'));
const out = {};
for (const b of people.filter((p) => p.role === 'bishop' && p.image)) {
  const file = `${root}${b.image}`; if (!existsSync(file)) continue;
  const { data, info } = await sharp(file).greyscale().resize({ width: 200 }).raw().toBuffer({ resolveWithObject: true });
  const band = Math.max(4, Math.round(info.height * 0.14)); let sum = 0, sq = 0, n = 0;
  for (let y = 0; y < band; y++) for (let x = 0; x < info.width; x++) { const v = data[y * info.width + x] / 255; sum += v; sq += v * v; n++; }
  const mean = sum / n; out[b.id] = { light: Math.round(mean * 100) / 100, spread: Math.round(Math.sqrt(Math.max(0, sq / n - mean * mean)) * 100) / 100 };
}
writeFileSync(`${root}data/bishop-backdrops.json`, JSON.stringify(out));
console.log('bishops measured:', Object.keys(out).length);
