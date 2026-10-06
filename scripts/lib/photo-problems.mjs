// What is wrong with a person's photo on file, from the scan (data/photo-quality.json),
// the office's eye-flags (photo-manual-flags.json) and approvals (photo-approved.json).
// Shared by the data-quality workbook, the review PDFs and the photo-fix pack.
import { readFileSync } from 'node:fs';
import { judge } from '../../src/registration/attire-check.mjs';
const root = new URL('../..', import.meta.url).pathname;
const read = (f, fallback) => { try { return JSON.parse(readFileSync(`${root}${f}`, 'utf8')); } catch { return fallback; } };
export const quality = read('data/photo-quality.json', {}), manual = read('data/photo-manual-flags.json', {}), approved = read('data/photo-approved.json', {}), backdrops = read('data/bishop-backdrops.json', {});
export function photoProblems(p) {
  if (!p.image) return ['no photo'];
  const q = quality[p.id]; if (!q) return [];
  const r = [];
  if (manual[p.id]) r.push(manual[p.id].replace(/\s*\(.*\)/, ''));
  if (q.verdict === 'no-face') r.push('no face found (not a portrait)');
  else if (q.verdict === 'many-faces') r.push('more than one person');
  else if (q.shares && !manual[p.id] && !approved[p.id] && !q.tooTight && !judge(q.shares, p.role))
    r.push(p.role === 'bishop' ? 'not in the red jacket' : 'no official attire seen (casual clothes)');
  // Bishops must be photographed on a white wall; a black or busy backdrop needs a new photo. For pastors the background is not held against them for now.
  if (p.role === 'bishop') {
    const bd = backdrops[p.id]; // the band above the head (scripts/bishop-backdrops.mjs), plus the strips beside the face from the scan
    // ponytail: the band above the head catches hats and hair, so only its darkness is trusted; a busy but bright backdrop is flagged by eye in photo-manual-flags.json.
    if ((bd && bd.light < 0.35) || (q.background !== null && q.background !== undefined && q.background < 0.5 && bd && bd.light < 0.6)) r.push('dark background: bishops must be on a plain white wall');
  }
  // Small or soft files are accepted for now (Joshua, 6 Oct 2026).
  return r;
}
