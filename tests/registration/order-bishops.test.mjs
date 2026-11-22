import test from 'node:test';
import assert from 'node:assert/strict';
import { orderEntries, pastorEntries } from '../../src/registration/public-entries.mjs';
// Office, 22 Nov: the Order of Pastors lists each church's bishops, head first, then its pastors.
test('Order of Pastors: head, then bishops, then pastors; the register keeps pastors only', () => {
  const people = [
    { id: 'p1', role: 'pastor', title: 'Pastor', name: 'Aaron Able', denomination: 'First Love Church', bishop: 'Ben Zed' },
    { id: 'b1', role: 'bishop', title: 'Bishop', name: 'Ben Zed', denomination: 'First Love Church' },
    { id: 'b2', role: 'bishop', title: 'Bishop', name: 'Joshua Heward-Mills', denomination: 'First Love Church' },
    { id: 'b3', role: 'bishop', title: 'Bishop', name: 'Jeffrey Kwame Ocran', denomination: 'Fruitiferos Internationale' },
    { id: 'p2', role: 'pastor', title: 'Pastor', name: 'Ann Bee', denomination: 'Fruitferos Internacional Guinea Bissau' },
  ];
  const order = orderEntries(people);
  assert.deepEqual(order.filter(p => p.denomination === 'First Love Church').map(p => p.rosterId), ['b2', 'b1', 'p1']);
  // a bishop whose own church has no box joins the church the office lists them as leading
  assert.equal(order.find(p => p.rosterId === 'b3').denomination, 'Fruitferos Internacional Guinea Bissau');
  assert.deepEqual(pastorEntries(people).map(p => p.rosterId).sort(), ['p1', 'p2']);
});
test('church pages list the head bishop first', async () => {
  const { ministerSections } = await import('../../src/registration/denomination-sites.mjs');
  const people = [{ role: 'bishop', name: 'Aaron Able' }, { role: 'bishop', name: 'Frank Tawiah-Amissah' }, { role: 'bishop', name: 'Ben Brown' }];
  assert.deepEqual(ministerSections(people).bishops.map(p => p.name), ['Frank Tawiah-Amissah', 'Aaron Able', 'Ben Brown']);
});
