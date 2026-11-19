import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { liveRoll, patchGroups } from '../../src/registration/live-patch.mjs';
import { DIRECTORY_GROUPS, allBishopsOf } from '../../src/registration/ministry-organisations.mjs';
import { pastorEntries, pastorGroups } from '../../src/registration/public-entries.mjs';

// Office, 17 Nov: every public page follows what the office does on the admin page.
const people = JSON.parse(readFileSync('src/registration/reference-people.json', 'utf8'));
const someBishop = DIRECTORY_GROUPS.find(g => g.slug === 'ud-ghana-west').people.find(p => p.rosterId?.startsWith('B'));
const somePastor = people.find(p => p.role === 'pastor' && p.bishop === 'Andrew Kwaku Osei');
const office = (overrides = {}, extraReferences = [], hidden = []) => liveRoll(people, { overrides, extraReferences, hidden, catalog: {} });
const bishopsOf = live => allBishopsOf(patchGroups(DIRECTORY_GROUPS, live).groups);
const where = (live, id) => patchGroups(DIRECTORY_GROUPS, live).groups.flatMap(g => (g.parts ? g.parts.flatMap(x => x.people) : g.all || g.people).filter(p => p.rosterId === id).map(() => g.slug));

test('a bishop the office deletes or hides leaves every bishops page', () => {
  assert.ok(bishopsOf(office()).some(b => b.rosterId === someBishop.rosterId));
  assert.ok(!bishopsOf(office({ [someBishop.rosterId]: { deleted: true } })).some(b => b.rosterId === someBishop.rosterId));
  assert.ok(!bishopsOf(office({}, [], [someBishop.rosterId])).some(b => b.rosterId === someBishop.rosterId));
});
test("the office's corrections and photos show on the bishops pages", () => {
  const live = office({ [someBishop.rosterId]: { name: 'Corrected Name Here', yearConsecrated: '2020', photo: 'upload/portrait/x.webp' } });
  const b = bishopsOf(live).find(b => b.rosterId === someBishop.rosterId);
  assert.equal(b.name, 'Corrected Name Here'); assert.equal(b.consecrated, '2020'); assert.equal(b.photo, 'upload/portrait/x.webp');
});
test('a bishop the office makes a pastor moves from the bishops pages to the pastor pages', () => {
  const live = office({ [someBishop.rosterId]: { role: 'pastor', title: 'Rev.', bishop: 'Andrew Kwaku Osei' } });
  assert.ok(!bishopsOf(live).some(b => b.rosterId === someBishop.rosterId));
  assert.ok(pastorEntries(live.people).some(p => p.rosterId === someBishop.rosterId));
});
test('a pastor the office makes a bishop joins the bishops pages beside their church', () => {
  const live = office({ [somePastor.id]: { role: 'bishop', title: 'Bishop' } });
  assert.ok(bishopsOf(live).some(b => b.rosterId === somePastor.id));
  assert.ok(where(live, somePastor.id).length >= 1);
  assert.ok(!pastorEntries(live.people).some(p => p.rosterId === somePastor.id));
});
test('people the office adds appear, a new church gets its own box, and nobody shows twice', () => {
  const live = office({}, [
    { id: 'Xnew1', role: 'bishop', name: 'New Bishop Person', title: 'Bishop', organization: 'United Denominations', denomination: 'Brand New Church', group: '', image: '', photo: '' },
    { id: 'Xnew2', role: 'pastor', name: 'New Pastor Person', title: 'Pastor', organization: 'United Denominations', denomination: 'Brand New Church', bishop: 'New Bishop Person', image: '', photo: '' },
  ]);
  const { groups } = patchGroups(DIRECTORY_GROUPS, live);
  assert.ok(groups.some(g => g.name === 'The Bishops of Brand New Church' && g.people.some(p => p.rosterId === 'Xnew1')));
  const pastors = pastorEntries(live.people);
  assert.ok(pastorGroups(pastors, ['#000']).some(g => g.name === 'The Pastors of Brand New Church'));
  assert.ok(pastors.find(p => p.rosterId === 'Xnew2').details.some(d => d.value === 'Bishop New Bishop Person'));
  const ids = allBishopsOf(groups).map(b => b.rosterId); assert.equal(new Set(ids).size, ids.length);
});

test('the seven pastors deleted twice over are restored once, and can be deleted again later', async () => {
  const { emptyState, syncRoll, overlayReferences } = await import('../../src/registration/model.mjs');
  const seven = ['Sb8c7d044', 'PF158', 'Sdb542231', 'S0ec63b27', 'S391d2dfe', 'PF260', 'S961d9198'];
  const state = { ...emptyState(), overrides: { ...Object.fromEntries(seven.map(id => [id, { deleted: true }])), B123: { denomination: 'Go Church', _officeFields: ['denomination'] } } };
  const once = syncRoll(state, people, 'v1');
  for (const id of seven) assert.ok(overlayReferences(people, once).some(p => p.id === id), id);
  assert.equal(once.overrides.B123.denomination, 'Go Church', "the office's other changes stay");
  const deletedAgain = { ...once, overrides: { ...once.overrides, PF260: { deleted: true } } };
  assert.equal(syncRoll(deletedAgain, people, 'v1'), null, 'not applied a second time');
  assert.ok(!overlayReferences(people, deletedAgain).some(p => p.id === 'PF260'));
});
test('the directory shows our photo, not the member upload, unless we hold none or the office picks the upload', async () => {
  const { shownPhoto } = await import('../../src/registration/model.mjs');
  const reg = { displayPhoto: 'upload', data: { photo: 'member.webp' } };
  assert.deepEqual(shownPhoto(reg, { image: 'ours.webp' }), { photo: '', image: 'ours.webp' });
  assert.deepEqual(shownPhoto(reg, { image: 'ours.webp', photo: 'office.webp' }), { photo: 'office.webp', image: '' });
  assert.deepEqual(shownPhoto(reg, { image: '' }), { photo: 'member.webp', image: '' });
  assert.deepEqual(shownPhoto({ ...reg, photoByOffice: true }, { image: 'ours.webp' }), { photo: 'member.webp', image: 'ours.webp' });
});
test('member uploads already copied onto records come off once; office uploads stay', async () => {
  const { emptyState, syncRoll } = await import('../../src/registration/model.mjs');
  const refs = [{ id: 'P1', role: 'pastor', name: 'A', image: 'edited.webp' }, { id: 'P2', role: 'pastor', name: 'B', image: 'edited2.webp' }];
  const s = { ...emptyState(), officeFixes: ['restore-seven-2026-11-17'],
    profiles: [{ id: 'u1', referenceId: 'P1' }],
    registrations: [{ userId: 'u1', year: 2027, status: 'confirmed', data: { referenceId: 'P1', photo: 'u1/portrait/own.webp' } }],
    overrides: { P1: { photo: 'u1/portrait/own.webp' }, P2: { photo: 'office-user/portrait/office.webp' } } };
  const next = syncRoll(s, refs, 'v-member-photos');
  assert.equal(next.overrides.P1.photo, undefined);
  assert.equal(next.overrides.P2.photo, 'office-user/portrait/office.webp');
  assert.ok(next.officeFixes.includes('member-photos-off-records-2026-11-17'));
});
test('to do: a bishop sees pastors who named them; "not my pastor" sends them back to the office', async () => {
  const { emptyState, applyAction, todoFor, visibleState } = await import('../../src/registration/model.mjs');
  const bishop = { id: 'b1', email: 'b@x.com' }, office = { id: 'o', email: 'o@x.com', office: true };
  const s = { ...emptyState(), year: 2027, profiles: [{ id: 'b1', role: 'bishop', name: 'Ama Mensah', bishopApproved: true }, { id: 'p2', role: 'bishop', name: 'Esi Bishop' }],
    registrations: [
      { userId: 'b1', year: 2027, status: 'confirmed', data: { role: 'bishop', name: 'Ama Mensah' } },
      { userId: 'p1', year: 2027, status: 'unclaimed', data: { role: 'pastor', name: 'Kofi Pastor', bishopId: 'b1', bishopName: 'Ama Mensah' } },
      { userId: 'p2', year: 2027, status: 'confirmed', payment: 'pending', proof: 'p2/receipt/x.webp', data: { role: 'bishop', name: 'Esi Bishop' } }] };
  assert.deepEqual(todoFor(visibleState(s, bishop, []), bishop).pastorsToConfirm.map(r => r.userId), ['p1']);
  const o = todoFor(s, office);
  assert.equal(o.pastorsToConfirm.length, 1); assert.equal(o.receiptsToCheck.length, 1); assert.equal(o.total, 2);
  const next = applyAction(s, bishop, 'declinePastor', { userId: 'p1' });
  assert.equal(next.registrations[1].data.bishopId, '');
  assert.equal(todoFor(visibleState(next, bishop, []), bishop).total, 0, 'gone from the bishop');
  assert.equal(todoFor(next, office).pastorsToConfirm.length, 1, 'still with the office');
  assert.throws(() => applyAction(s, { id: 'x', email: 'x@x.com' }, 'declinePastor', { userId: 'p1' }), /Only the bishop/);
});
test('the bishop who confirms a pastor becomes their bishop everywhere; a pastor who changes bishop waits again', async () => {
  const { emptyState, applyAction, overlayReferences } = await import('../../src/registration/model.mjs');
  const refs = [{ id: 'BJ', role: 'bishop', name: 'Joshua Heward-Mills' }, { id: 'BF', role: 'bishop', name: 'Frank Opoku' }, { id: 'P9', role: 'pastor', name: 'Kofi Mensah', bishop: 'Joshua Heward-Mills', image: 'p9.webp' }];
  const frank = { id: 'f', email: 'f@x.com' }, pastor = { id: 'p', email: 'p@x.com' };
  let s = { ...emptyState(), year: 2027,
    profiles: [{ id: 'f', role: 'bishop', name: 'Frank Opoku', referenceId: 'BF', bishopApproved: true }, { id: 'p', role: 'pastor', name: 'Kofi Mensah', referenceId: 'P9' }],
    registrations: [
      { userId: 'f', year: 2027, status: 'confirmed', data: { role: 'bishop', name: 'Frank Opoku', referenceId: 'BF' } },
      { userId: 'p', year: 2027, status: 'unclaimed', data: { role: 'pastor', name: 'Kofi Mensah', referenceId: 'P9', bishopId: 'BF', bishopName: 'Frank Opoku' } }] };
  s = applyAction(s, frank, 'claim', { userId: 'p' }, undefined, refs);
  assert.equal(s.registrations[1].status, 'confirmed');
  assert.equal(overlayReferences(refs, s).find(p => p.id === 'P9').bishop, 'Frank Opoku', 'moved under Frank on every page');
  assert.ok(s.overrides.P9._officeFields.includes('bishop'), 'kept through later roll updates');
});
test("Nina's unregistered listed pastors wait for her to confirm them; confirming uses their line on her list", async () => {
  const { emptyState, syncRoll, matchFor, applyAction } = await import('../../src/registration/model.mjs');
  const refs = [{ id: 'B334', role: 'bishop', name: 'Nina Masuku', title: 'Mother' }, { id: 'PA', role: 'pastor', name: 'Ama Done', bishop: 'Nina Masuku' }, { id: 'PK', role: 'pastor', name: 'Kojo Later', bishop: 'Nina Masuku' }];
  const nina = { id: 'nina', email: 'n@x.com' };
  let s = { ...emptyState(), year: 2027, officeFixes: ['restore-seven-2026-11-17', 'member-photos-off-records-2026-11-17'],
    profiles: [{ id: 'nina', role: 'bishop', name: 'Nina Masuku', referenceId: 'B334', bishopApproved: true }, { id: 'already', role: 'pastor', name: 'Ama Done' }],
    registrations: [{ userId: 'nina', year: 2027, status: 'confirmed', data: { role: 'bishop', name: 'Nina Masuku', referenceId: 'B334' } },
      { userId: 'already', year: 2027, status: 'confirmed', data: { role: 'pastor', name: 'Ama Done', dob: '1990-01-01', bishopId: 'B334' } }],
    rosters: [{ id: 'r1', bishopId: 'nina', year: 2027, name: 'Ama Done', dob: '1990-01-01', status: 'active', pastorId: 'already' },
      { id: 'r2', bishopId: 'nina', year: 2027, name: 'Kojo Later', dob: '1991-02-02', status: 'active' }] };
  s = syncRoll(s, refs, 'v-nina');
  assert.equal(s.rosters.find(r => r.id === 'r1').claimRequired, undefined, 'already registered and confirmed: unchanged');
  assert.equal(s.rosters.find(r => r.id === 'r2').claimRequired, true);
  const pastorReg = { userId: 'kojo', year: 2027, status: 'unclaimed', data: { role: 'pastor', name: 'Kojo Later', dob: '1991-02-02', bishopId: 'B334', bishopName: 'Nina Masuku' } };
  assert.equal(matchFor(s, pastorReg), null, 'no automatic confirmation');
  s = { ...s, registrations: [...s.registrations, pastorReg] };
  s = applyAction(s, nina, 'claim', { userId: 'kojo' }, undefined, refs);
  assert.equal(s.rosters.filter(r => r.name === 'Kojo Later').length, 1, 'her existing line is used, no duplicate');
  assert.equal(s.rosters.find(r => r.id === 'r2').pastorId, 'kojo');
  assert.equal(s.registrations.find(r => r.userId === 'kojo').status, 'confirmed');
});
test("a bishop cannot add a pastor who registered and was confirmed by another bishop", async () => {
  const { emptyState, applyAction } = await import('../../src/registration/model.mjs');
  const b2 = { id: 'b2', email: 'b2@x.com' };
  const s = { ...emptyState(), year: 2027,
    profiles: [{ id: 'b1', role: 'bishop', name: 'Ama Mensah', bishopApproved: true }, { id: 'b2', role: 'bishop', name: 'Kofi Other', bishopApproved: true }],
    registrations: [
      { userId: 'b1', year: 2027, status: 'confirmed', data: { role: 'bishop', name: 'Ama Mensah' } },
      { userId: 'b2', year: 2027, status: 'confirmed', data: { role: 'bishop', name: 'Kofi Other' } },
      { userId: 'p1', year: 2027, status: 'confirmed', data: { role: 'pastor', name: 'Esi Pastor', dob: '1990-01-01', bishopId: 'b1' } }],
    rosters: [{ id: 'r', bishopId: 'b1', year: 2027, name: 'Esi Pastor', dob: '1990-01-01', status: 'active', pastorId: 'p1' }] };
  assert.throws(() => applyAction(s, b2, 'addRoster', { rows: [{ name: 'Esi Pastor', dob: '01/01/1990' }] }), /already registered and confirmed under Bishop Ama Mensah/);
  const ok = applyAction(s, b2, 'addRoster', { rows: [{ name: 'Yaw Someone', dob: '02/02/1991' }] });
  assert.ok(ok.rosters.some(r => r.name === 'Yaw Someone' && r.bishopId === 'b2'), 'other names are still added');
});
test('18 Nov: blank denominations come off records; FLOW registrations keep FLOW; changing denomination moves the person between church pages', async () => {
  const { emptyState, syncRoll, overlayReferences, applyAction, publicOverlay } = await import('../../src/registration/model.mjs');
  const { denominationPeople, DENOMINATION_SITES } = await import('../../src/registration/denomination-sites.mjs');
  const refs = [{ id: 'PF', role: 'pastor', name: 'Darius Phiri', organization: 'FLOW', denomination: 'FLOW', image: 'd.webp', bishop: 'Nina Masuku' }];
  let s = { ...emptyState(), officeFixes: ['restore-seven-2026-11-17', 'member-photos-off-records-2026-11-17', 'nina-confirms-her-pastors-2026-11-17'], overrides: { PF: { denomination: '', city: 'Accra', _officeFields: ['city'] } } };
  s = syncRoll(s, refs, 'v-blank');
  assert.equal(overlayReferences(refs, s)[0].denomination, 'FLOW');
  assert.equal(s.overrides.PF.city, 'Accra', 'other office fields stay');
  assert.ok(DENOMINATION_SITES.flowdenomination, 'FLOW has a church page');
  assert.deepEqual(denominationPeople({ referencePeople: refs, ...publicOverlay(s), roll: [] }, 'flowdenomination').map(p => p.id), ['PF']);
  for (const path of ['heritagebaptistchurchglobal', 'loveeconomychurch', 'revivalhouseofholyfireministries', 'christvisionsanctuaryinternational']) assert.ok(DENOMINATION_SITES[path], path);
  // A pastor on our list who registers under a different church moves to that church's page.
  const refs2 = [{ id: 'P1', role: 'pastor', name: 'John Doe', organization: 'First Love', denomination: 'First Love Church' }];
  const pastor = { id: 'u1', email: 'j@x.com' };
  let t = { ...emptyState(), profiles: [{ id: 'u1', role: 'pastor', name: 'John Doe', referenceId: 'P1' }],
    registrations: [{ userId: 'u1', year: emptyState().year, status: 'confirmed', data: { role: 'pastor', name: 'John Doe', firstName: 'John', lastName: 'Doe', referenceId: 'P1', organization: 'First Love', denomination: 'First Love Church', country: 'Ghana', city: 'Accra', phone: '+233201234567', email: 'j@x.com', dob: '1990-01-01', gender: 'male', photo: 'u1/portrait/a.webp', photoConfirmed: true, bishopId: 'B1' } }] };
  t = applyAction(t, pastor, 'update', { denomination: 'Go Church', photoConfirmed: true }, undefined, refs2);
  const view = { referencePeople: refs2, ...publicOverlay(t), roll: [] };
  assert.deepEqual(denominationPeople(view, 'gochurch').map(p => p.id), ['P1'], 'now on Go Church');
  assert.deepEqual(denominationPeople(view, 'firstlovechurch').map(p => p.id), [], 'no longer on First Love Church');
});
