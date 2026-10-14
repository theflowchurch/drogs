import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState } from '../../src/registration/model.mjs';
import { readState, persistState } from '../../src/server/database.mjs';
import { assignedPortrait } from '../../src/server/storage.mjs';

test('members may retain the portrait assigned by the office but cannot borrow another member\'s photo', () => {
  const state = { ...emptyState(), registrations: [{ userId: 'member', year: 2027, data: { photo: 'office/portrait/assigned.webp' } }] };
  assert.equal(assignedPortrait(state, { id: 'member' }, 'office/portrait/assigned.webp'), true);
  assert.equal(assignedPortrait(state, { id: 'stranger' }, 'office/portrait/assigned.webp'), false);
  assert.equal(assignedPortrait(state, { id: 'member' }, 'someone-else/portrait/new.webp'), false);
  assert.equal(assignedPortrait({ ...state, year: 2028 }, { id: 'member' }, 'office/portrait/assigned.webp'), false);
});

test('photo review versions and office field ownership round-trip through the server state store', async () => {
  let saved = '{}';
  const conn = {
    async query(sql) {
      if (sql.includes('dr_settings')) return [[{ current_year: 2027 }]];
      if (sql.includes('dr_state')) return [[{ data: saved }]];
      return [[]];
    },
    async execute(sql, values) {
      assert.match(sql, /^UPDATE dr_state SET data=/);
      saved = values[0];
    },
  };
  const before = emptyState(), after = { ...before,
    overrides: { P1: { name: 'Corrected Person', city: 'Tema', _officeFields: ['name', 'city'] } },
    photoReviews: { P1: { photo: 'upload:office/portrait/current.webp', status: 'replace', codes: ['STRETCH'] } },
  };
  await persistState(conn, before, after);
  const reloaded = await readState(conn);
  assert.deepEqual(reloaded.overrides, after.overrides);
  assert.deepEqual(reloaded.photoReviews, after.photoReviews);
});
