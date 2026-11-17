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
  const state = { ...emptyState(), overrides: { ...Object.fromEntries(seven.map(id => [id, { deleted: true }])), B123: { denomination: 'Malawi', _officeFields: ['denomination'] } } };
  const once = syncRoll(state, people, 'v1');
  for (const id of seven) assert.ok(overlayReferences(people, once).some(p => p.id === id), id);
  assert.equal(once.overrides.B123.denomination, 'Malawi', "the office's other changes stay");
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
