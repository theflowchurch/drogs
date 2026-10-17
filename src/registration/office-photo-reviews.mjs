import { applyAction, directoryPeople } from './model.mjs';

// Apply explicit office review instructions once, against the currently selected
// portrait (including saved uploads). Later uploads or office reviews take over.
export const OFFICE_PHOTO_REVIEW_RULINGS = [
  { id: 'S4994a2da-5272', status: 'replace', codes: ['OFFICE'], source: 'Joshua 17 Oct 2026: Isaac Bonuedi photo outstanding under ES Joy; keep the current photo visible pending replacement' },
];
export function applyOfficePhotoReviews(state, references, rulings = OFFICE_PHOTO_REVIEW_RULINGS) {
  let next = state;
  for (const rule of rulings) {
    if (next.audit.some(a => a.action === 'officePhotoReviewRuling' && a.target === rule.id && a.detail?.source === rule.source)) continue;
    const person = directoryPeople({ ...next, hidden: [] }, references).find(p => p.id === rule.id);
    if (!person || (!person.image && !person.photo)) continue;
    next = applyAction(next, { id: 'system', office: true }, 'reviewPhoto', { referenceId: rule.id, status: rule.status, codes: rule.codes }, undefined, references);
    next.audit.push({ id: crypto.randomUUID(), actor: 'system', at: new Date().toISOString(), action: 'officePhotoReviewRuling', target: rule.id, detail: { source: rule.source } });
  }
  return next === state ? null : next;
}
