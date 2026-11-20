import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState } from '../../src/registration/model.mjs';
import { listedAndNewPeople, managementPeople } from '../../src/server/managed-people.mjs';

// Office, 20 Nov: someone who signs up new (not on our list) and is confirmed,
// like Walter Woelle, is on the people list dashboards read through the API.
test('confirmed new sign-ups are listed for dashboards, but are not edited through the API', () => {
  const references = [{ id: 'B1', role: 'bishop', name: 'Ann Bishop', organization: 'FLOW', denomination: 'FLOW' }];
  const state = emptyState();
  state.profiles = [{ id: 'u1', role: 'pastor', email: 'w@example.com' }];
  state.registrations = [{ userId: 'u1', year: state.year, status: 'confirmed', submittedAt: '2026-11-18T10:00:00Z',
    data: { role: 'pastor', name: 'Walter Woelle', firstName: 'Walter', lastName: 'Woelle', organization: 'FLOW', denomination: 'FLOW', city: 'Accra', country: 'Ghana', bishopId: 'B1', email: 'w@example.com' } }];
  // Confirmed by his bishop, but the payment not yet confirmed: not listed yet.
  assert.equal(listedAndNewPeople(state, references).some((p) => p.name === 'Walter Woelle'), false);
  state.registrations[0].payment = 'verified';
  const listed = listedAndNewPeople(state, references);
  const walter = listed.find((p) => p.name === 'Walter Woelle');
  assert.ok(walter, 'the new sign-up is listed');
  assert.ok(walter.id.startsWith('new:'));
  assert.equal(walter.organization, 'FLOW');
  assert.equal(managementPeople(state, references).some((p) => p.name === 'Walter Woelle'), false, 'changes stay limited to listed people');
  // A bishop who signs up new is listed in the same way.
  state.profiles.push({ id: 'u2', role: 'bishop', email: 'b@example.com' });
  state.registrations.push({ userId: 'u2', year: state.year, status: 'pending', payment: 'verified', submittedAt: '2026-11-19T10:00:00Z',
    data: { role: 'bishop', name: 'Grace New', firstName: 'Grace', lastName: 'New', title: 'Bishop', organization: 'FLOW', denomination: 'FLOW', city: 'Accra', country: 'Ghana', email: 'b@example.com' } });
  // Paid, but the office has not confirmed her yet: not listed.
  assert.equal(listedAndNewPeople(state, references).some((p) => p.name === 'Grace New'), false);
  state.registrations[1].status = 'confirmed';
  const bishop = listedAndNewPeople(state, references).find((p) => p.name === 'Grace New');
  assert.ok(bishop && bishop.id.startsWith('new:') && bishop.role === 'bishop', 'a new bishop confirmed by the office, with the payment confirmed, is listed');
  // A receipt from another app waiting for the office: not listed yet.
  state.registrations[1].payment = 'pending';
  assert.equal(listedAndNewPeople(state, references).some((p) => p.name === 'Grace New'), false);
});
