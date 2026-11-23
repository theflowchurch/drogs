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
test('22 Nov: a sign-up with one clear match on our list is linked to it; two candidates wait for the office', async () => {
  const { clearMatch } = await import('../../src/server/auto-photo.mjs');
  const joshua = { id: 'S7f891fda', role: 'pastor', name: 'Joshua Korsi Gbafa', bishop: 'Nely Nina Masuku', organization: 'FLOW' };
  const r = { data: { role: 'pastor', name: 'Joshua Gbafa', bishopName: 'Nina Masuku', organization: 'FLOW' } };
  assert.equal(clearMatch([joshua], r)?.id, 'S7f891fda');
  assert.equal(clearMatch([joshua, { ...joshua, id: 'X2' }], r), null, 'two candidates: the office decides');
  assert.equal(clearMatch([{ ...joshua, bishop: 'Someone Else' }], r), null, 'another bishop: not linked');
  const bishop = { id: 'B9', role: 'bishop', name: 'Kodwo K Orleans-Lindsay' };
  assert.equal(clearMatch([bishop], { data: { role: 'bishop', name: 'Kodwo Orleans-Lindsay' } })?.id, 'B9');
});
test('22 Nov: an Archbishop in good standing confirms new bishops; a bishop on our records is confirmed on signing up', async () => {
  const { applyAction, emptyState, visibleState, todoFor, isArchbishop } = await import('../../src/registration/model.mjs');
  const refs = [{ id: 'B86', role: 'bishop', name: 'Jacob Etrue Godwyll', title: 'Archbishop', organization: 'First Love', denomination: 'First Love Church' }];
  const form = (who, extra = {}) => ({ role: 'bishop', firstName: who.split(' ')[0], lastName: who.split(' ').slice(1).join(' '), gender: 'male', phone: '+233201234567', dob: '1970-01-01', organization: 'First Love', denomination: 'First Love Church',
    country: 'Ghana', city: 'Accra', church: 'Accra', yearAppointed: '2001', yearOrdained: '2005', yearConsecrated: '2019', photo: 'p.webp', photoConfirmed: true, consentedAt: '2026-11-22T00:00:00Z', ...extra });
  const arch = { id: 'a1', email: 'arch@example.com' }, nb = { id: 'n1', email: 'new@example.com' }, office = { id: 'o', office: true, email: 'o@example.com' };
  let s = { ...emptyState(), overrides: { B86: { title: 'Archbishop' } } };
  s = applyAction(s, arch, 'submit', { ...form('Jacob Etrue Godwyll'), email: arch.email, referenceId: 'B86' }, undefined, refs);
  assert.equal(s.profiles.find((p) => p.id === 'a1').bishopApproved, true, 'on our records: confirmed on signing up');
  s = applyAction(s, nb, 'submit', { ...form('Brand New'), email: nb.email }, undefined, refs);
  assert.equal(s.registrations.find((r) => r.userId === 'n1').status, 'pending', 'a new bishop waits');
  // Not yet in good standing (payment not confirmed): no power to confirm.
  assert.equal(isArchbishop(s, 'a1'), false);
  assert.throws(() => applyAction(s, arch, 'approveBishop', { userId: 'n1' }, undefined, refs));
  s.registrations.find((r) => r.userId === 'a1').payment = 'verified';
  assert.equal(isArchbishop(s, 'a1'), true);
  const seen = visibleState(s, arch, refs);
  assert.equal(todoFor(seen, arch).bishopsToApprove.length, 1, 'the Archbishop sees the new bishop to confirm');
  assert.equal(seen.registrations.find((r) => r.userId === 'n1').data.phone, undefined, 'without their private details');
  s = applyAction(s, arch, 'approveBishop', { userId: 'n1' }, undefined, refs);
  assert.equal(s.profiles.find((p) => p.id === 'n1').bishopApproved, true);
  // An ordinary bishop cannot.
  const other = { id: 'b2', email: 'b2@example.com' };
  s = applyAction(s, other, 'submit', { ...form('Another New'), email: other.email }, undefined, refs);
  assert.throws(() => applyAction(s, nb, 'approveBishop', { userId: 'b2' }, undefined, refs));
  // The office still can.
  s = applyAction(s, office, 'approveBishop', { userId: 'b2' }, undefined, refs);
  assert.equal(s.profiles.find((p) => p.id === 'b2').bishopApproved, true);
});
