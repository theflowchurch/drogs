import { directoryPeople, bySurname } from './model.mjs';
import { PHOTO_REVIEW, ORIGINALLY_MISSING } from './photo-review-baseline.mjs';

export const PHOTO_REASONS = {
  LOW: 'Blurry, dark or pixelated', TIGHT: 'Cropped too close to the face',
  FAR: 'Too far away; face too small', STRETCH: 'Photo stretched or distorted',
  DIRECTION: 'Face turned away from camera', EYES: 'Eyes not visible',
  CASUAL: 'Casual clothes', TIE: 'Open shirt collar without a tie or cord',
  BG: 'Busy background or outdoors', BGCOLOUR: 'Background not white',
  WDRESS: 'Not the appropriate attire for a Lady Pastor', UNREVIEWED: 'Could not be reviewed',
  OFFICE: 'Replacement requested by the office',
};
// Permanent media keys, never an expiring signed URL or a person's spelling.
export const photoKey = (person) => person?.photo ? `upload:${person.photo}` : person?.image ? `image:${person.image}` : '';
export function photoTask(person, state, reviews = PHOTO_REVIEW) {
  const photo = photoKey(person);
  if (!photo) return { status: 'missing', codes: [] };
  const review = state.photoReviews?.[person.id] || reviews[person.id];
  if (review && review.status !== 'ok' && review.photo === photo && review.codes?.length && person.organization !== 'FLOW')
    return { status: 'replace', codes: review.codes };
  return { status: 'ready', codes: [] };
}
export function photoProgress(state, references, year = state.year, reviews = PHOTO_REVIEW, originallyMissing = ORIGINALLY_MISSING) {
  // Hiding from the public roll doesn't remove a pastor from the office's photo work.
  const people = directoryPeople({ ...state, hidden: [] }, references, year).filter(p => p.role === 'pastor').sort(bySurname);
  const original = new Set(originallyMissing), active = new Set(people.map(p => p.id));
  const missingIds = [], replaceIds = [];
  let added = 0, replaced = 0;
  for (const p of people) {
    const task = photoTask(p, state, reviews), key = photoKey(p);
    if (task.status === 'missing') missingIds.push(p.id);
    if (task.status === 'replace') replaceIds.push(p.id);
    if (key && original.has(p.id)) added++;
    if (key && reviews[p.id]?.codes?.length && reviews[p.id].photo !== key && task.status === 'ready' && p.organization !== 'FLOW') replaced++;
  }
  return { missing: missingIds.length, replace: replaceIds.length, added, replaced, total: people.length,
    originalMissing: original.size, removedFromOriginal: [...original].filter(id => !active.has(id)).length,
    missingIds, replaceIds };
}

// Reports need the office's exact totals by overseer, including saved reviews
// and draft uploads. Publish aggregate counts without individual review lists.
export function photoProgressGroups(state, references, progress, year = state.year) {
  const missing = new Set(progress.missingIds), replace = new Set(progress.replaceIds);
  const groups = new Map();
  for (const p of directoryPeople({ ...state, hidden: [] }, references, year)) {
    if (p.role !== 'pastor' || (!missing.has(p.id) && !replace.has(p.id))) continue;
    const bishop = p.bishop || '';
    if (!groups.has(bishop)) groups.set(bishop, { bishop, missing: 0, replace: 0 });
    const group = groups.get(bishop);
    if (missing.has(p.id)) group.missing++;
    if (replace.has(p.id)) group.replace++;
  }
  return [...groups.values()].sort((a, b) => b.missing + b.replace - a.missing - a.replace || a.bishop.localeCompare(b.bishop));
}
