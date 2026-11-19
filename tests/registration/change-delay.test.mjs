import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, applyAction, applyDueChanges, publicRoll, changePending, CHANGE_DELAY_MS } from '../../src/registration/model.mjs';

// Office, 19 Nov: a member's saved change goes public 30 minutes later.
const bishop = { id: 'b1', email: 'bishop@example.com' };
const office = { id: 'o1', email: 'office@example.com', office: true };
const profile = (extra = {}) => ({ role: 'bishop', name: 'Ama Bishop', firstName: 'Ama', lastName: 'Bishop', organization: 'First Love', denomination: 'First Love Church', country: 'Ghana', city: 'Accra', gender: 'male', dob: '1990-02-01', photoConfirmed: true, photo: 'b1/p.jpg', consentedAt: '2026-09-29T08:00:00.000Z', email: bishop.email, phone: '+233201234567', ...extra });
const refs = [{ id: 'B1', role: 'bishop', name: 'Ama Bishop', organization: 'First Love', denomination: 'First Love Church', city: 'Accra', country: 'Ghana' }];

test('a saved change waits 30 minutes before the public pages and the record show it', () => {
  let s = applyAction(emptyState(), bishop, 'submit', { ...profile(), referenceId: 'B1' }, undefined, refs);
  assert.ok(changePending(s.registrations[0]), 'a new registration waits too');
  assert.equal(s.overrides?.B1?.city, undefined, 'the record is not changed yet');
  assert.equal(applyDueChanges(s, Date.now() + CHANGE_DELAY_MS + 1000), 1);
  assert.equal(s.overrides.B1.city, 'Accra');
  s.registrations[0].status = 'confirmed'; s.registrations[0].payment = 'verified';
  assert.equal(publicRoll(s, refs)[0].city, 'Accra');
  s = applyAction(s, bishop, 'update', { city: 'Kumasi', photoConfirmed: true }, undefined, refs);
  assert.equal(s.registrations[0].data.city, 'Kumasi', 'the member sees their change at once');
  assert.equal(publicRoll(s, refs)[0].city, 'Accra', 'the public still sees the old city');
  assert.equal(s.overrides.B1.city, 'Accra', 'the record still has the old city');
  s = applyAction(s, bishop, 'update', { city: 'Tema', photoConfirmed: true }, undefined, refs);
  assert.equal(publicRoll(s, refs)[0].city, 'Accra', 'a second edit inside the 30 minutes still keeps the old one public');
  assert.equal(applyDueChanges(s, Date.now() + 1000), 0, 'not due yet');
  assert.equal(applyDueChanges(s, Date.now() + CHANGE_DELAY_MS + 1000), 1);
  assert.equal(s.overrides.B1.city, 'Tema');
  assert.equal(publicRoll(s, refs)[0].city, 'Tema');
  assert.ok(!changePending(s.registrations[0]));
});
