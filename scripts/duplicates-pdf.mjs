// "Potential duplicates" PDF for the office. People are grouped when any of these link them:
//   the same picture (perceptual hash), the same name (any word order), or a name that resembles
//   another's in the same country (fuller/shorter form, respelling). Each group shows photos, bishop,
//   place and birthday/age (from the office's PASTORS DATA.xlsx in Downloads, never stored in the repo).
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { normalName, namesAlike, placeOf, titleFor, bySurname } from '../src/registration/model.mjs';
import { birthOf, birthText } from './lib/office-dob.mjs';
import { dhash, hamming, SAME_PICTURE } from './lib/photo-hash.mjs';
import { words } from './lib/names.mjs';
const root = new URL('..', import.meta.url).pathname;
const people = JSON.parse(readFileSync(`${root}src/registration/reference-people.json`, 'utf8'));
const dobOf = (p) => birthText(birthOf(p));
mkdirSync(`${root}.tmp-checks/pdfthumbs`, { recursive: true });
const pending = [];
const thumbPath = (p) => { const t = p.image.replace(/^(assets\/(?:portraits|bishops|pastors))\/([^/]+)\.[^.]+$/, '$1/thumbs/$2.webp'); return existsSync(`${root}${t}`) ? t : p.image; };
const thumb = (p) => { if (!p.image) return ''; const out = `.tmp-checks/pdfthumbs/${p.id}.jpg`; pending.push(existsSync(`${root}${out}`) ? null : sharp(`${root}${thumbPath(p)}`).resize({ width: 180, withoutEnlargement: true }).jpeg({ quality: 72 }).toFile(`${root}${out}`).catch(() => {})); return `http://localhost:4301/${out}`; };
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
// ---- links
const parent = new Map(people.map((p) => [p.id, p.id])); const find = (x) => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x))), parent.get(x)));
const why = new Map(); const link = (a, b, reason) => { parent.set(find(a.id), find(b.id)); why.set([a.id, b.id].sort().join('+'), reason); };
const sorted = (n) => words(n).sort().join(' ');
const bySorted = new Map(); for (const p of people) { const k = sorted(p.name); if (!bySorted.has(k)) bySorted.set(k, []); bySorted.get(k).push(p); }
for (const g of bySorted.values()) for (let i = 1; i < g.length; i++) link(g[0], g[i], 'same name');
const country = (p) => words(p.country || '')[0] || '';
const byCountry = new Map(); for (const p of people) { const k = country(p); if (!byCountry.has(k)) byCountry.set(k, []); byCountry.get(k).push(p); }
const blank = byCountry.get('') || [];
for (const [k, list] of byCountry) { const pool = k ? [...list, ...blank] : list; for (let i = 0; i < list.length; i++) for (let j = 0; j < pool.length; j++) { const a = list[i], b = pool[j]; if (a.id >= b.id && pool === list) continue; if (a.id === b.id || sorted(a.name) === sorted(b.name)) continue; if (namesAlike(a.name, b.name)) link(a, b, words(a.name).length !== words(b.name).length ? 'fuller or shorter form of the name' : 'spelling differs'); } }
const pictured = people.filter((p) => p.image && existsSync(`${root}${p.image}`));
const hashes = []; for (let i = 0; i < pictured.length; i += 50) await Promise.all(pictured.slice(i, i + 50).map(async (p) => { try { hashes.push([p, await dhash(`${root}${thumbPath(p)}`)]); } catch {} }));
for (let i = 0; i < hashes.length; i++) for (let j = i + 1; j < hashes.length; j++) { const d = hamming(hashes[i][1], hashes[j][1]); const [a, b] = [hashes[i][0], hashes[j][0]]; const B = new Set(words(b.name)); const shared = words(a.name).some((w) => w.length > 2 && B.has(w)); if (d <= SAME_PICTURE) link(a, b, shared ? 'same picture, name in common' : 'same picture'); }
// ---- groups
const groups = new Map(); for (const p of people) { const r = find(p.id); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(p); }
const dupes = [...groups.values()].filter((g) => g.length > 1).map((g) => {
  g.sort(bySurname);
  const reasons = new Set(); for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) { const r = why.get([g[i].id, g[j].id].sort().join('+')); if (r) reasons.add(r); }
  const births = g.map(dobOf).filter(Boolean); const sameDob = births.length === g.length && new Set(births).size === 1;
  const samePlace = new Set(g.map((p) => normalName(placeOf(p)))).size === 1;
  const picture = [...reasons].some((r) => r.startsWith('same picture'));
  const verdict = picture || sameDob || (reasons.has('same name') && samePlace) ? 'likely' : 'check';
  return { g, reasons: [...reasons], sameDob, samePlace, verdict };
});
dupes.sort((a, b) => (a.verdict === 'likely' ? 0 : 1) - (b.verdict === 'likely' ? 0 : 1) || bySurname(a.g[0], b.g[0]));
const img = (p) => p.image ? `<img src="${thumb(p)}">` : '<div class="nophoto">no photo</div>';
const card = (p) => `<div class="card">${img(p)}<b>${esc(p.name)}</b><span>${esc(titleFor(p))}${p.role === 'pastor' && p.bishop ? ` · under Bishop ${esc(p.bishop)}` : ''}${p.unclaimed ? ' · <i>unclaimed</i>' : ''}</span><span>${esc(p.denomination || p.group || '')}</span><span>${esc(placeOf(p) || 'place unknown')}</span><span class="dob">Born ${esc(dobOf(p) || 'unknown')}</span><span class="id">${esc(p.id)}</span></div>`;
const block = (d) => `<section class="dup ${d.verdict}"><div class="tag">${d.verdict === 'likely' ? 'LIKELY THE SAME PERSON' : 'CHECK'} · ${esc(d.reasons.join(' · '))}${d.sameDob ? ' · same birthday and age' : ''}${d.samePlace ? ' · same place' : ''}</div><div class="cards">${d.g.map(card).join('')}</div></section>`;
const css = `@page { size: A4; margin: 14mm 12mm; } body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color: #13324c; font-size: 10.5px; }
  .cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; text-align: center; page-break-after: always; } .cover h1 { font-size: 46px; margin: 0 0 10px; line-height: 1.05; } .cover h1 small { display: block; font-size: 14px; letter-spacing: .3em; color: #6a7283; margin-bottom: 14px; } .cover p { max-width: 560px; margin: 8px auto; color: #425466; font-size: 13px; line-height: 1.5; }
  .cover table { margin: 24px auto 0; border-collapse: collapse; font-size: 13px; } .cover td { padding: 5px 16px; border-bottom: 1px solid #dfe6f3; text-align: left; } .cover td:last-child { text-align: right; font-weight: 700; }
  h1.part { font-size: 24px; margin: 0 0 10px; page-break-before: always; } .dup { page-break-inside: avoid; border: 1px solid #e7ecf5; border-radius: 10px; padding: 8px 10px 10px; margin: 0 0 10px; } .dup.likely { border-color: #f3b4ae; background: #fff7f6; }
  .tag { font-size: 9.5px; font-weight: 700; letter-spacing: .06em; color: #6a7283; margin-bottom: 6px; } .likely .tag { color: #b42318; }
  .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; } .card { display: flex; flex-direction: column; gap: 2px; } .card b { font-size: 12px; margin-top: 4px; } .card span { color: #425466; } .card img, .card .nophoto { width: 92px; height: 112px; object-fit: cover; border-radius: 6px; background: #e6ece9; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #8a94a6; } .dob { font-weight: 600; } .id { color: #a0a8b8; font-size: 9px; }`;
const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const likely = dupes.filter((d) => d.verdict === 'likely'), check = dupes.filter((d) => d.verdict === 'check');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
<div class="cover"><h1><small>KURIAKE CASTLE</small>POTENTIAL DUPLICATES</h1><p>People on the roll who may be one person filed twice: the same picture on two records, the same name, or a name that is a fuller, shorter or respelled form of another's in the same country. Red boxes are almost certainly one person (same picture, or same name with the same birthday or place). The rest need a look.</p>
<table><tr><td>Groups</td><td>${dupes.length}</td></tr><tr><td>Likely the same person</td><td>${likely.length}</td></tr><tr><td>To check</td><td>${check.length}</td></tr><tr><td>Records involved</td><td>${dupes.reduce((n, d) => n + d.g.length, 0)}</td></tr></table><p style="margin-top:28px;color:#8a94a6">${date}</p></div>
<h1 class="part">Likely the same person · ${likely.length}</h1>${likely.map(block).join('')}
<h1 class="part">To check · ${check.length}</h1>${check.map(block).join('')}</body></html>`;
await Promise.all(pending.filter(Boolean));
const out = `${process.env.HOME}/Downloads/Kuriake Castle Project/02 Deliverables for the office/Kuriake Castle - potential duplicates.pdf`;
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }); const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle', timeout: 300000 }); await page.emulateMedia({ media: 'print' });
await page.pdf({ path: out, format: 'A4', printBackground: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: `<div style="width:100%;text-align:center;font-size:9px;color:#8a94a6;font-family:Arial">Kuriake Castle · Potential duplicates · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`, margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' } });
await browser.close();
console.log(`${dupes.length} groups (${likely.length} likely, ${check.length} to check; ${dupes.reduce((n, d) => n + d.g.length, 0)} records) → ${out.split('/').pop()}`);
