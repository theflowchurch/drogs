// "Potential duplicates" PDF for the office: everyone who shares a name with someone else on the roll,
// side by side with photo, title, bishop, place and date of birth (from the office's PASTORS DATA.xlsx,
// read from Downloads and never stored in the repo). Same name + same birthday = likely one person.
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { normalName, placeOf, titleFor, bySurname } from '../src/registration/model.mjs';
const root = new URL('..', import.meta.url).pathname;
const people = JSON.parse(readFileSync(`${root}src/registration/reference-people.json`, 'utf8'));
import { birthOf, birthText } from './lib/office-dob.mjs';
const dobOf = (p) => birthText(birthOf(p));
mkdirSync(`${root}.tmp-checks/pdfthumbs`, { recursive: true });
const pending = [];
const thumb = (p) => { if (!p.image) return ''; const t = p.image.replace(/^(assets\/(?:portraits|bishops|pastors))\/([^/]+)\.[^.]+$/, '$1/thumbs/$2.webp'); const src = `${root}${existsSync(`${root}${t}`) ? t : p.image}`; const out = `.tmp-checks/pdfthumbs/${p.id}.jpg`; pending.push(existsSync(`${root}${out}`) ? null : sharp(src).resize({ width: 180, withoutEnlargement: true }).jpeg({ quality: 72 }).toFile(`${root}${out}`).catch(() => {})); return `http://localhost:4301/${out}`; };
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const sorted = (n) => normalName(n).split(' ').filter(Boolean).sort().join(' ');
// Groups: identical names first, then the same words in another order.
const groups = new Map();
for (const p of people) { const k = sorted(p.name); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
const dupes = [...groups.values()].filter((g) => g.length > 1).map((g) => { const d = g.map(dobOf); const sameDob = d.every((x) => x && x === d[0]); const samePlace = new Set(g.map((p) => normalName(placeOf(p)))).size === 1; const identical = new Set(g.map((p) => normalName(p.name))).size === 1; return { g: g.sort(bySurname), sameDob, samePlace, identical, verdict: sameDob || (samePlace && identical) ? 'likely' : 'check' }; });
dupes.sort((a, b) => (a.verdict === 'likely' ? 0 : 1) - (b.verdict === 'likely' ? 0 : 1) || bySurname(a.g[0], b.g[0]));
const img = (p) => p.image ? `<img src="${thumb(p)}">` : '<div class="nophoto">no photo</div>';
const card = (p) => `<div class="card">${img(p)}<b>${esc(p.name)}</b><span>${esc(titleFor(p))}${p.role === 'pastor' && p.bishop ? ` · under Bishop ${esc(p.bishop)}` : ''}${p.unclaimed ? ' · <i>unclaimed</i>' : ''}</span><span>${esc(p.denomination || p.group || '')}</span><span>${esc(placeOf(p) || 'place unknown')}</span><span class="dob">Born ${esc(dobOf(p) || 'unknown')}</span><span class="id">${esc(p.id)}</span></div>`;
const block = (d) => `<section class="dup ${d.verdict}"><div class="tag">${d.verdict === 'likely' ? 'LIKELY THE SAME PERSON' : 'CHECK'} · ${d.sameDob ? 'same birthday and age' : d.identical ? 'same name' : 'same words, different order'}${d.samePlace ? ', same place' : ''}</div><div class="cards">${d.g.map(card).join('')}</div></section>`;
const css = `@page { size: A4; margin: 14mm 12mm; } body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color: #13324c; font-size: 10.5px; }
  .cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; text-align: center; page-break-after: always; } .cover h1 { font-size: 46px; margin: 0 0 10px; line-height: 1.05; } .cover h1 small { display: block; font-size: 14px; letter-spacing: .3em; color: #6a7283; margin-bottom: 14px; } .cover p { max-width: 560px; margin: 8px auto; color: #425466; font-size: 13px; line-height: 1.5; }
  .cover table { margin: 24px auto 0; border-collapse: collapse; font-size: 13px; } .cover td { padding: 5px 16px; border-bottom: 1px solid #dfe6f3; text-align: left; } .cover td:last-child { text-align: right; font-weight: 700; }
  h1.part { font-size: 24px; margin: 0 0 10px; page-break-before: always; } .dup { page-break-inside: avoid; border: 1px solid #e7ecf5; border-radius: 10px; padding: 8px 10px 10px; margin: 0 0 10px; } .dup.likely { border-color: #f3b4ae; background: #fff7f6; }
  .tag { font-size: 9.5px; font-weight: 700; letter-spacing: .06em; color: #6a7283; margin-bottom: 6px; } .likely .tag { color: #b42318; }
  .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; } .card { display: flex; flex-direction: column; gap: 2px; } .card b { font-size: 12px; margin-top: 4px; } .card span { color: #425466; } .card img, .card .nophoto { width: 92px; height: 112px; object-fit: cover; border-radius: 6px; background: #e6ece9; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #8a94a6; } .dob { font-weight: 600; } .id { color: #a0a8b8; font-size: 9px; }`;
const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const likely = dupes.filter((d) => d.verdict === 'likely'), check = dupes.filter((d) => d.verdict === 'check');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
<div class="cover"><h1><small>KURIAKE CASTLE</small>POTENTIAL DUPLICATES</h1><p>Everyone on the roll who shares a name with someone else, side by side with their photo, bishop, place and date of birth (from the office's pastors data). Red boxes have the same birthday and age, or the same name in the same place: almost certainly one person. The rest share a name but differ in place or birthday, and need a look.</p>
<table><tr><td>Groups of people sharing a name</td><td>${dupes.length}</td></tr><tr><td>Likely the same person</td><td>${likely.length}</td></tr><tr><td>To check</td><td>${check.length}</td></tr><tr><td>Records involved</td><td>${dupes.reduce((n, d) => n + d.g.length, 0)}</td></tr></table><p style="margin-top:28px;color:#8a94a6">${date}</p></div>
<h1 class="part">Likely the same person · ${likely.length}</h1>${likely.map(block).join('')}
<h1 class="part">To check · ${check.length}</h1>${check.map(block).join('')}</body></html>`;
await Promise.all(pending.filter(Boolean));
const out = `${process.env.HOME}/Downloads/Kuriake Castle Project/02 Deliverables for the office/Kuriake Castle - potential duplicates.pdf`;
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }); const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle', timeout: 180000 }); await page.emulateMedia({ media: 'print' });
await page.pdf({ path: out, format: 'A4', printBackground: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: `<div style="width:100%;text-align:center;font-size:9px;color:#8a94a6;font-family:Arial">Kuriake Castle · Potential duplicates · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`, margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' } });
await browser.close();
console.log(`${dupes.length} name groups (${likely.length} likely, ${check.length} to check) → ${out.split('/').pop()}`);
