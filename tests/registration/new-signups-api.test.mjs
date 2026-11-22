import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState } from '../../src/registration/model.mjs';
import { listedAndNewPeople, managementPeople, standingOf } from '../../src/server/managed-people.mjs';

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

// Office, 20 Nov: dashboards follow the website. Before the deadline is applied they
// get everyone, with the seal on those in good standing; once it is applied, only
// those in good standing and no seal; after "Put everyone back", everyone and the seal.
test('the dashboards follow the registration deadline, like the website', () => {
  const references = [
    { id: 'B1', role: 'bishop', name: 'Ann Bishop', organization: 'FLOW', denomination: 'FLOW' },
    { id: 'P1', role: 'pastor', name: 'Paul Notrenewed', organization: 'FLOW', denomination: 'FLOW', bishop: 'Ann Bishop' },
  ];
  const state = emptyState();
  state.profiles = [{ id: 'u3', role: 'bishop', email: 'ann@example.com', referenceId: 'B1', bishopApproved: true },
    { id: 'u1', role: 'pastor', email: 'w@example.com' }];
  state.registrations = [
    { userId: 'u3', year: state.year, status: 'confirmed', payment: 'verified', submittedAt: '2026-11-10T10:00:00Z',
      data: { role: 'bishop', referenceId: 'B1', name: 'Ann Bishop', firstName: 'Ann', lastName: 'Bishop', title: 'Bishop', organization: 'FLOW', denomination: 'FLOW', city: 'Accra', country: 'Ghana', email: 'ann@example.com' } },
    { userId: 'u1', year: state.year, status: 'confirmed', payment: 'verified', submittedAt: '2026-11-18T10:00:00Z',
      data: { role: 'pastor', name: 'Walter Woelle', firstName: 'Walter', lastName: 'Woelle', organization: 'FLOW', denomination: 'FLOW', city: 'Accra', country: 'Ghana', bishopId: 'B1', email: 'w@example.com' } },
  ];
  const names = () => listedAndNewPeople(state, references).map((p) => p.name).sort();
  assert.deepEqual(names(), ['Ann Bishop', 'Paul Notrenewed', 'Walter Woelle'], 'before the deadline: everyone');
  const s = standingOf(state, references), byName = (n) => listedAndNewPeople(state, references).find((p) => p.name === n);
  assert.equal(s.seal(byName('Ann Bishop')), true);
  assert.equal(s.seal(byName('Walter Woelle')), true);
  assert.equal(s.seal(byName('Paul Notrenewed')), false, 'not renewed: no seal');
  const before = structuredClone(state);
  state.deadline = { applied: true, at: '2027-01-31T00:00:00Z', by: 'office', date: '2027-01-31' };
  assert.deepEqual(names(), ['Ann Bishop', 'Walter Woelle'], 'deadline applied: only those in good standing');
  assert.equal(standingOf(state, references).seal(byName('Ann Bishop')), false, 'no seal once the deadline is applied');
  const back = { ...before, deadline: { applied: false, at: '', by: '', date: '' } };
  assert.deepEqual(listedAndNewPeople(back, references).map((p) => p.name).sort(), ['Ann Bishop', 'Paul Notrenewed', 'Walter Woelle'], 'put everyone back: everyone returns');
});

// Office, 22 Nov: the dashboards can see who is confirmed and who is still waiting.
test('each person says whether they are confirmed, waiting for their bishop or not registered', async () => {
  const { registrationStatus } = await import('../../src/server/managed-people.mjs');
  assert.deepEqual(registrationStatus({}), { status: 'not_registered', confirmed: false, paymentConfirmed: false });
  assert.deepEqual(registrationStatus({ registration: { status: 'unclaimed', payment: 'waived' } }), { status: 'waiting_for_bishop', confirmed: false, paymentConfirmed: true });
  assert.deepEqual(registrationStatus({ registration: { status: 'pending', payment: 'verified' } }), { status: 'waiting_for_office', confirmed: false, paymentConfirmed: true });
  assert.deepEqual(registrationStatus({ registration: { status: 'confirmed', payment: 'unpaid' } }), { status: 'confirmed', confirmed: true, paymentConfirmed: false });
  // A listed pastor who signed up and is waiting for their bishop is listed, marked as waiting.
  const references = [{ id: 'B1', role: 'bishop', name: 'Ann Bishop', organization: 'FLOW', denomination: 'FLOW' }, { id: 'P9', role: 'pastor', name: 'Prince Test', organization: 'FLOW', denomination: 'FLOW', bishop: 'Ann Bishop' }];
  const state = emptyState();
  state.profiles = [{ id: 'u9', role: 'pastor', email: 'p@example.com', referenceId: 'P9' }];
  state.registrations = [{ userId: 'u9', year: state.year, status: 'unclaimed', payment: 'waived', submittedAt: '2026-11-21T23:17:00Z', data: { role: 'pastor', referenceId: 'P9', name: 'Prince Test', firstName: 'Prince', lastName: 'Test', organization: 'FLOW', denomination: 'FLOW', bishopId: 'B1', email: 'p@example.com' } }];
  const prince = listedAndNewPeople(state, references).find(p => p.id === 'P9');
  assert.equal(registrationStatus(prince).status, 'waiting_for_bishop');
});

// Office, 22 Nov: starting the new year turns this year's new sign-ups who were in
// good standing into existing records, so they stay on the pages and dashboards.
test('starting the next year keeps this year\'s new sign-ups as existing records', async () => {
  const { applyAction, publicRoll, directoryPeople } = await import('../../src/registration/model.mjs');
  const office = { id: 'o1', email: 'office@example.com', office: true };
  const references = [{ id: 'B1', role: 'bishop', name: 'Ann Bishop', organization: 'FLOW', denomination: 'FLOW' }];
  let state = emptyState();
  state.profiles = [{ id: 'u3', role: 'bishop', name: 'Ann Bishop', email: 'ann@example.com', referenceId: 'B1', bishopApproved: true }, { id: 'u1', role: 'pastor', email: 'w@example.com' }, { id: 'u2', role: 'pastor', email: 'x@example.com' }];
  const pastor = (userId, name, status, payment) => ({ userId, year: state.year, status, payment, submittedAt: '2026-11-18T10:00:00Z',
    data: { role: 'pastor', name, firstName: name.split(' ')[0], lastName: name.split(' ')[1], organization: 'FLOW', denomination: 'FLOW', city: 'Accra', country: 'Ghana', bishopId: 'B1', email: `${userId}@example.com`, phone: '+233200000000', dob: '1990-01-01', church: 'Osu' } });
  state.registrations = [{ userId: 'u3', year: state.year, status: 'confirmed', payment: 'verified', submittedAt: '2026-11-10T10:00:00Z', data: { role: 'bishop', referenceId: 'B1', name: 'Ann Bishop', firstName: 'Ann', lastName: 'Bishop', title: 'Bishop', organization: 'FLOW', denomination: 'FLOW', email: 'ann@example.com' } },
    pastor('u1', 'Walter Woelle', 'confirmed', 'verified'), pastor('u2', 'Never Paid', 'confirmed', 'unpaid')];
  const year = state.year;
  state = applyAction(state, office, 'openYear', { year: year + 1 }, undefined, references);
  assert.equal(state.year, year + 1);
  const walter = state.extraReferences.find(p => p.name === 'Walter Woelle');
  assert.ok(walter, 'the new sign-up in good standing is now an existing record');
  assert.equal(walter.bishop, 'Ann Bishop'); assert.equal(walter.branch, 'Osu'); assert.equal(walter.email, 'u1@example.com');
  assert.equal(state.profiles.find(p => p.id === 'u1').referenceId, walter.id, 'their account is linked to the record for next year');
  assert.ok(!state.extraReferences.some(p => p.name === 'Never Paid'), 'someone not in good standing is not kept');
  const listed = listedAndNewPeople(state, references).map(p => p.name);
  assert.ok(listed.includes('Walter Woelle'), 'still on the dashboard in the new year');
  assert.equal(standingOf(state, references).has({ id: walter.id }), false, 'no seal until they register for the new year');
  assert.equal(publicRoll(state, references).length, 0);
});
