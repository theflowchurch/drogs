import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ORGANIZATION_SITES, peopleForSite, siteCatalog, sitePath, organizationAudit } from '../../src/registration/organization-sites.mjs';
import { withStanding, overlayReferences, emptyState, catalogOf } from '../../src/registration/model.mjs';
const b = (id, organization, denomination = 'Shared church') => ({ id, role: 'bishop', name: `Bishop ${id}`, organization, denomination });
const p = (id, organization, bishop) => ({ id, role: 'pastor', name: `Pastor ${id}`, organization, bishop });

test('three sites keep raw organizations and distinct First Love denominations', () => {
  const all = [b('a', 'First Love', 'Go Church'), b('b', 'United Denominations', 'Go Church'), b('c','FLOW'), b('d','HJC'), b('e','DHMM')];
  assert.deepEqual(Object.keys(ORGANIZATION_SITES), ['firstlove','ud','flow']);
  assert.deepEqual(peopleForSite(all,'firstlove').map(x=>x.id), ['a']);
  assert.deepEqual(peopleForSite(all,'ud').map(x=>x.id), ['b']);
  assert.deepEqual(peopleForSite(all,'flow').map(x=>[x.organization,x.group]), [['FLOW','FLOW'],['HJC','Healing Jesus Campaign'],['DHMM','DHMM']]);
  assert.equal(all[3].group, undefined);
  assert.equal(peopleForSite(all,'firstlove')[0].denomination,'Go Church');
  assert.deepEqual(peopleForSite(all,''), all);
});

test('pastors stay with their uniquely linked bishop, including stable IDs and ambiguous names', () => {
  const all = [b('a','First Love'), b('b','United Denominations'), p('p','United Denominations','Bishop a'), {...p('q','First Love',''), bishopId:'b'}, {...b('c','United Denominations'), name:'Bishop a'}, p('r','First Love','Bishop a')];
  // Duplicate bishop names are not used to invent a cross-site move.
  assert.deepEqual(peopleForSite(all,'firstlove').map(x=>x.id), ['a','r']);
  assert.deepEqual(peopleForSite(all,'ud').map(x=>x.id), ['b','p','q','c']);
  const unique = all.filter(x=>x.id !=='c');
  assert.deepEqual(peopleForSite(unique,'firstlove').map(x=>x.id), ['a','p','r']);
  assert.equal(unique.find(x=>x.id==='p').organization,'United Denominations');
});

test('new roll entries cannot leak into a scoped directory through withStanding', () => {
  const all = [b('a','First Love'),b('b','HJC')];
  const roll = [{...b('new','United Denominations'),referenceId:''}, {...b('u:a','First Love'),referenceId:'a',pastors:[{id:'kid',name:'Kid'}]}];
  const list = peopleForSite(withStanding(all,roll),'firstlove');
  assert.deepEqual(list.map(x=>x.id),['a']);
  assert.equal(list[0].standing,true);
  assert.equal(list[0].pastors[0].id,'kid');
});

test('office corrections move the person and their pastors to the right site on refresh', () => {
  const all = [b('a','First Love'), p('p','First Love','Bishop a')];
  const changed = overlayReferences(all,{...emptyState(), overrides:{a:{organization:'HJC',name:'New name'},p:{bishop:'New name'}}});
  assert.equal(peopleForSite(changed,'firstlove').length,0);
  assert.deepEqual(peopleForSite(changed,'flow').map(x=>x.id),['a','p']);
});

test('scoped catalogs follow saved admin denominations, paths include scope and base path', () => {
  const catalog = catalogOf(emptyState());
  catalog.denominations['First Love'].push('New First Love denomination');
  const scoped = siteCatalog(catalog,'firstlove');
  assert.deepEqual(scoped.organizations,['First Love']);
  assert.ok(scoped.denominations['First Love'].includes('New First Love denomination'));
  assert.equal(scoped.denominations['United Denominations'],undefined);
  assert.equal(sitePath('firstlove','signup/pastor','/preview'),'/preview/firstlove/signup/pastor/');
  assert.equal(sitePath('','signup'),'/signup/');
  assert.equal(sitePath('flow'),'/flow/');
  assert.equal(organizationAudit([b('a','First Love'),b('b','United Denominations')]).sharedDenominations.length,1);
});

test('the nine women confirmed for FLOW move together while BDR remains in First Love', () => {
  const people = JSON.parse(readFileSync('src/registration/reference-people.json', 'utf8'));
  const ids = ['B187', 'B127', 'BO250', 'BO265', 'BO221', 'B59', 'BO215', 'B200', 'BO251'];
  const flow = new Set(peopleForSite(people, 'flow').map(p => p.id));
  const firstLove = new Set(peopleForSite(people, 'firstlove').map(p => p.id));
  for (const id of ids) {
    const person = people.find(p => p.id === id);
    assert.equal(person.role, 'bishop');
    assert.equal(person.organization, 'FLOW', person.name);
    assert.equal(person.group, 'FLOW', person.name);
    assert.ok(flow.has(id), person.name);
    assert.ok(!firstLove.has(id), person.name);
  }
  assert.equal(people.find(p => p.id === 'B79').organization, 'First Love');
  assert.ok(firstLove.has('B79'));
  assert.ok(!flow.has('B79'));
});
