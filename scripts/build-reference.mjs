// Rebuilds src/registration/reference-people.json from the reconciled legacy
// rosters. Reference records are the office's existing information: they are
// not registrations and carry no account, payment or approval state.
import { writeFile } from 'node:fs/promises';
globalThis.window = globalThis;
await import('../data/bishops.js');
await import('../data/pastors.js');
const { BISHOPS, PASTORS } = globalThis;
const ORGANIZATION = { 'UD-OLGC': 'United Denominations', 'UO-FLC190': 'First Love', OUTREACH: 'Outreach' };
const clean = value => String(value ?? '').trim();
const skip = new Set(['', 'n/a', 'none', 'unknown', 'international']);
const keep = value => (skip.has(clean(value).toLowerCase()) ? '' : clean(value));
const person = (role, p) => ({
  id: `${role === 'bishop' ? 'B' : 'P'}${p.code}`,
  role,
  name: p.name,
  title: p.title || (role === 'bishop' ? 'Bishop' : 'Pastor'),
  organization: ORGANIZATION[p.organization] || p.organization,
  denomination: keep(p.denomination),
  denominationLogo: p.denominationLogo || '',
  city: keep(p.city),
  branch: keep(p.branch),
  country: keep(p.region),
  image: p.image || '',
  email: keep(p.email).toLowerCase(),
  phone: keep(p.mobile || p.whatsapp),
  ...(role === 'pastor' && keep(p.supervisingBishop) ? { bishop: keep(p.supervisingBishop) } : {}),
});
const people = [...BISHOPS.map(p => person('bishop', p)), ...PASTORS.map(p => person('pastor', p))];
if (new Set(people.map(p => p.id)).size !== people.length) throw Error('Reference identifiers must be unique.');
await writeFile(new URL('../src/registration/reference-people.json', import.meta.url), JSON.stringify(people) + '\n');
console.log(`${people.length} reference records (${BISHOPS.length} bishops, ${PASTORS.length} pastors).`);
