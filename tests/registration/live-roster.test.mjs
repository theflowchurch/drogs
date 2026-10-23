import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRosterLoader, rosterFrom, publicRosterFrom } from '../../src/registration/live-roster.mjs';
import { overlayReferences, pastorsByBishop, directoryPeople, emptyState } from '../../src/registration/model.mjs';
import { peopleForSite } from '../../src/registration/organization-sites.mjs';

test('an already open page replaces its old roster on the next server revision', async () => {
  const old = [{ id: 'B323', role: 'bishop', name: 'Joy Bruce' }, { id: 'P3860', role: 'pastor', name: 'Russell Amoah Konadu', bishop: 'Joy Bruce' }];
  const current = JSON.parse(readFileSync('src/registration/reference-people.json', 'utf8'));
  let version = 'old', calls = 0;
  const load = createRosterLoader(async () => { calls++; return { rosterVersion: version, referencePeople: version === 'old' ? old : current }; });
  await load({ rosterVersion: 'old' });
  version = 'submitted';
  const snapshot = await load({ ...emptyState(), rosterVersion: version, overrides: { B323: { name: 'Joy Bruce' }, S10325a07: { name: 'Paulina Ama Drah' } } });
  const publicPeople = peopleForSite(overlayReferences(publicRosterFrom(snapshot, old), snapshot), 'firstlove');
  assert.equal(pastorsByBishop(publicPeople).get('B323').length, 29);
  const officePeople = directoryPeople(snapshot, rosterFrom(snapshot, old));
  assert.equal(pastorsByBishop(officePeople).get('B323').length, 29);
  assert.equal(officePeople.find(p => p.id === 'S10325a07').name, 'Osylina Ama Ansah');
  for (const list of [publicPeople, officePeople]) {
    assert.ok(!list.some(p => ['P3860', 'P3468'].includes(p.id)));
    assert.ok(list.some(p => p.id === 'Saa7e3144'));
    assert.ok(list.some(p => p.id === 'S4994a2da-5272'));
  }
  await load({ rosterVersion: version });
  assert.equal(calls, 2, 'one roster download per revision');
});

test('concurrent snapshots share downloads, and failed or mismatched revisions retry', async () => {
  let calls = 0, fail = true, version = 'v1';
  const load = createRosterLoader(async () => { calls++; if (fail) throw Error('offline'); return { rosterVersion: version, referencePeople: [] }; });
  await assert.rejects(load({ rosterVersion: 'v1' }), /offline/);
  fail = false;
  await Promise.all([load({ rosterVersion: 'v1' }), load({ rosterVersion: 'v1' })]);
  assert.equal(calls, 2);
  await assert.rejects(load({ rosterVersion: 'v2' }), /being updated/);
  version = 'v2';
  const snapshot = await load({ rosterVersion: 'v2' });
  assert.deepEqual(rosterFrom(snapshot, [{ id: 'old' }]), [], 'an empty live roster never falls back to old people');
  assert.equal(calls, 4);
});

test('previews retain their local roster and public views exclude unclaimed entries', async () => {
  const load = createRosterLoader(() => { throw Error('preview must not download'); });
  const snapshot = await load({ source: 'original' });
  const bundled = [{ id: 'a' }, { id: 'b', unclaimed: 'office review' }];
  assert.equal(rosterFrom(snapshot, bundled), bundled);
  assert.deepEqual(publicRosterFrom(snapshot, bundled), [{ id: 'a' }]);
});

test('roster requests use the revision as their cache key, including after a deployment', async()=>{
 const requested=[];const load=createRosterLoader(async version=>{requested.push(version);return {rosterVersion:version,referencePeople:[]};});
 await load({rosterVersion:'first'});await load({rosterVersion:'first'});await load({rosterVersion:'second'});assert.deepEqual(requested,['first','second']);
});
