import test from 'node:test';
import assert from 'node:assert/strict';
import { syncRoll, emptyState } from '../../src/registration/model.mjs';
import { GROUPS } from '../../src/registration/groups.mjs';

// A new roster version must not discard names, locations or other saved office corrections.
const people = [
  { id: 'B1', role: 'bishop', name: 'A', organization: 'United Denominations', group: 'UD Ghana', denomination: 'Brand New Church' },
  { id: 'P1', role: 'pastor', name: 'B', organization: 'First Love', group: 'First Love', denomination: 'Qodesh City Church', bishop: 'A' },
];
test('syncRoll adds denominations, preserves all office corrections and runs once per version', () => {
  const state = { ...emptyState(), catalog: { organizations: ['United Denominations', 'First Love'], denominations: { 'United Denominations': ['Old One'], 'First Love': [] }, groups: { 'UD Ghana': { organization: 'United Denominations', denominations: ['Old One'] } }, logos: {} }, overrides: { B1: { denomination: 'Old One', photo: 'x.webp' }, P1: { city: 'Nowhere' }, GONE: { photo: 'y.webp' } }, hidden: ['GONE', 'P1'] };
  const next = syncRoll(state, people, 'v1');
  assert.ok(next.catalog.denominations['United Denominations'].includes('Brand New Church'));
  assert.ok(next.catalog.denominations['United Denominations'].includes('Old One'), 'the office\'s own additions stay');
  assert.ok(next.catalog.groups['UD Ghana'].denominations.includes('Brand New Church'));
  assert.ok(next.catalog.denominations['First Love'].includes('Qodesh City Church'));
  assert.deepEqual(next.overrides, { B1: { denomination: 'Old One', photo: 'x.webp' }, P1: { city: 'Nowhere' } });
  assert.deepEqual(next.hidden, ['P1']);
  assert.equal(next.rollSync, 'v1');
  assert.equal(next.audit.at(-1).action, 'rollSync');
  assert.equal(syncRoll(next, people, 'v1'), null, 'already synced');
  assert.ok(Object.keys(GROUPS).length > 0);
});
test('hand-added records, deleted records and photo reviews survive a roster refresh', () => {
  const state = { ...emptyState(), extraReferences: [{ id: 'X1', name: 'Added Pastor', role: 'pastor' }], overrides: { X1: { name: 'Corrected Added Pastor', _officeFields: ['name'] }, P1: { name: 'Corrected Pastor', deleted: true } }, photoReviews: { P1: { photo: 'upload:new.webp', status: 'replace', codes: ['FAR'] } } };
  const refreshed = syncRoll(state, people, 'v2');
  assert.deepEqual(refreshed.overrides, state.overrides);
  assert.deepEqual(refreshed.photoReviews, state.photoReviews);
});
