import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIRECTORY_GROUPS, ORGANISATIONS } from '../../src/registration/ministry-organisations.mjs';
import { applyOrderChoices, orderGroupOptions, orderGroupsOf, cleanOrderGroups } from '../../src/registration/order-choices.mjs';

const where = (groups, id) => groups.flatMap(g => [...(g.parts || []).flatMap(p => p.people.filter(x => x.rosterId === id).map(x => [p.slug, x.role || ''])), ...(g.parts ? [] : (g.all || g.people).filter(x => x.rosterId === id).map(x => [g.slug, x.role || '']))]);

test('the choices offered are the Order groups, and a listed bishop starts from where they are', () => {
  const names = orderGroupOptions(ORGANISATIONS).flatMap(s => s.options.map(o => o.slug));
  for (const s of ['ud-ghana-west', 'adjutancy', 'first-love-center', 'flow-council', 'emeritus', 'affiliated-denomination-bishops']) assert.ok(names.includes(s), s);
  assert.deepEqual(orderGroupsOf(ORGANISATIONS, 'B41').map(c => c.slug).sort(), ['adjutancy', 'radio-ministry', 'ud-ghana-central'].sort());
  assert.equal(orderGroupsOf(ORGANISATIONS, 'B41').find(c => c.slug === 'adjutancy').role, 'Chairman & Ceremonial Archbishop');
  assert.deepEqual(cleanOrderGroups([{ slug: 'adjutancy', role: ' Chair ' }, { slug: 'adjutancy' }, { slug: 'Bad Slug!' }]), [{ slug: 'adjutancy', role: 'Chair' }]);
});

test('a bishop stands exactly in the groups they chose, with their roles; a newcomer joins too', () => {
  const groups = structuredClone(DIRECTORY_GROUPS);
  applyOrderChoices(groups, {
    B41: [{ slug: 'ud-ghana-central', role: '' }, { slug: 'flow-council', role: 'Treasurer' }],
    'u:new': [{ slug: 'ud-africa', role: '' }, { slug: 'ud-senex-council', role: '' }],
  }, id => id === 'u:new' ? { rosterId: 'u:new', name: 'New Bishop', title: 'Bishop', church: 'Precious Souls Church', country: 'Namibia' } : null);
  assert.deepEqual(where(groups, 'B41').sort(), [['flow-council', 'Treasurer'], ['ud-ghana-central', '']].sort(), 'left the Adjutancy and Radio Ministry, joined the FLOW Council');
  assert.deepEqual(where(groups, 'u:new').map(x => x[0]).sort(), ['ud-africa-namibia', 'ud-senex-council'], 'UD Africa by their own country');
  const council = groups.find(g => g.slug === 'ud-senex-council');
  assert.equal(council.people.find(p => p.rosterId === 'u:new').church, 'UD Senex Council', 'a council card names the council');
});
