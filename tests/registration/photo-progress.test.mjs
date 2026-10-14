import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, applyAction, directoryPeople, publicRoll, publicOverlay, visibleState } from '../../src/registration/model.mjs';
import { photoProgress, photoTask, PHOTO_REASONS } from '../../src/registration/photo-progress.mjs';
import { PHOTO_REVIEW } from '../../src/registration/photo-review-baseline.mjs';
const office = { id: 'office', email: 'office@example.com', office: true };
const refs = [
  { id: 'B1', role: 'bishop', name: 'Old Bishop', image: 'bishop.jpg' },
  { id: 'P1', role: 'pastor', name: 'Missing Person', bishop: 'Old Bishop', organization: 'First Love', image: '' },
  { id: 'P2', role: 'pastor', name: 'Flagged Person', bishop: 'Old Bishop', organization: 'First Love', image: 'old.jpg' },
  { id: 'P3', role: 'pastor', name: 'Flow Person', organization: 'FLOW', image: 'flow.jpg' },
];
const reviews = { P2: { photo: 'image:old.jpg', codes: ['FAR'] }, P3: { photo: 'image:flow.jpg', codes: ['BG'] } };
const count = s => photoProgress(s, refs, s.year, reviews, ['P1']);
const edit = (s, id, fields) => applyAction(s, office, 'editReference', { referenceId: id, fields }, undefined, refs);

test('adding a missing photo and replacing a flagged photo decrease independent counters', () => {
  let s = emptyState();
  assert.equal(count(s).missing, 1); assert.equal(count(s).replace, 1);
  s = edit(s, 'P1', { photo: 'office/portrait/new-one.webp' });
  assert.equal(count(s).missing, 0); assert.equal(count(s).replace, 1); assert.equal(count(s).added, 1);
  s = edit(s, 'P2', { name: 'Corrected Person', city: 'Tema' });
  assert.equal(count(s).replace, 1, 'editing other fields does not resolve the photo task');
  s = edit(s, 'P2', { photo: 'office/portrait/new-two.webp' });
  assert.equal(count(s).replace, 0); assert.equal(count(s).replaced, 1);
  assert.equal(photoTask(directoryPeople(s, refs).find(p => p.id === 'P2'), s, reviews).status, 'ready');
  s = edit(s, 'P2', { photo: '' });
  assert.equal(count(s).replace, 1, 'restoring the reviewed image restores its flag');
  assert.equal(count(s).replaced, 0);
});
test('photo flags belong to stable record IDs and the exact media version', () => {
  let s = edit(emptyState(), 'P2', { photo: 'office/portrait/second.webp' });
  s = applyAction(s, office, 'reviewPhoto', { referenceId: 'P2', status: 'replace', codes: ['STRETCH'] }, undefined, refs);
  assert.equal(count(s).replace, 1);
  assert.deepEqual(photoTask(directoryPeople(s, refs).find(p => p.id === 'P2'), s, reviews).codes, ['STRETCH']);
  const restored = JSON.parse(JSON.stringify(s));
  assert.equal(count(restored).replace, 1, 'a saved review survives serialization/reload');
  s = edit(restored, 'P2', { photo: 'office/portrait/third.webp', name: 'Another Corrected Name' });
  assert.equal(count(s).replace, 0);
  assert.throws(() => applyAction(s, { id: 'member' }, 'reviewPhoto', { referenceId: 'P2', status: 'ok' }, undefined, refs), /Office/);
  assert.throws(() => applyAction(s, office, 'reviewPhoto', { referenceId: 'P2', status: 'replace', codes: [] }, undefined, refs), /reason/);
  assert.deepEqual(visibleState(restored, { id: 'member' }, refs).photoReviews, {});
});
test('hidden records remain photo tasks; deleted records are accounted for separately from photos added', () => {
  let s = applyAction(emptyState(), office, 'hideReference', { referenceId: 'P1', hidden: true });
  assert.equal(count(s).missing, 1);
  s = applyAction(s, office, 'deleteReference', { referenceId: 'P1' });
  assert.equal(count(s).missing, 0); assert.equal(count(s).added, 0); assert.equal(count(s).removedFromOriginal, 1);
  s = applyAction(s, office, 'deleteReference', { referenceId: 'P1', deleted: false });
  assert.equal(count(s).missing, 1);
});
test('linked registrations are counted once and the selected displayed photo determines replacement status', () => {
  const s = { ...emptyState(), profiles: [{ id: 'u2', referenceId: 'P2' }], registrations: [{ userId: 'u2', year: 2027, status: 'confirmed', manual: true, data: { role: 'pastor', name: 'Flagged Person', referenceId: 'P2', photo: 'u2/portrait/new.webp' } }] };
  assert.equal(count(s).total, 3); assert.equal(count(s).replace, 0); assert.equal(count(s).replaced, 1);
  s.registrations[0].displayPhoto = 'reference';
  assert.equal(count(s).replace, 1);
  const replaced = edit(s, 'P2', { photo: 'office/portrait/replacement.webp' });
  assert.equal(count(replaced).replace, 0, 'office replacement switches back to the new upload');
  assert.equal(publicRoll(replaced, refs)[0].photo, 'office/portrait/replacement.webp');
});
test('new hand-added missing records join the count', () => {
  const s = { ...emptyState(), extraReferences: [{ id: 'X1', role: 'pastor', name: 'New Person', image: '', photo: '' }] };
  assert.equal(count(s).missing, 2);
});
test('a saved draft portrait fills a known missing record without confirming the person or publishing the draft', () => {
  const s = { ...emptyState(), profiles: [{ id: 'u1', referenceId: 'P1' }], registrations: [{ userId: 'u1', year: 2027, status: 'draft', data: { role: 'pastor', name: 'Missing Person', referenceId: 'P1', photo: 'u1/portrait/saved.webp' } }] };
  assert.equal(count(s).missing, 0); assert.equal(count(s).added, 1);
  assert.equal(directoryPeople(s, refs).find(p => p.id === 'P1').updated, false);
  assert.equal(publicRoll(s, refs).length, 0);
});
test('office name and location corrections survive later member photo updates in every view', () => {
  const member = { id: 'u2', email: 'member@example.com' };
  let s = { ...emptyState(), profiles: [{ id: 'u2', role: 'pastor', name: 'Flagged Person', referenceId: 'P2' }], registrations: [{ userId: 'u2', year: 2027, status: 'confirmed', manual: true, data: { role: 'pastor', name: 'Flagged Person', firstName: 'Flagged', lastName: 'Person', referenceId: 'P2', city: 'Accra', country: 'Ghana', organization: 'First Love', denomination: 'First Love Church', photo: 'u2/portrait/old.webp', dob: '1990-01-01', gender: 'male', email: member.email, phone: '+233201234567', photoConfirmed: true, bishopId: 'B1' } }] };
  s = edit(s, 'P2', { name: 'Corrected Official Name', city: 'Tema', email: 'corrected@example.com' });
  s = applyAction(s, member, 'update', { city: 'Accra', email: member.email, photo: 'u2/portrait/replaced.webp', photoConfirmed: true }, undefined, refs);
  const row = directoryPeople(s, refs).find(p => p.id === 'P2');
  assert.equal(row.name, 'Corrected Official Name'); assert.equal(row.city, 'Tema'); assert.equal(row.email, 'corrected@example.com');
  assert.equal(row.photo, 'u2/portrait/replaced.webp');
  const roll = publicRoll(s, refs)[0];
  assert.equal(roll.name, row.name); assert.equal(roll.city, row.city); assert.equal(roll.photo, row.photo);
  assert.equal(publicOverlay(s).overrides.P2._officeFields, undefined);
  s = applyAction(s, office, 'officeEdit', { userId: 'u2', data: { photo: 'office/portrait/latest.webp' } }, undefined, refs);
  assert.equal(directoryPeople(s, refs).find(p => p.id === 'P2').name, row.name);
  assert.equal(directoryPeople(s, refs).find(p => p.id === 'P2').city, row.city);
});
test('older office corrections are protected even without stored field ownership', () => {
  let s = { ...emptyState(), overrides: { P2: { city: 'Tema', name: 'Corrected Person' } }, audit: [{ action: 'editReference', target: 'P2', detail: { city: 'Tema', name: 'Corrected Person' } }], profiles: [{ id: 'u2', referenceId: 'P2', role: 'pastor' }], registrations: [{ userId: 'u2', year: 2027, status: 'confirmed', data: { role: 'pastor', name: 'Corrected Person', firstName: 'Corrected', lastName: 'Person', referenceId: 'P2', city: 'Accra', country: 'Ghana', organization: 'First Love', denomination: 'First Love Church', photo: 'u2/portrait/old.webp', dob: '1990-01-01', gender: 'male', phone: '+233201234567', photoConfirmed: true, bishopId: 'B1' } }] };
  s = applyAction(s, { id: 'u2', email: 'member@example.com' }, 'update', { city: 'Accra', photoConfirmed: true }, undefined, refs);
  assert.equal(s.overrides.P2.city, 'Tema');
});
test('renaming a bishop preserves the pastors under their oversight', () => {
  const s = edit(emptyState(), 'B1', { name: 'Corrected Bishop' });
  assert.equal(directoryPeople(s, refs).find(p => p.id === 'P1').bishop, 'Corrected Bishop');
  assert.equal(directoryPeople(s, refs).find(p => p.id === 'P2').bishop, 'Corrected Bishop');
});
test('review reason codes stay valid and accepted attire is not a reason', () => {
  for (const r of Object.values(PHOTO_REVIEW)) for (const code of r.codes) assert.ok(PHOTO_REASONS[code]);
  assert.ok(!Object.values(PHOTO_REASONS).some(s => /grey suit|gray suit|clerical collar/i.test(s)));
});
