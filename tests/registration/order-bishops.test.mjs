import test from 'node:test';
import assert from 'node:assert/strict';
import { orderEntries, pastorEntries } from '../../src/registration/public-entries.mjs';
// Office, 22 Nov: the Order of Pastors lists each church's bishops, head first, then its pastors.
test('Order of Pastors: head, then bishops, then pastors; the register keeps pastors only', () => {
  const people = [
    { id: 'p1', role: 'pastor', title: 'Pastor', name: 'Aaron Able', denomination: 'First Love Church', bishop: 'Ben Zed' },
    { id: 'b1', role: 'bishop', title: 'Bishop', name: 'Ben Zed', denomination: 'First Love Church' },
    { id: 'b2', role: 'bishop', title: 'Bishop', name: 'Joshua Heward-Mills', denomination: 'First Love Church' },
    { id: 'b3', role: 'bishop', title: 'Bishop', name: 'Jeffrey Kwame Ocran', denomination: 'Fruitiferos Internationale' },
    { id: 'p2', role: 'pastor', title: 'Pastor', name: 'Ann Bee', denomination: 'Fruitferos Internacional Guinea Bissau' },
  ];
  const order = orderEntries(people);
  assert.deepEqual(order.filter(p => p.denomination === 'First Love Church').map(p => p.rosterId), ['b2', 'b1', 'p1']);
  // a bishop whose own church has no box joins the church the office lists them as leading
  assert.equal(order.find(p => p.rosterId === 'b3').denomination, 'Fruitferos Internacional Guinea Bissau');
  assert.deepEqual(pastorEntries(people).map(p => p.rosterId).sort(), ['p1', 'p2']);
});
test('church pages list the head bishop first', async () => {
  const { ministerSections } = await import('../../src/registration/denomination-sites.mjs');
  const people = [{ role: 'bishop', name: 'Aaron Able' }, { role: 'bishop', name: 'Frank Tawiah-Amissah' }, { role: 'bishop', name: 'Ben Brown' }];
  assert.deepEqual(ministerSections(people).bishops.map(p => p.name), ['Frank Tawiah-Amissah', 'Aaron Able', 'Ben Brown']);
});
test('22 Nov: a confirmed sign-up replaces the record\'s details; our photo stays unless role or church moved', async () => {
  const { applyAction, applyDueChanges, emptyState, overlayReferences, shownPhoto, validateProfile } = await import('../../src/registration/model.mjs');
  const actor = { id: 'u1', email: 'a@example.com' };
  const refs = [{ id: 'B1', role: 'bishop', name: 'Ama Bishop', organization: 'First Love', denomination: 'First Love Church', city: 'Tema', branch: 'Old Branch', image: 'assets/portraits/B1.webp' }];
  const form = { role: 'bishop', firstName: 'Ama', lastName: 'Bishop', gender: 'female', email: actor.email, phone: '+233201234567', dob: '1970-01-01', organization: 'First Love', denomination: 'First Love Church',
    country: 'Ghana', city: 'Accra', church: 'New Branch', yearAppointed: '2001', yearOrdained: '2005', yearConsecrated: '2019', photo: 'u1/portrait/a.webp', photoConfirmed: true, consentedAt: '2026-11-22T00:00:00Z', referenceId: 'B1' };
  assert.throws(() => validateProfile({ ...form, yearConsecrated: '' }, actor.email), /consecrated/);
  assert.throws(() => validateProfile({ ...form, church: '' }, actor.email), /branch/);
  let s = { ...emptyState(), overrides: { B1: { city: 'Kumasi', _officeFields: ['city'] } } };
  s = applyAction(s, actor, 'submit', form, undefined, refs);
  s.registrations[0].status = 'confirmed';
  s = applyAction(s, actor, 'update', { city: 'Accra', church: 'New Branch', yearAppointed: '2001', yearOrdained: '2005', yearConsecrated: '2019', photoConfirmed: true }, undefined, refs);
  const rec = () => overlayReferences(refs, s).find((p) => p.id === 'B1');
  assert.equal(rec().city, 'Accra', 'their sign-up wins over an earlier office correction');
  assert.equal(rec().branch, 'New Branch');
  assert.equal(rec().yearConsecrated, '2019');
  assert.equal(rec().image, 'assets/portraits/B1.webp', 'same role and church: our portrait stays');
  assert.equal(shownPhoto(s.registrations[0], rec()).image, 'assets/portraits/B1.webp');
  // moved to another church: their own photo
  s.catalog = { organizations: ['First Love'], denominations: { 'First Love': ['First Love Church', 'Go Church'] } };
  s = applyAction(s, actor, 'update', { denomination: 'Go Church', photoConfirmed: true }, undefined, refs);
  applyDueChanges(s, Date.now() + 10 * 60 * 1000); // updates go live 5 minutes after saving
  assert.equal(rec().denomination, 'Go Church');
  assert.equal(rec().image, '', 'moved: not our portrait');
  assert.equal(rec().photo, 'u1/portrait/a.webp');
  assert.equal(shownPhoto(s.registrations[0], rec()).photo, 'u1/portrait/a.webp');
});
