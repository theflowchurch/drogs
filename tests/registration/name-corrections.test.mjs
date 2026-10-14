import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canonicalBishopName, canonicalOfficeNames } from '../../src/registration/name-corrections.mjs';
import { emptyState, normalName, overlayReferences, directoryPeople, publicRoll, syncRoll } from '../../src/registration/model.mjs';
const refs = [
  { id: 'B39', role: 'bishop', name: 'E.A.T Sackey', image: 'bishop.jpg' },
  { id: 'P1', role: 'pastor', name: 'Pastor One', bishop: 'E.A.T Sackey', image: 'pastor.jpg' },
];
test('older sheet spellings match E.A.T Sackey without changing other people', () => {
  for (const name of ['Eat Sackey', 'E A T Sackey', 'E.A.T Sackey', 'E.A.T. Sackey']) {
    assert.equal(canonicalBishopName(name), 'E.A.T Sackey');
    assert.equal(normalName(name), normalName('E.A.T Sackey'));
  }
  assert.equal(canonicalBishopName('Stephen Sackey'), 'Stephen Sackey');
  assert.equal(canonicalBishopName('Eat Sackey.xlsx'), 'Eat Sackey.xlsx', 'source filenames stay usable');
});
test('old saved spellings cannot reappear in office, registered or public views', () => {
  const s = { ...emptyState(), overrides: { B39: { name: 'Eat Sackey' }, P1: { bishop: 'Eat Sackey' } }, profiles: [{ id: 'account', role: 'bishop', referenceId: 'B39', name: 'Eat Sackey', bishopApproved: true }], registrations: [{ userId: 'account', year: 2027, status: 'confirmed', data: { role: 'bishop', referenceId: 'B39', name: 'Eat Sackey', firstName: 'Eat', lastName: 'Sackey', photo: 'account/portrait/bishop.webp' } }] };
  assert.equal(overlayReferences(refs, s)[0].name, 'E.A.T Sackey');
  assert.equal(directoryPeople(s, refs).find(p => p.id === 'B39').name, 'E.A.T Sackey');
  assert.equal(overlayReferences(refs, s)[1].bishop, 'E.A.T Sackey');
  assert.equal(publicRoll(s, refs)[0].name, 'E.A.T Sackey');
  const updated = syncRoll(s, refs, 'corrected-name');
  assert.equal(updated.profiles[0].name, 'E.A.T Sackey');
  assert.equal(updated.registrations[0].data.firstName, 'E.A.T');
  assert.equal(updated.overrides.B39.name, 'E.A.T Sackey');
  assert.equal(s.profiles[0].name, 'Eat Sackey', 'the previous state is untouched, so database change detection can persist the correction');
});
test('the current roster retains Bishop B39 and all 32 pastors from his current submitted list', () => {
  const people = JSON.parse(readFileSync('src/registration/reference-people.json', 'utf8'));
  const bishop = people.find(p => p.id === 'B39');
  assert.equal(bishop.name, 'E.A.T Sackey');
  assert.equal(people.filter(p => p.role === 'pastor' && p.bishop === bishop.name).length, 32);
  assert.ok(!people.some(p => p.name === 'Eat Sackey' || p.bishop === 'Eat Sackey'));
});
test('saved pastors choosing this bishop retain the corrected supervising name', () => {
  const s = { ...emptyState(), registrations: [{ userId: 'pastor', year: 2027, data: { role: 'pastor', name: 'Pastor One', bishopName: 'Eat Sackey', bishopFirstName: 'Eat', bishopLastName: 'Sackey' } }] };
  const corrected = canonicalOfficeNames(s);
  assert.equal(corrected.registrations[0].data.bishopName, 'E.A.T Sackey');
  assert.equal(corrected.registrations[0].data.bishopFirstName, 'E.A.T');
});
