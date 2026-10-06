// Runs the site's own photo check (face, attire colour, plain background) over every
// portrait on the roll in headless Chrome, plus a blur and resolution measure in node.
// Writes data/photo-quality.json: id → { verdict fields }. Needs `python3 -m http.server 4301` at the repo root.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import sharp from 'sharp';
import { chromium } from 'playwright';
const people = JSON.parse(readFileSync(new URL('../src/registration/reference-people.json', import.meta.url), 'utf8'));
const prev = existsSync(new URL('../data/photo-quality.json', import.meta.url)) ? JSON.parse(readFileSync(new URL('../data/photo-quality.json', import.meta.url), 'utf8')) : {};
const todo = people.filter(p => p.image && !prev[p.id]);
console.log(`portraits to check: ${todo.length} (${Object.keys(prev).length} already done)`);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage();
await page.goto('http://localhost:4301/.tmp-checks/cal/index.html'); await page.waitForFunction(() => window.ready);
const blurOf = async (file) => {
  const { data, info } = await sharp(file).greyscale().resize({ width: 320, withoutEnlargement: true }).raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height; let sum = 0, sq = 0, n = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; const v = 4 * data[i] - data[i - 1] - data[i + 1] - data[i - w] - data[i + w]; sum += v; sq += v * v; n++; }
  const mean = sum / n; return { blur: Math.round(sq / n - mean * mean), width: (await sharp(file).metadata()).width };
};
let done = 0;
for (const p of todo) {
  const file = new URL(`../${p.image}`, import.meta.url).pathname;
  if (!existsSync(file)) { prev[p.id] = { missingFile: true }; continue; }
  try {
    const r = await page.evaluate(([u, person]) => window.run(u, person), [`http://localhost:4301/${p.image}`, { role: p.role, gender: p.gender, organization: p.organization, title: p.title }]);
    const { blur, width } = await blurOf(file);
    prev[p.id] = { verdict: r.verdict, note: r.note || '', shares: r.shares || null, background: r.background ?? null, tooTight: Boolean(r.tooTight), blur, width };
  } catch (e) { prev[p.id] = { error: String(e.message).slice(0, 80) }; }
  if (++done % 200 === 0) { writeFileSync(new URL('../data/photo-quality.json', import.meta.url), JSON.stringify(prev)); console.log('checked', done); }
}
writeFileSync(new URL('../data/photo-quality.json', import.meta.url), JSON.stringify(prev));
await browser.close();
console.log('done', done);
