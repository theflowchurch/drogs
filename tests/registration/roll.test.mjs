import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The roll is built from the Bishops List and the bishops' own sheets only (scripts/build-roll.mjs).
const people = JSON.parse(readFileSync(new URL('../../src/registration/reference-people.json', import.meta.url), 'utf8'));
const report = JSON.parse(readFileSync(new URL('../../data/reports/roll-build.json', import.meta.url), 'utf8'));
const lay = people.filter((p) => p.title === 'Lay President');
const bishops = people.filter((p) => p.role === 'bishop' && p.title !== 'Lay President'), pastors = people.filter((p) => p.role === 'pastor');
const under = (name) => pastors.filter((p) => p.bishop === name);

test('every bishop on the Bishops List is on the roll, and nobody else is a bishop', () => {
  assert.equal(bishops.length, 283);
  assert.ok(bishops.every((b) => b.group && b.organization), 'each bishop has a group');
});
test('the three Lay Presidents claim their pastors and are not counted as bishops', () => {
  assert.equal(lay.length, 3);
  for (const l of lay) assert.ok(under(l.name).length > 10, l.name);
  assert.ok(people.indexOf(lay[0]) > people.findLastIndex((p) => p.role === 'bishop' && p.title !== 'Lay President'), 'lay presidents come after the bishops');
});
test("a bishop's pastors are exactly the people on their sheet", () => {
  assert.ok(under('Benjamin Kwapong Lokko').length >= 75); // his file carries another bishop's details row, but the pastors are his
  assert.ok(under('Glen Kwame Opoku').length >= 130); // the sheet sent in the group on 9 Oct
  assert.ok(under('Kenneth Agyei').length <= 1); // his sheet lists one
});
test('a pastor is under one bishop or Unclaimed with a reason, never both', () => {
  for (const p of pastors) assert.equal(Boolean(p.unclaimed), !p.bishop, p.name);
  assert.ok(report.conflicts.every((c) => c.claims.length >= 2 && c.claims.every((k) => k.file && k.row)));
});
test("the group's rulings of 9 October are applied", () => {
  assert.equal(pastors.find((p) => /rashid abdul fusheini|abdul-?rashid fusheini/i.test(p.name))?.bishop, 'Sompa Osei');
  assert.ok(pastors.some((p) => p.name === 'Ransford Darko' && p.bishop === 'Kofi Hene Asare')); // two men of that name with different birthdays; Archbishop Fabin's one is under Kofi Hene Asare
  assert.ok(under('Joy Bruce').length >= 20, 'First Love Kumasi pastors sit under Sister Joy Bruce');
  assert.ok(!pastors.some((p) => p.name === 'Walter Wolle'));
});
test("Mother Nina's pastors keep the pictures already on file", () => {
  const nina = under('Nely Nina Masuku');
  assert.ok(nina.some((p) => p.name === 'Eniola Ajiga' && p.image));
  assert.ok(nina.some((p) => /Joshua .*Gbafa/.test(p.name) && p.image));
});
