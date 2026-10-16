import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyState, syncRoll, directoryPeople } from '../../src/registration/model.mjs';
import { mergeCurrentReferences } from '../../src/registration/reference-merges.mjs';

test('the Rebecca merge is supported by two current sheet rows with the same birthday', () => {
  const submissions = JSON.parse(readFileSync('data/bishop-submissions.json'));
  const sheet = submissions.find(s => s.bishop === 'Stephen Poku');
  const a = sheet.pastors.find(p => p.name === 'Rebecca Siwoyle');
  const b = sheet.pastors.find(p => p.name === 'Rebecca Siyolwe');
  assert.ok(a.dobKeys.length && a.dobKeys.some(key => b.dobKeys.includes(key)));
  assert.equal(a.city, b.city);
  assert.equal(a.yearAppointed, b.yearAppointed);
});

test('merging a current duplicate preserves accounts, drafts, uploads and office edits before source cleanup', () => {
  const refs = [{ id: 'PF538', role: 'pastor', name: 'Rebecca Siyolwe', image: 'current.webp', city: 'Huddersfield' }];
  const source = { ...emptyState(), profiles: [{ id: 'account', role: 'pastor', referenceId: 'P3682', name: 'Rebecca Siwoyle' }], registrations: [{ userId: 'account', year: 2027, status: 'draft', data: { role: 'pastor', referenceId: 'P3682', name: 'Rebecca Siwoyle', photo: 'newer-upload.webp', dob: '1990-04-03' } }], rosters: [{ id: 'row', referenceId: 'P3682', name: 'Rebecca Siwoyle' }], overrides: { P3682: { phone: '+233000000000', _officeFields: ['phone'] }, PF538: { city: 'Office City', _officeFields: ['city'] } } };
  const next = syncRoll(source, refs, 'merged-rebecca');
  assert.equal(next.profiles.length, 1);
  assert.equal(next.profiles[0].referenceId, 'PF538');
  assert.equal(next.registrations.length, 1);
  assert.equal(next.registrations[0].data.photo, 'newer-upload.webp');
  assert.equal(next.registrations[0].data.dob, '1990-04-03');
  assert.equal(next.rosters[0].referenceId, 'PF538');
  assert.equal(next.overrides.PF538.phone, '+233000000000');
  assert.equal(next.overrides.PF538.city, 'Office City');
  assert.equal(directoryPeople(next, refs).filter(p => p.name === 'Rebecca Siyolwe').length, 1);
  assert.equal(mergeCurrentReferences(next, refs), next, 'the merge is idempotent');
  assert.equal(source.profiles[0].referenceId, 'P3682', 'input remains untouched');
  assert.equal(mergeCurrentReferences(source, [...refs, { id: 'P3682' }]), source, 'never merge while both IDs remain in the current roster');
});
