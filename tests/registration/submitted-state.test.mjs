import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, reconcileSubmittedState, syncRoll, publicRoll, withStanding, directoryPeople, applyAction, visibleState, pastorsByBishop, overlayReferences } from '../../src/registration/model.mjs';

const people = [
  { id: 'B80', role: 'bishop', name: 'Henry Asare-Duah', country: 'Guyana', city: 'West Bank Demerara', organization: 'United Denominations', denomination: 'Eschatos' },
  { id: 'Se7bbb995', role: 'pastor', name: 'Dickson Poku', bishop: 'Henry Asare-Duah', country: 'Guyana', city: 'West Bank Demerara', branch: 'West Bank Cathedral', organization: 'United Denominations', denomination: 'Eschatos', image: 'current.webp' },
];
test('saved legacy links reconnect only to an exact unique current sheet record', () => {
  const source = { ...emptyState(), profiles: [{ id: 'henry', role: 'bishop', referenceId: 'B80', name: 'Henry Asare-Duah', bishopApproved: true }, { id: 'dickson', role: 'pastor', referenceId: 'P981', name: 'Dickson Poku' }], registrations: [{ userId: 'dickson', year: 2027, status: 'confirmed', payment: 'verified', data: { referenceId: 'P981', name: 'Dickson Poku', role: 'pastor', country: 'Guyana', city: 'Georgetown', photo: 'uploaded.webp' } }], overrides: { B80: { city: 'Old copied city' }, P981: { name: 'Old imported name' } } };
  const { state, summary } = reconcileSubmittedState(source, people);
  assert.deepEqual(summary.relinked, [{ from: 'P981', to: 'Se7bbb995' }]);
  assert.equal(state.profiles[1].referenceId, 'Se7bbb995');
  const r = state.registrations[0];
  assert.equal(r.data.referenceId, 'Se7bbb995');
  assert.equal(r.data.city, 'West Bank Demerara');
  assert.equal(r.data.church, 'West Bank Cathedral');
  assert.equal(r.data.bishopId, 'B80');
  assert.equal(r.data.photo, 'uploaded.webp');
  assert.equal(r.payment, 'verified');
  assert.equal(publicRoll(state, people)[0].referenceId, 'Se7bbb995');
  assert.equal(directoryPeople(state, people).filter(p => p.name === 'Dickson Poku').length, 1);
  assert.equal(source.registrations[0].data.referenceId, 'P981', 'transaction input is untouched');
});
test('unlisted legacy registrations, profiles, list rows and overrides are removed', () => {
  const source = { ...emptyState(), profiles: [{ id: 'old', role: 'pastor', referenceId: 'P3860', name: 'Russell Amoah Konadu' }], registrations: [{ userId: 'old', year: 2027, status: 'confirmed', manual: true, data: { referenceId: 'P3860', name: 'Russell Amoah Konadu', role: 'pastor' } }], rosters: [{ id: 'row', bishopId: 'old', referenceId: 'P3468', name: 'Old Person' }], overrides: { P3860: { name: 'Russell Amoah Konadu' } }, photoReviews: { P3860: { status: 'replace' } } };
  assert.deepEqual(publicRoll(source, people), [], 'orphaned reference is never presented as a new person before migration');
  assert.equal(withStanding(people, [{ id: 'old', role: 'pastor', referenceId: 'P3860', name: 'Russell Amoah Konadu' }]).length, 2);
  const { state, summary } = reconcileSubmittedState(source, people);
  assert.equal(state.profiles.length, 0); assert.equal(state.registrations.length, 0); assert.equal(state.rosters.length, 0);
  assert.deepEqual(state.overrides, {}); assert.deepEqual(state.photoReviews, {});
  assert.equal(summary.removedProfiles, 1); assert.equal(summary.removedRegistrations, 1);
});
test('actual office and member edits survive while unowned copied fields disappear', () => {
  const source = { ...emptyState(), profiles: [{ id: 'henry', referenceId: 'B80', role: 'bishop' }], overrides: { B80: { name: 'Office Corrected Name', city: 'Office City', country: 'Old Copied Country', photo: 'office.webp' }, Se7bbb995: { city: 'Member Corrected City', denomination: 'Old copied denomination' } }, audit: [{ action: 'editReference', target: 'B80', detail: { name: 'Office Corrected Name', city: 'Office City' } }, { action: 'update', target: 'dickson', detail: { city: 'Member Corrected City' } }], registrations: [{ userId: 'dickson', year: 2027, data: { referenceId: 'Se7bbb995', role: 'pastor' } }] };
  const { state } = reconcileSubmittedState(source, people);
  assert.deepEqual(state.overrides.B80, { name: 'Office Corrected Name', city: 'Office City', photo: 'office.webp' });
  assert.deepEqual(state.overrides.Se7bbb995, { city: 'Member Corrected City' });
});
test('ambiguous namesakes never inherit another person’s registration or photograph', () => {
  const source = { ...emptyState(), profiles: [{ id: 'account', name: 'Same Name', role: 'pastor', referenceId: 'retired' }], registrations: [{ userId: 'account', data: { name: 'Same Name', role: 'pastor', referenceId: 'retired' } }] };
  const { state, summary } = reconcileSubmittedState(source, [{ id: 'a', name: 'Same Name', role: 'pastor' }, { id: 'b', name: 'Same Name', role: 'pastor' }]);
  assert.deepEqual(summary.relinked, []); assert.equal(state.registrations.length, 0);
});
test('a listed bishop’s saved pastor list cannot add retired people or other bishops', () => {
  const source = { ...emptyState(), profiles: [{ id: 'henry', role: 'bishop', referenceId: 'B80' }], rosters: [{ id: 'correct', bishopId: 'henry', name: 'Dickson Poku' }, { id: 'retired', bishopId: 'henry', name: 'Russell Amoah Konadu' }, { id: 'bishop', bishopId: 'henry', referenceId: 'B80', name: 'Henry Asare-Duah' }] };
  const { state } = reconcileSubmittedState(source, people);
  assert.deepEqual(state.rosters.map(r => [r.id, r.referenceId]), [['correct', 'Se7bbb995']]);
});
test('office can confirm a current spreadsheet-generated ID instead of only old B/P numbers', () => {
  const source = { ...emptyState(), rosters: [{ id: 'row', year: 2027, status: 'active', name: 'Dickson Poku', bishopId: 'henry' }] };
  const state = applyAction(source, { id: 'office', office: true }, 'linkReference', { rosterId: 'row', referenceId: 'Se7bbb995' }, undefined, people);
  assert.equal(state.rosters[0].referenceId, 'Se7bbb995');
});
test('the submitted-source cleanup also runs when the bundled roster version is unchanged', () => {
  const source = { ...emptyState(), rollSync: 'same-roster', overrides: { B80: { city: 'Old automatic value' } } };
  const next = syncRoll(source, people, 'same-roster');
  assert.ok(next); assert.deepEqual(next.overrides, {});
  assert.equal(syncRoll(next, people, 'same-roster'), null);
});
test('matching a retired ID also checks the birthday keys on the current submitted row', () => {
  const source = { ...emptyState(), profiles: [{ id: 'account', role: 'pastor', referenceId: 'P981', name: 'Dickson Poku' }], registrations: [{ userId: 'account', data: { role: 'pastor', referenceId: 'P981', name: 'Dickson Poku', country: 'Guyana', dob: '1980-01-02' } }] };
  const refs = people.map(p => ({ ...p, ...(p.role === 'pastor' ? { dobKeys: ['3-4-81'] } : {}) }));
  const { state, summary } = reconcileSubmittedState(source, refs);
  assert.deepEqual(summary.relinked, []);
  assert.equal(state.registrations.length, 0, 'same name with a different birthday cannot be relinked');
  const publicView = visibleState(emptyState(), { id: 'public' }, refs, refs);
  assert.ok(publicView.directory.every(p => !('dobKeys' in p)), 'submitted birthdays stay private');
});
test('an office name correction preserves all pastor relationships after copied overrides are removed', () => {
  const source = { ...emptyState(), overrides: { B80: { name: 'Corrected Bishop Name', _officeFields: ['name'] }, Se7bbb995: { bishop: 'Copied old bishop' } } };
  const { state } = reconcileSubmittedState(source, people);
  const roster = overlayReferences(people, state);
  assert.equal(roster.find(p => p.id === 'Se7bbb995').bishop, 'Corrected Bishop Name');
  assert.equal(pastorsByBishop(roster).get('B80').length, 1);
});
