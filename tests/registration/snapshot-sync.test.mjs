import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotSync, changedFields } from '../../src/registration/snapshot-sync.mjs';
test('a read started before a save cannot replace the saved state', async () => {
  const pending = [], shown = [];
  const sync = snapshotSync(() => new Promise(resolve => pending.push(resolve)), data => shown.push(data));
  const old = sync.refresh('office');
  sync.invalidate();
  const saved = sync.refresh('office');
  pending[1]({ name: 'Corrected', missing: 320 }); await saved;
  pending[0]({ name: 'Old', missing: 321 }); await old;
  assert.deepEqual(shown, [{ name: 'Corrected', missing: 320 }]);
});
test('only changed form fields are saved, so another upload or correction is not overwritten', () => {
  const opened = { name: 'Current Name', city: 'Accra', phone: '123' };
  assert.deepEqual(changedFields(opened, { ...opened, city: 'Tema' }), { city: 'Tema' });
  assert.deepEqual(changedFields(opened, { ...opened, phone: '' }), { phone: '' });
});
