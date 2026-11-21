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
  // Office, 21 Nov: a new registration that is confirmed (here a listed bishop,
  // approved at once) goes live straight away, without the 30 minutes.
  assert.equal(s.registrations[0].status, 'confirmed');
  assert.ok(!changePending(s.registrations[0]), 'a confirmed new registration is live at once');
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

test('a bishop adds a denomination with its logo; once live it is on the list, in its group, and has a church page', async () => {
  const { catalogOf } = await import('../../src/registration/model.mjs');
  const { liveChurchFrom, churchPathOf } = await import('../../src/registration/denomination-sites.mjs');
  const extra = { organization: 'United Denominations', denomination: 'Grace City Church Accra', newDenomination: 'Grace City Church Accra', newDenominationGroup: 'UD Ghana', newDenominationLogo: 'b1/logo/x.webp' };
  let s = applyAction(emptyState(), bishop, 'submit', profile(extra), undefined, refs);
  assert.equal(s.registrations[0].data.newDenomination, 'Grace City Church Accra');
  assert.ok(!catalogOf(s).denominations['United Denominations'].includes('Grace City Church Accra'), 'not on the list before the 30 minutes');
  applyDueChanges(s, Date.now() + CHANGE_DELAY_MS + 1000);
  const cat = catalogOf(s);
  assert.ok(cat.denominations['United Denominations'].includes('Grace City Church Accra'), 'pastors can now choose it');
  assert.ok(cat.groups['UD Ghana'].denominations.includes('Grace City Church Accra'));
  assert.equal(cat.logos['Grace City Church Accra'], 'b1/logo/x.webp');
  const page = liveChurchFrom(cat, churchPathOf('Grace City Church Accra'));
  assert.equal(page.name, 'Grace City Church Accra');
  assert.match(page.logo, /media\/blob\?path=b1%2Flogo%2Fx\.webp/);
  // An existing name (any capitals) is used as it is, not added twice.
  const t = applyAction(emptyState(), bishop, 'submit', profile({ organization: 'United Denominations', denomination: 'tell them church', newDenomination: 'tell them church' }), undefined, refs);
  assert.equal(t.registrations[0].data.denomination, 'Tell Them Church');
  assert.equal(t.registrations[0].data.newDenomination, '');
  // Pastors cannot add one.
  // A new denomination says which group it is under (when its organization has groups).
  assert.throws(() => applyAction(emptyState(), bishop, 'submit', profile({ organization: 'United Denominations', denomination: 'Brand New Church', newDenomination: 'Brand New Church' }), undefined, refs), /which group/);
  assert.throws(() => applyAction(emptyState(), { id: 'p9', email: 'p@example.com' }, 'submit', { ...profile({ organization: 'United Denominations', denomination: 'Brand New Church', newDenomination: 'Brand New Church' }), role: 'pastor', name: 'Pat Pastor', firstName: 'Pat', lastName: 'Pastor', email: 'p@example.com', bishopId: 'B1' }, undefined, refs), /Select a denomination/);
});

// Office, 19 Nov: the registration deadline hides everyone not in good standing
// from the public pages (records kept), closes registration, and can be lifted.
test('the registration deadline shows only those in good standing, and can be lifted', async () => {
  const m = await import('../../src/registration/model.mjs');
  const people = [{ id: 'B1', role: 'bishop', name: 'Ann Bishop' }, { id: 'B2', role: 'bishop', name: 'Ben Bishop' }];
  const office = { id: 'o', email: 'office@example.com', office: true };
  let s = m.emptyState();
  assert.deepEqual(m.publicOverlay(s, people).hidden, []);
  s = m.applyAction(s, office, 'applyDeadline', { kept: 0, removed: 2 }, undefined, people);
  assert.equal(s.deadline.applied, true);
  assert.equal(m.signupOf(s).closed, true);
  assert.deepEqual(m.publicOverlay(s, people).hidden.sort(), ['B1', 'B2']);
  s = m.applyAction(s, office, 'liftDeadline', { reopen: false }, undefined, people);
  assert.deepEqual(m.publicOverlay(s, people).hidden, []);
  assert.equal(m.signupOf(s).closed, true);
  s = m.applyAction(s, office, 'applyDeadline', {}, undefined, people);
  s = m.applyAction(s, office, 'liftDeadline', { reopen: true }, undefined, people);
  assert.equal(m.signupOf(s).closed, false);
  assert.equal(s.deadline.applied, false);
  assert.throws(() => m.applyAction(s, { id: 'x', email: 'x@example.com' }, 'applyDeadline', {}, undefined, people));
  // The date the office sets is shown publicly and kept through apply and reopen.
  s = m.applyAction(s, office, 'setDeadlineDate', { date: '2027-01-31' }, undefined, people);
  assert.equal(m.publicOverlay(s, people).deadline.date, '2027-01-31');
  s = m.applyAction(s, office, 'applyDeadline', {}, undefined, people);
  assert.equal(s.deadline.date, '2027-01-31');
  assert.throws(() => m.applyAction(s, office, 'setDeadlineDate', { date: 'soon' }, undefined, people), /Choose a date/);
});

test('a new pastor waits until their bishop confirms them, then is live at once (21 Nov)', async () => {
  const { publicRoll: roll } = await import('../../src/registration/model.mjs');
  let s = applyAction(emptyState(), bishop, 'submit', { ...profile(), referenceId: 'B1' }, undefined, refs);
  s.registrations[0].payment = 'verified';
  const pastor = { id: 'np1', email: 'np@example.com' };
  s = applyAction(s, pastor, 'submit', { ...profile(), role: 'pastor', firstName: 'New', lastName: 'Pastor', name: 'New Pastor', email: 'np@example.com', title: 'Pastor', bishopId: 'B1', bishopName: 'Ama Bishop', referenceId: undefined }, undefined, refs);
  const r = s.registrations.find(x => x.userId === 'np1');
  assert.ok(r, 'the pastor registered');
  assert.equal(r.status, 'unclaimed', 'waits for the bishop');
  {
    assert.ok(changePending(r), 'waiting for the bishop: not public');
    r.payment = 'verified';
    s = applyAction(s, bishop, 'claim', { userId: 'np1' }, undefined, refs);
  }
  const after = s.registrations.find(x => x.userId === 'np1');
  assert.equal(after.status, 'confirmed');
  assert.ok(!changePending(after), 'confirmed: live at once, no 30 minutes');
});
