import test from 'node:test';
import assert from 'node:assert/strict';
import { structureConflicts } from '../../src/registration/model.mjs';
const catalog = { organizations: ['United Denominations'], denominations: { 'United Denominations': ['The Mega Church', 'Qodesh City Churches'] }, groups: { 'UD Ghana': { organization: 'United Denominations', denominations: ['The Mega Church'] }, 'UD Africa': { organization: 'United Denominations', denominations: ['Qodesh City Churches'] } }, logos: {} };
const bishop = { id: 'B1', role: 'bishop', name: 'Dennis Agyei-Gyan', organization: 'United Denominations', denomination: 'THE MEGA CHURCH', group: 'UD Ghana' };
test('a pastor filed under a bishop from another group is a conflict; a matching one is not', () => {
  const ok = { id: 'P1', role: 'pastor', name: 'Abel Pratt', organization: 'United Denominations', denomination: 'THE MEGA CHURCH', bishop: 'Dennis Agyei-Gyan' };
  const odd = { id: 'P2', role: 'pastor', name: 'Natasha Agyei-Gyan', organization: 'United Denominations', denomination: 'QODESH CITY CHURCHES', bishop: 'Dennis Agyei-Gyan' };
  const out = structureConflicts(catalog, [bishop, ok, odd]);
  assert.deepEqual(out.map((c) => [c.id, c.kind]), [['P2', 'pastor-bishop-group']]);
  assert.match(out[0].message, /UD Africa.*UD Ghana/);
});
test('a bishop whose record group disagrees with the structure, and an unknown denomination, are conflicts', () => {
  const out = structureConflicts(catalog, [{ ...bishop, group: 'UD Africa' }, { id: 'P3', role: 'pastor', name: 'X Y', organization: 'United Denominations', denomination: 'CATCH THE ANOINTING CENTRE', bishop: '' }]);
  assert.deepEqual(out.map((c) => c.kind).sort(), ['bishop-group', 'unknown-denomination']);
});
