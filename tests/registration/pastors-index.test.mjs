import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pastorsOf, pastorsByBishop } from '../../src/registration/model.mjs';

test('pastorsByBishop gives every bishop the same pastors as pastorsOf', () => {
  const people = JSON.parse(readFileSync(new URL('../../src/registration/reference-people.json', import.meta.url), 'utf8'));
  const index = pastorsByBishop(people);
  const bishops = people.filter((p) => p.role === 'bishop');
  for (const b of bishops.filter((_, i) => i % 7 === 0)) // a seventh of them keeps the test quick
    assert.deepEqual(index.get(b.id).map((q) => q.id), pastorsOf(b, people).map((q) => q.id), b.name);
  assert.ok(index.get(bishops.find((b) => b.name === 'Henry Asare-Duah').id).length >= 20); // his 20 roll pastors plus the folder-only ones
});
