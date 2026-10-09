import test from 'node:test';
import assert from 'node:assert/strict';
import { syncRoll, emptyState } from '../../src/registration/model.mjs';
import { GROUPS } from '../../src/registration/groups.mjs';

// When a new roll is built, the office's saved structure gains what the roll uses and stale field corrections go.
const people = [
  { id: 'B1', role: 'bishop', name: 'A', organization: 'United Denominations', group: 'UD Ghana', denomination: 'Brand New Church' },
  { id: 'P1', role: 'pastor', name: 'B', organization: 'First Love', group: 'First Love', denomination: 'Qodesh City Church', bishop: 'A' },
];
test('syncRoll adds the roll\'s denominations, keeps photo corrections, drops field corrections and runs once per version', () => {
  const state = { ...emptyState(), catalog: { organizations: ['United Denominations', 'First Love'], denominations: { 'United Denominations': ['Old One'], 'First Love': [] }, groups: { 'UD Ghana': { organization: 'United Denominations', denominations: ['Old One'] } }, logos: {} }, overrides: { B1: { denomination: 'Old One', photo: 'x.webp' }, P1: { city: 'Nowhere' }, GONE: { photo: 'y.webp' } }, hidden: ['GONE', 'P1'] };
  const next = syncRoll(state, people, 'v1');
  assert.ok(next.catalog.denominations['United Denominations'].includes('Brand New Church'));
  assert.ok(next.catalog.denominations['United Denominations'].includes('Old One'), 'the office\'s own additions stay');
  assert.ok(next.catalog.groups['UD Ghana'].denominations.includes('Brand New Church'));
  assert.ok(next.catalog.denominations['First Love'].includes('Qodesh City Church'));
  assert.deepEqual(next.overrides, { B1: { photo: 'x.webp' } });
  assert.deepEqual(next.hidden, ['P1']);
  assert.equal(next.rollSync, 'v1');
  assert.equal(next.audit.at(-1).action, 'rollSync');
  assert.equal(syncRoll(next, people, 'v1'), null, 'already synced');
  assert.ok(Object.keys(GROUPS).length > 0);
});
