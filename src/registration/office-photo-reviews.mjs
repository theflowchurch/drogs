import { applyAction, directoryPeople } from './model.mjs';

// Apply explicit office review instructions once, against the currently selected
// portrait (including saved uploads). Later uploads or office reviews take over.
export const OFFICE_PHOTO_REVIEW_RULINGS = [
  { id: 'S4994a2da-5272', bishopId: 'B323', status: 'replace', codes: ['OFFICE'], source: 'Joshua 17 Oct 2026: align Isaac Bonuedi saved assignment with ES Joy and leave his current photo visible pending replacement' },
];
export function applyOfficePhotoReviews(state, references, rulings = OFFICE_PHOTO_REVIEW_RULINGS) {
  let next = state;
  for (const rule of rulings) {
    if (next.audit.some(a => a.action === 'officePhotoReviewRuling' && a.target === rule.id && a.detail?.source === rule.source)) continue;
    const person = directoryPeople({ ...next, hidden: [] }, references).find(p => p.id === rule.id);
    if (!person || (!person.image && !person.photo)) continue;
    if (rule.bishopId) {
      const bishop = references.find(p => p.id === rule.bishopId && p.role === 'bishop');
      if (!bishop) throw Error('Office photo review ruling requires a current bishop.');
      next = applyAction(next, { id: 'system', office: true }, 'editReference', { referenceId: rule.id, fields: { role: 'pastor', bishop: bishop.name, organization: bishop.organization, group: bishop.group, denomination: bishop.denomination } }, undefined, references);
    }
    next = applyAction(next, { id: 'system', office: true }, 'reviewPhoto', { referenceId: rule.id, status: rule.status, codes: rule.codes }, undefined, references);
    next.audit.push({ id: crypto.randomUUID(), actor: 'system', at: new Date().toISOString(), action: 'officePhotoReviewRuling', target: rule.id, detail: { source: rule.source } });
  }
  return next === state ? null : next;
}
