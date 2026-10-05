// Review PDFs for the office, with the photos in them:
//  1. Bishops – what is missing (every bishop, grouped, with photo, years and photo verdict)
//  2. Pastors – photos to replace (grouped by group and bishop, with the photo and the reason)
import { readFileSync, existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { orgLabel, placeOf, titleFor, pastorsOf, bySurname } from '../src/registration/model.mjs';
const root = new URL('..', import.meta.url).pathname;
const people = JSON.parse(readFileSync(`${root}src/registration/reference-people.json`, 'utf8'));
const quality = JSON.parse(readFileSync(`${root}data/photo-quality.json`, 'utf8'));
const manual = JSON.parse(readFileSync(`${root}data/photo-manual-flags.json`, 'utf8'));
const NEED = { red: 0.22, yellow: 0.22, dark: 0.3, magenta: 0.05 };
const problems = (p) => {
  const q = quality[p.id]; if (!p.image) return ['no photo']; if (!q) return [];
  const r = [];
  if (manual[p.id]) r.push(manual[p.id].replace(/\s*\(.*\)/, ''));
  if (q.verdict === 'no-face') r.push('no face found'); else if (q.verdict === 'many-faces') r.push('more than one person');
  else if (q.shares) { if (!Object.entries(NEED).some(([c, n]) => (q.shares[c] || 0) >= n) && !manual[p.id]) r.push('no official attire seen (casual clothes)'); if (q.background !== null && q.background < 0.5) r.push('background not a plain white wall'); }
  if (q.width && q.width < 300) r.push(`very small photo (${q.width}px)`); if (q.blur !== undefined && q.blur < 100) r.push('blurry');
  return r;
};
const thumb = (p) => { if (!p.image) return ''; const t = p.image.replace(/^(assets\/(?:portraits|bishops|pastors))\/([^/]+)\.[^.]+$/, '$1/thumbs/$2.webp'); return `http://localhost:4301/${existsSync(`${root}${t}`) ? t : p.image}`; };
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const groupOf = (p) => p.group || orgLabel(p.organization) || 'Other';
const yr = (v) => v ? `<span class="ok">${esc(v)}</span>` : '<span class="miss">missing</span>';
const img = (p) => p.image ? `<img src="${thumb(p)}">` : '<div class="nophoto">no photo</div>';
const css = `@page { size: A4; margin: 14mm 12mm; } body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color: #13324c; font-size: 10.5px; }
  .cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; text-align: center; page-break-after: always; } .cover h1 { font-size: 52px; margin: 0 0 10px; line-height: 1.05; } .cover h1 small { display: block; font-size: 18px; letter-spacing: .3em; color: #6a7283; margin-bottom: 16px; font-weight: 600; } .cover p { font-size: 15px; color: #425466; margin: 6px 0; max-width: 640px; margin-left: auto; margin-right: auto; }
  .cover table { margin: 24px auto 0; border-collapse: collapse; font-size: 13px; } .cover td { padding: 5px 16px; border-bottom: 1px solid #dfe6f3; text-align: left; white-space: nowrap; } .cover td:last-child { text-align: right; font-weight: 700; }
  .legend { margin: 18px auto 0; text-align: left; max-width: 640px; font-size: 12px; line-height: 1.5; color: #425466; }
  .group { page-break-before: always; } .group h1 { font-size: 30px; margin: 0 0 2px; } .count { margin: 0 0 12px; color: #6a7283; font-size: 12px; }
  h2 { font-size: 14px; margin: 16px 0 6px; padding: 4px 8px; background: #eef3fc; border-radius: 6px; page-break-after: avoid; }
  table.b { width: 100%; border-collapse: collapse; } table.b th { text-align: left; font-size: 9.5px; color: #6a7283; padding: 3px 5px; border-bottom: 1px solid #c9d3e6; } table.b td { padding: 4px 5px; border-bottom: 1px solid #e7ecf5; vertical-align: top; } tr { page-break-inside: avoid; }
  table.b img, table.b .nophoto { width: 46px; height: 58px; object-fit: cover; border-radius: 5px; background: #e6ece9; display: block; } .nophoto { display: flex; align-items: center; justify-content: center; font-size: 8px; color: #8a94a6; text-align: center; }
  .miss { color: #b42318; font-weight: 700; } .ok { color: #1f7a4d; } .issue { color: #b42318; } .fine { color: #1f7a4d; } .muted { color: #6a7283; }
  .cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; } .card { page-break-inside: avoid; border: 1px solid #e7ecf5; border-radius: 8px; padding: 6px; } .card img { width: 100%; height: 118px; object-fit: cover; border-radius: 5px; background: #e6ece9; display: block; } .card b { display: block; margin-top: 5px; font-size: 10px; } .card small { display: block; color: #6a7283; font-size: 9px; } .card .issue { font-size: 9px; display: block; margin-top: 3px; }`;
const render = async (html, out) => { const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }); const page = await browser.newPage(); await page.setContent(html, { waitUntil: 'networkidle', timeout: 180000 }); await page.emulateMedia({ media: 'print' }); await page.pdf({ path: out, format: 'A4', printBackground: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: `<div style="width:100%;text-align:center;font-size:9px;color:#8a94a6;font-family:Arial">${esc(out.split('/').pop().replace('.pdf', ''))} · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`, margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' } }); await browser.close(); console.log('written', out); };
const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const dir = `${process.env.HOME}/Downloads/kuriake-data-quality`;
// ---- 1. Bishops
const bishops = people.filter((p) => p.role === 'bishop');
const groups = [...new Set(bishops.map(groupOf))].sort((a, b) => bishops.filter((x) => groupOf(x) === b).length - bishops.filter((x) => groupOf(x) === a).length);
const bRow = (b) => { const pr = problems(b); const n = pastorsOf(b, people).length; return `<tr><td>${img(b)}</td><td><b>${esc(b.name)}</b><br><span class="muted">${esc(titleFor(b))} · ${esc(b.denomination || '-')}<br>${esc(placeOf(b) || '-')} · ${n ? `${n} pastor${n === 1 ? '' : 's'}` : '<span class="miss">no pastors</span>'}</span></td><td>${yr(b.yearAppointed)}</td><td>${yr(b.yearOrdained)}</td><td>${yr(b.yearConsecrated)}</td><td>${pr.length ? `<span class="issue">${esc(pr.join('; '))}</span>` : '<span class="fine">photo fine</span>'}</td></tr>`; };
const bSummary = groups.map((g) => { const list = bishops.filter((b) => groupOf(b) === g); return `<tr><td>${esc(g)}</td><td>${list.length} bishops · ${list.filter((b) => !b.yearAppointed || !b.yearOrdained || !b.yearConsecrated).length} missing a year · ${list.filter((b) => problems(b).length).length} photo to fix</td></tr>`; }).join('');
const bBody = groups.map((g) => { const list = bishops.filter((b) => groupOf(b) === g).sort(bySurname); return `<section class="group"><h1>${esc(g.toUpperCase())}</h1><p class="count">${list.length} bishops</p><table class="b"><thead><tr><th>Photo</th><th>Bishop</th><th>Appointed</th><th>Ordained</th><th>Consecrated</th><th>Photo check</th></tr></thead><tbody>${list.map(bRow).join('')}</tbody></table></section>`; }).join('');
await render(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="cover"><h1><small>KURIAKE CASTLE</small>BISHOPS<br>WHAT IS MISSING</h1><p>Every bishop on the roll, in their group, with the photo on file, the three years and what the photo check found. ${date}.</p><table>${bSummary}</table><div class="legend"><b>How to read it.</b> A year in red says <b>missing</b>: the office data has no year appointed, ordained or consecrated for that bishop. <b>Photo check</b> in red names the problem: no face, casual clothes, a background that is not a plain wall, a very small or blurry photo. <b>No pastors</b> in red means no pastor on the roll, in the office photo folders or in the office spreadsheet names this bishop.</div></div>${bBody}</body></html>`, `${dir}/Kuriake Castle - Bishops - what is missing.pdf`);
// ---- 2. Pastors photos to replace
const pastors = people.filter((p) => p.role === 'pastor' && p.image && problems(p).length);
const pGroups = [...new Set(pastors.map(groupOf))].sort((a, b) => pastors.filter((x) => groupOf(x) === b).length - pastors.filter((x) => groupOf(x) === a).length);
const pSummary = pGroups.map((g) => `<tr><td>${esc(g)}</td><td>${pastors.filter((x) => groupOf(x) === g).length}</td></tr>`).join('') + `<tr><td><b>Total</b></td><td>${pastors.length}</td></tr>`;
const pBody = pGroups.map((g) => { const list = pastors.filter((x) => groupOf(x) === g); const byB = new Map(); for (const p of list) (byB.get(p.bishop || 'No bishop recorded') || byB.set(p.bishop || 'No bishop recorded', []).get(p.bishop || 'No bishop recorded')).push(p);
  return `<section class="group"><h1>${esc(g.toUpperCase())}</h1><p class="count">${list.length} photos to replace</p>` + [...byB].sort((a, b) => a[0].localeCompare(b[0])).map(([b, ps]) => `<h2>${b === 'No bishop recorded' ? b : 'Bishop ' + esc(b)} <span class="muted">· ${ps.length}</span></h2><div class="cards">${ps.sort(bySurname).map((p) => `<div class="card"><img src="${thumb(p)}"><b>${esc(titleFor(p) !== 'Pastor' ? titleFor(p) + ' ' : '')}${esc(p.name)}</b><small>${esc(placeOf(p) || '')}</small><span class="issue">${esc(problems(p).join('; '))}</span></div>`).join('')}</div>`).join('') + '</section>'; }).join('');
await render(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="cover"><h1><small>KURIAKE CASTLE</small>PASTORS<br>PHOTOS TO REPLACE</h1><p>${pastors.length} pastors whose photo on file needs a new one, grouped by group and by the bishop they are under, with the reason under each picture. ${date}.</p><table>${pSummary}</table><div class="legend"><b>Reasons.</b> <b>No official attire seen</b>: the clothes in the photo are not the red jacket, a dark suit, the clerical shirt or the official dress, so most likely casual clothes. <b>Background not a plain white wall</b>: taken outdoors or in a room. <b>Very small</b> or <b>blurry</b>: the file is too small or too soft to print. <b>No face found</b>: not a portrait. <b>More than one person</b>: a group picture.</div></div>${pBody}</body></html>`, `${dir}/Kuriake Castle - Pastors - photos to replace.pdf`);
