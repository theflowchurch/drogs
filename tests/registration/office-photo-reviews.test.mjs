import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, applyAction, directoryPeople } from '../../src/registration/model.mjs';
import { photoProgress } from '../../src/registration/photo-progress.mjs';
import { applyOfficePhotoReviews } from '../../src/registration/office-photo-reviews.mjs';

test('an office review ruling flags the saved portrait once and a later upload clears it', () => {
  const refs = [{ id: 'P1', role: 'pastor', name: 'Pastor', image: 'reference.webp' }];
  const rules = [{ id: 'P1', status: 'replace', codes: ['OFFICE'], source: 'Explicit office instruction' }];
  const state = { ...emptyState(), overrides: { P1: { photo: 'current-upload.webp' } }, photoReviews: { P1: { photo: 'upload:current-upload.webp', status: 'ok' } } };
  const next = applyOfficePhotoReviews(state, refs, rules);
  assert.equal(next.photoReviews.P1.photo, 'upload:current-upload.webp');
  assert.equal(photoProgress(next, refs).replace, 1);
  assert.equal(next.overrides.P1.photo, state.overrides.P1.photo);
  assert.equal(applyOfficePhotoReviews(next, refs, rules), null);
  const updated = applyAction(next, { id: 'office', office: true }, 'editReference', { referenceId: 'P1', fields: { photo: 'newer-upload.webp' } }, undefined, refs);
  assert.equal(photoProgress(updated, refs).replace, 0);
  assert.equal(applyOfficePhotoReviews(updated, refs, rules), null, 'redeploy cannot restore an old review');
  assert.equal(state.photoReviews.P1.status, 'ok', 'original state untouched');
});

test('the explicit bishop assignment also corrects a conflicting saved organization before reviewing', () => {
  const refs = [{ id: 'B1', role: 'bishop', name: 'ES Joy', organization: 'First Love', group: 'First Love', denomination: 'First Love Church' }, { id: 'P1', role: 'pastor', name: 'Isaac', bishop: 'ES Joy', organization: 'First Love', image: 'current.webp' }];
  const state = { ...emptyState(), profiles: [{ id: 'member', referenceId: 'P1' }], registrations: [{ userId: 'member', year: 2027, status: 'unclaimed', data: { referenceId: 'P1', role: 'pastor', name: 'Isaac', bishop: 'Other Bishop', organization: 'FLOW', photo: 'saved.webp' } }] };
  const rule = { id: 'P1', bishopId: 'B1', status: 'replace', codes: ['OFFICE'], source: 'Explicit assignment and photo instruction' };
  const next = applyOfficePhotoReviews(state, refs, [rule]);
  const pastor = directoryPeople(next, refs).find(p => p.id === 'P1');
  assert.equal(pastor.bishop, 'ES Joy');
  assert.equal(pastor.organization, 'First Love');
  assert.equal(pastor.photo, 'saved.webp');
  assert.equal(photoProgress(next, refs).replace, 1);
  assert.equal(applyOfficePhotoReviews(next, refs, [rule]), null);
});
