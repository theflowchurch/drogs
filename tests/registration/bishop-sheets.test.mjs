import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// A bishop's submitted sheet is the whole truth for that bishop: exactly the people on it, where it says they are.
const people = JSON.parse(readFileSync(new URL('../../src/registration/reference-people.json', import.meta.url), 'utf8'));
const subs = JSON.parse(readFileSync(new URL('../../data/bishop-submissions.json', import.meta.url), 'utf8'));
const under = (name) => people.filter((p) => p.role === 'pastor' && p.bishop === name);

test('David Adjah Ashong has the 13 pastors on his sheet, nobody else', () => {
  const sheet = subs.find((s) => s.bishop === 'David Adjah Ashong');
  assert.equal(sheet.pastors.length, 13);
  assert.equal(under('David Adjah Ashong').length, 13);
});
test("Daniel Odei-Siaw's pastors are in Hanoi, Vietnam as his sheet says", () => {
  const list = under('Daniel Odei-Siaw');
  assert.equal(list.length, 2);
  for (const p of list) assert.equal(`${p.city}, ${p.country}`, 'Hanoi, Vietnam');
});
test('a pastor under no bishop is unclaimed and carries a reason', () => {
  for (const p of people.filter((p) => p.role === 'pastor')) assert.equal(Boolean(p.unclaimed), !p.bishop, p.name);
  assert.ok(people.some((p) => p.unclaimed && p.unclaimed.includes("David Adjah Ashong")));
});
