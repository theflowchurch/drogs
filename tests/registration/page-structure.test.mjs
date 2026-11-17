import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyState, applyAction, visibleState } from '../../src/registration/model.mjs';
import { buildDirectory } from '../../src/registration/ministry-organisations.mjs';
import { pastorGroups } from '../../src/registration/public-entries.mjs';

const office = { id: 'office', email: 'office@example.com', office: true };
const published = JSON.parse(readFileSync('src/registration/ministry-organisations.json', 'utf8'));
const groups = st => st.groups.flatMap(g => g.organisations).flatMap(o => o.directoryGroups || []);

test('the office edits the Order of Bishops: rename, role, move a bishop, and every page reads it', () => {
  const st = structuredClone(published);
  const [a, b] = groups(st).filter(g => g.people.length > 1);
  a.name = 'Renamed Group';
  a.people[0].role = 'Chairman';
  const moved = a.people.pop();
  b.people.push(moved);
  st.layout = { initials: { [a.slug]: 'RG' } };
  let state = applyAction(emptyState(), office, 'setPageStructure', { structure: st });
  assert.equal(visibleState(state, office, []).pageStructure.groups.length, st.groups.length);
  const built = buildDirectory(state.pageStructure).groups;
  const ga = built.find(g => g.slug === a.slug), gb = built.find(g => g.slug === b.slug);
  assert.ok(ga && gb);
  const names = g => [...(g.people || []), ...(g.parts || []).flatMap(x => x.people || [])].map(p => p.name);
  if (ga !== gb) { assert.ok(!names(ga).includes(moved.name) || a.people.some(p => p.name === moved.name)); assert.ok(names(gb).includes(moved.name)); }
  assert.equal(ga.initials, 'RG');
  assert.throws(() => applyAction(state, { id: 'x', email: 'x@example.com' }, 'setPageStructure', { structure: null }));
  state = applyAction(state, office, 'setPageStructure', { pastorBoxes: { names: { A: 'Box A' }, merge: { B: 'A', C: 'C' }, order: ['A'] } });
  assert.ok(state.pageStructure, 'saving the pastors’ boxes leaves the bishops’ page alone');
  assert.deepEqual(state.pastorBoxes.merge, { B: 'A' });
  const boxes = pastorGroups([{ denomination: 'B', name: 'x' }, { denomination: 'A', name: 'y' }, { denomination: 'Z', name: 'z' }], ['#000'], state.pastorBoxes);
  assert.deepEqual(boxes.map(g => [g.denomination, g.name, g.people.length]), [['A', 'Box A', 2], ['Z', 'The Pastors of Z', 1]]);
  state = applyAction(state, office, 'setPageStructure', { structure: null });
  assert.equal(state.pageStructure, null);
  assert.throws(() => applyAction(state, office, 'setPageStructure', { structure: { groups: [{ organisations: [{ directoryGroups: [{ slug: 'x', name: '', people: [] }] }] }] } }), /needs a name/);
});
