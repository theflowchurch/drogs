import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyOfficePastorAdditions } from '../../scripts/lib/office-pastor-additions.mjs';
import { peopleForSite } from '../../src/registration/organization-sites.mjs';

const read = file => JSON.parse(readFileSync(file, 'utf8'));
const bishops = [{ id: 'B1', role: 'bishop', name: 'Test Bishop', organization: 'First Love', group: 'First Love', denomination: 'First Love Church', city: 'Different City', country: 'Different Country' }];
const addition = { id: 'PN0123456789ab', name: 'New Pastor', bishopId: 'B1', image: 'assets/portraits/PN0123456789ab-photo.webp', source: 'Explicit current office instruction' };

test('explicit pastor additions survive repeated builds without duplicates or invented personal details', () => {
  const pastors = [];
  applyOfficePastorAdditions(pastors, bishops, [addition]);
  applyOfficePastorAdditions(pastors, bishops, [addition]);
  assert.equal(pastors.length, 1);
  assert.equal(pastors[0].bishop, 'Test Bishop');
  assert.equal(pastors[0].organization, 'First Love');
  assert.equal(pastors[0].city, '');
  assert.equal(pastors[0].country, '');
  assert.equal(pastors[0].dob, undefined);
  pastors[0].image = 'assets/portraits/new-office-photo.webp';
  applyOfficePastorAdditions(pastors, bishops, [{ ...addition, city: 'Accra', country: 'Ghana' }]);
  assert.equal(pastors[0].city, 'Accra');
  assert.equal(pastors[0].country, 'Ghana');
  assert.equal(pastors[0].image, 'assets/portraits/new-office-photo.webp', 'later saved photographs are retained');
});

test('office additions cannot create a bishop-as-pastor, duplicate a current name, or reference an unknown bishop', () => {
  assert.throws(() => applyOfficePastorAdditions([], bishops, [{ ...addition, bishopId: 'missing' }]), /Unknown bishop/);
  assert.throws(() => applyOfficePastorAdditions([], bishops, [{ ...addition, name: 'Test Bishop' }]), /bishop as a pastor/);
  assert.throws(() => applyOfficePastorAdditions([{ id: 'P1', role: 'pastor', name: 'New Pastor' }], bishops, [addition]), /Existing pastor/);
  assert.throws(() => applyOfficePastorAdditions([], bishops, [addition, addition]), /Duplicate office addition/);
});

test('the supplied pastors appear once under the requested bishops and only on their organization site', () => {
  const people = read('src/registration/reference-people.json');
  const approvals = read('data/office-pastor-additions.json').additions;
  const expected = [['Morrison Bennet Obeng Darkwa', 'B252', 'firstlove'], ['Daniel Fokuo', 'B194', 'firstlove'], ['Calvince Dondi', 'B334', 'flow'], ['Natalie Welds', 'B334', 'flow'], ['Bright Mensah', 'B240', 'firstlove']];
  for (const [name, bishopId, site] of expected) {
    const matches = people.filter(p => p.name === name);
    assert.equal(matches.length, 1, name);
    const person = matches[0];
    assert.equal(person.role, 'pastor');
    assert.equal(person.bishop, people.find(p => p.id === bishopId).name);
    assert.equal(person.city, 'Accra');
    assert.equal(person.country, 'Ghana');
    assert.ok(person.image);
    assert.ok(approvals.some(a => a.id === person.id && a.bishopId === bishopId));
    for (const candidate of ['firstlove', 'ud', 'flow'])
      assert.equal(peopleForSite(people, candidate).some(p => p.id === person.id), candidate === site, name + ' / ' + candidate);
  }
});
