import test from 'node:test';
import assert from 'node:assert/strict';
import { continuityAssets, nonPastoralRank, newerSubmission, submittedBirthKeys } from '../../scripts/lib/submitted-sheet-authority.mjs';

test('continuity cannot supply old profile data, ranks, groups, years or contacts', () => {
  const old = { id: 'B1', name: 'Identity match', image: 'portrait.webp', bishop: 'Identity link', organization: 'Old group',
    title: 'Old rank', city: 'Old city', country: 'Old country', gender: 'female', yearAppointed: '1990', phone: 'Old number', email: 'old@example.invalid' };
  const data = continuityAssets({ bishops: [old], pastors: [old] });
  for (const record of [...data.bishops, ...data.pastors]) assert.deepEqual(Object.keys(record).sort(), ['bishop', 'id', 'image', 'name']);
});

test('latest submission wins even when inputs are out of date order', () => {
  const latest = { folder: 'Bishop submitted sheets (13 Oct 2026)', file: 'Latest.xlsx' };
  const older = { folder: 'Bishop submitted sheets (9 Oct 2026)', file: 'Older.xlsx' };
  assert.equal(newerSubmission(latest, older), latest);
  assert.equal(newerSubmission(older, latest), latest);
});

test('ranks are judged from the current row rather than an old exclusion by name', () => {
  assert.equal(nonPastoralRank({ name: 'Francisca Boateng', rawRank: 'Lady Pastor' }), false);
  assert.equal(nonPastoralRank({ name: 'Isaac Bonuedi', rawRank: 'Pastor' }), false);
  for (const rawRank of ['Minister Shepherd', 'MINISTER SHEPHERD', 'MS', 'Elder', 'Shepherd']) assert.equal(nonPastoralRank({ rawRank }), true);
});

test('ISO birthdays match day/month and named-month spellings without invalid keys', () => {
  assert.deepEqual(submittedBirthKeys('2000-09-05'), ['5-9-00']);
  assert.ok(submittedBirthKeys('05/09/2000').includes(submittedBirthKeys('2000-09-05')[0]));
  assert.deepEqual(submittedBirthKeys('5 September 2000'), ['5-9-00']);
  assert.deepEqual(submittedBirthKeys('not supplied'), []);
  assert.deepEqual(submittedBirthKeys('2000-42-99'), []);
});
