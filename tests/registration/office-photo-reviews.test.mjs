import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, applyAction } from '../../src/registration/model.mjs';
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
