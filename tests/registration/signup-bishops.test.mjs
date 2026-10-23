import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signupBishopChoices } from '../../src/registration/signup-bishops.mjs';
import { emptyState, applyAction } from '../../src/registration/model.mjs';
import people from '../../src/registration/reference-people.json' with { type: 'json' };

test('FLOW offers only Mother Nina Masuku before her own annual registration', () => {
  const choices = signupBishopChoices([{ id: 'other', name: 'Another Bishop', organization: 'FLOW', approved: true }], people, 'FLOW');
  assert.equal(choices.length, 1);
  assert.equal(choices[0].id, 'B334');
  assert.equal(choices[0].label, 'Mother Nely Nina Masuku');
  const actor = { id: 'flow-pastor', email: 'flow-pastor@example.com' };
  const data = { role: 'pastor', firstName: 'Joshua', lastName: 'Example', name: 'Joshua Example', email: actor.email,
    organization: 'FLOW', country: 'Ghana', city: 'Online', phone: '+233201234567', dob: '1990-01-01', gender: 'male',
    photo: 'flow-pastor/portrait/image.jpg', photoConfirmed: true, consentedAt: '2026-10-23T18:00:00.000Z',
    bishopId: choices[0].id, bishopFirstName: 'Nely Nina', bishopLastName: 'Masuku' };
  let state = applyAction(emptyState(), actor, 'save', data);
  state = applyAction(state, actor, 'submit', state.registrations[0].data);
  assert.equal(state.registrations[0].data.bishopId, 'B334');
  assert.equal(state.registrations[0].amount, 25);
  assert.equal(state.registrations[0].status, 'unclaimed');
  assert.equal(state.profiles.length, 1, 'no bishop account is fabricated');
});

test('other organisations still offer their own approved registered bishops', () => {
  const bishops = [{ id: 'ud', name: 'UD Bishop', organization: 'United Denominations', approved: true },
    { id: 'firstlove', name: 'First Love Bishop', organization: 'First Love', approved: true },
    { id: 'pending', name: 'Pending Bishop', organization: 'First Love', approved: false }];
  assert.deepEqual(signupBishopChoices(bishops, people, 'First Love').map(b => b.id), ['firstlove']);
  assert.deepEqual(signupBishopChoices(bishops, people, 'United Denominations').map(b => b.id), ['ud']);
});
