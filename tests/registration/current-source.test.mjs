import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { publishedPortraits } from '../../scripts/lib/published-portraits.mjs';
import { placeOf } from '../../src/registration/model.mjs';
import { PHOTO_REVIEW, ORIGINALLY_MISSING } from '../../src/registration/photo-review-baseline.mjs';
import { CURRENT_REFERENCE_MERGES } from '../../src/registration/reference-merges.mjs';
const read = f => JSON.parse(readFileSync(f, 'utf8'));

test('the asset index contains exactly current audited people and no old profile fields', () => {
  const people = read('src/registration/reference-people.json'), assets = read('data/submitted-roster-assets.json');
  const index = [...assets.bishops, ...assets.pastors];
  assert.deepEqual(index.map(p => p.id).sort(), people.map(p => p.id).sort());
  const allowed = new Set(['id', 'name', 'bishop', 'image', 'submittedName']);
  for (const p of index) assert.ok(Object.keys(p).every(k => allowed.has(k)));
  assert.ok(!index.some(p => ['P3860', 'P3468'].includes(p.id)));
  for (const file of ['data/roll-continuity.json', 'data/not-pastors.json', 'data/verified-years.json', 'data/official-bishops.json', 'data/reports/official-list-reconciliation.json'])
    assert.equal(existsSync(file), false, file);
});
test('only latest audited submissions and current photo/contact metadata remain', () => {
  const people = read('src/registration/reference-people.json'), ids = new Set(people.map(p => p.id));
  const sheets = read('data/bishop-submissions.json'), audit = read('data/reports/roll-build.json');
  const sourceKeys = new Set(audit.reconcile.map(r => `${r.folder}/${r.file}`));
  assert.equal(sheets.length, 286);
  assert.ok(sheets.every(s => sourceKeys.has(`${s.folder}/${s.file}`)));
  for (const file of ['reference-contacts', 'photo-approved', 'photo-quality', 'photo-sources', 'photo-manual-flags'])
    assert.ok(Object.keys(read(`data/${file}.json`)).every(id => ids.has(id)), file);
  assert.ok(Object.keys(PHOTO_REVIEW).every(id => ids.has(id)));
  assert.ok(ORIGINALLY_MISSING.every(id => ids.has(id) || CURRENT_REFERENCE_MERGES.some(m => m.from === id && ids.has(m.to))), 'the permanent missing-photo baseline keeps documented merged IDs so removals do not count as uploads');
  assert.ok(people.filter(p => p.role === 'bishop').every(p => placeOf(p)), 'every bishop has a supplied place, branch or documented oversight area');
});
test('published portraits follow current image paths, even when filenames have older IDs', () => {
  const files = publishedPortraits([{ id: 'S1', image: 'assets/portraits/P123.webp' }]);
  assert.deepEqual(files, ['assets/portraits/P123.webp', 'assets/portraits/thumbs/P123.webp']);
  assert.ok(!files.includes('assets/portraits/P3860.webp'));
  assert.throws(() => publishedPortraits([{ id: 'private', image: 'data/roll-continuity.json' }]), /Invalid published/);
  assert.throws(() => publishedPortraits([{ id: 'private', image: 'assets/portraits/../../secret.json' }]), /Invalid published/);
});
test('locations never substitute a guessed capital or an unknown-location placeholder', () => {
  assert.equal(placeOf({ country: 'United Kingdom' }), 'United Kingdom');
  assert.equal(placeOf({ branch: 'Hamburg' }), 'Branch · Hamburg');
  assert.equal(placeOf({ oversightArea: 'Canada / United States' }), 'Oversight · Canada / United States');
  assert.equal(placeOf({ city: 'Kumasi', country: 'Ghana' }), 'Kumasi, Ghana');
});
