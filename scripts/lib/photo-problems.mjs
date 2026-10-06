// What is wrong with a person's photo on file, from the scan (data/photo-quality.json),
// the office's eye-flags (photo-manual-flags.json) and approvals (photo-approved.json).
// Shared by the data-quality workbook, the review PDFs and the photo-fix pack.
import { readFileSync } from 'node:fs';
import { judge } from '../../src/registration/attire-check.mjs';
const root = new URL('../..', import.meta.url).pathname;
const read = (f, fallback) => { try { return JSON.parse(readFileSync(`${root}${f}`, 'utf8')); } catch { return fallback; } };
export const quality = read('data/photo-quality.json', {}), manual = read('data/photo-manual-flags.json', {}), approved = read('data/photo-approved.json', {});
export function photoProblems(p) {
  if (!p.image) return ['no photo'];
  const q = quality[p.id]; if (!q) return [];
  const r = [];
  if (manual[p.id]) r.push(manual[p.id].replace(/\s*\(.*\)/, ''));
  if (q.verdict === 'no-face') r.push('no face found (not a portrait)');
  else if (q.verdict === 'many-faces') r.push('more than one person');
  else if (q.shares && !manual[p.id] && !approved[p.id] && !q.tooTight && !judge(q.shares, p.role))
    r.push(p.role === 'bishop' ? 'not in the red jacket' : 'no official attire seen (casual clothes)');
  if (q.width && q.width < 300) r.push(`very small photo (${q.width}px wide)`);
  if (q.blur !== undefined && q.blur < 100) r.push('blurry or very soft');
  return r;
}
