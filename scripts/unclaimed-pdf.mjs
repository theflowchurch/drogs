// "Unclaimed pastors" PDF for the office: every pastor under no confirmed bishop, grouped by the reason, with photo.
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { placeOf, titleFor, bySurname } from '../src/registration/model.mjs';
import { birthOf, birthText } from './lib/office-dob.mjs';
const root = new URL('..', import.meta.url).pathname;
const people = JSON.parse(readFileSync(`${root}src/registration/reference-people.json`, 'utf8'));
const unclaimed = people.filter((p) => p.unclaimed);
mkdirSync(`${root}.tmp-checks/pdfthumbs`, { recursive: true });
const pending = [];
const thumb = (p) => { if (!p.image) return ''; const t = p.image.replace(/^(assets\/(?:portraits|bishops|pastors))\/([^/]+)\.[^.]+$/, '$1/thumbs/$2.webp'); const src = `${root}${existsSync(`${root}${t}`) ? t : p.image}`; const out = `.tmp-checks/pdfthumbs/${p.id}.jpg`; pending.push(existsSync(`${root}${out}`) ? null : sharp(src).resize({ width: 180, withoutEnlargement: true }).jpeg({ quality: 72 }).toFile(`${root}${out}`).catch(() => {})); return `http://localhost:4301/${out}`; };
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const img = (p) => p.image ? `<img src="${thumb(p)}">` : '<div class="nophoto">no photo</div>';
// Reasons, biggest group first; the typed bishop's name is the heading.
const reasons = [...new Set(unclaimed.map((p) => p.unclaimed))].sort((a, b) => unclaimed.filter((p) => p.unclaimed === b).length - unclaimed.filter((p) => p.unclaimed === a).length);
const heading = (r) => r.replace(/^Not on the list (Bishop .+) submitted$/, 'Not on the sheet $1 sent back').replace(/^(.+) is not on the bishops list$/, 'Filed under $1, who is not on the bishops list');
const row = (p) => `<tr><td>${img(p)}</td><td><b>${esc(p.name)}</b><br><span class="muted">${esc(titleFor(p))}</span></td><td>${esc(p.denomination || '-')}<br><span class="muted">${esc(p.group || p.organization || '')}</span></td><td>${esc(placeOf(p) || '-')}</td><td>${esc(birthText(birthOf(p)) || '-')}</td><td>${esc(p.yearAppointed || '-')}</td><td class="muted">${esc(p.id)}</td></tr>`;
const section = (r) => { const list = unclaimed.filter((p) => p.unclaimed === r).sort(bySurname); return `<section class="group"><h1>${esc(heading(r))}</h1><p class="count">${list.length} pastor${list.length === 1 ? '' : 's'}</p><table class="b"><thead><tr><th>Photo</th><th>Name</th><th>Denomination · Group</th><th>Place</th><th>Born</th><th>Appointed</th><th>Record</th></tr></thead><tbody>${list.map(row).join('')}</tbody></table></section>`; };
const css = `@page { size: A4; margin: 14mm 12mm; } body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color: #13324c; font-size: 10.5px; }
  .cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; text-align: center; page-break-after: always; } .cover h1 { font-size: 46px; margin: 0 0 10px; line-height: 1.05; } .cover h1 small { display: block; font-size: 14px; letter-spacing: .3em; color: #6a7283; margin-bottom: 14px; } .cover p { max-width: 560px; margin: 8px auto; color: #425466; font-size: 13px; line-height: 1.5; }
  .cover table { margin: 24px auto 0; border-collapse: collapse; font-size: 12.5px; } .cover td { padding: 5px 16px; border-bottom: 1px solid #dfe6f3; text-align: left; } .cover td:last-child { text-align: right; font-weight: 700; }
  .group { page-break-before: always; } .group h1 { font-size: 20px; margin: 0 0 2px; } .count { margin: 0 0 12px; color: #6a7283; font-size: 12px; }
  table.b { width: 100%; border-collapse: collapse; } table.b th { text-align: left; font-size: 9.5px; color: #6a7283; padding: 3px 5px; border-bottom: 1px solid #c9d3e6; } table.b td { padding: 4px 5px; border-bottom: 1px solid #e7ecf5; vertical-align: middle; } table.b tr { page-break-inside: avoid; }
  table.b img, table.b .nophoto { width: 46px; height: 58px; object-fit: cover; border-radius: 5px; background: #e6ece9; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #8a94a6; } .muted { color: #6a7283; }`;
const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
<div class="cover"><h1><small>KURIAKE CASTLE</small>UNCLAIMED PASTORS</h1><p>Pastors on the roll under no confirmed bishop. They are off the public directory until a bishop names them on a submitted sheet. Grouped by the reason they are unclaimed.</p>
<table>${reasons.map((r) => `<tr><td>${esc(heading(r))}</td><td>${unclaimed.filter((p) => p.unclaimed === r).length}</td></tr>`).join('')}<tr><td><b>Total</b></td><td>${unclaimed.length}</td></tr></table><p style="margin-top:28px;color:#8a94a6">${date}</p></div>
${reasons.map(section).join('')}</body></html>`;
await Promise.all(pending.filter(Boolean));
const out = `${process.env.HOME}/Downloads/Kuriake Castle Project/02 Deliverables for the office/Kuriake Castle - unclaimed pastors.pdf`;
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }); const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle', timeout: 300000 }); await page.emulateMedia({ media: 'print' });
await page.pdf({ path: out, format: 'A4', printBackground: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: `<div style="width:100%;text-align:center;font-size:9px;color:#8a94a6;font-family:Arial">Kuriake Castle · Unclaimed pastors · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`, margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' } });
await browser.close();
console.log(`${unclaimed.length} unclaimed in ${reasons.length} groups → ${out.split('/').pop()}`);
