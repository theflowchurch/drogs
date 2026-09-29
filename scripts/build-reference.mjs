// Rebuilds src/registration/reference-people.json from the reconciled legacy
// rosters. Reference records are the office's existing information: they are
// not registrations and carry no account, payment or approval state.
import { writeFile } from 'node:fs/promises';
globalThis.window = globalThis;
await import('../data/bishops.js');
await import('../data/pastors.js');
const { BISHOPS, PASTORS } = globalThis;
const ORGANIZATION = { 'UD-OLGC': 'United Denominations', 'UO-FLC190': 'First Love' };
// Outreach rows carry their group: the FLOW office or the Healing Jesus Council.
const OUTREACH_GROUP = { 'FLOW Office': 'FLOW', 'Healing Jesus Council': 'HJC' };
// Spelling variants of one denomination.
const DENOMINATION_ALIAS = { 'QODESH FAMILY CHURCH': 'QODESH FAMILY CHURCHES',
  // No longer exist as denominations; their people keep their organization.
  'MORNING STAR CITY CHURCHES': '', 'MIRACLE MATRIX CHURCH': '', 'ENLARGEMENT MATRIX CHURCH': '', 'REASONABLE SERVICE': '' };
// One-off corrections to the source rows.
const REHOME = { ETHIOPIA: { organization: 'First Love', denomination: 'FIRST LOVE CHURCH', denominationLogo: 'assets/denominations/first-love-church.png' } };
// FLOW has no supplied logo yet.
const GROUP_LOGO = { HJC: 'assets/denominations/healing-jesus.webp' };
const clean = value => String(value ?? '').trim();
const skip = new Set(['', 'n/a', 'none', 'unknown', 'international']);
const keep = value => (skip.has(clean(value).toLowerCase()) ? '' : clean(value));
const person = (role, p) => ({
  id: `${role === 'bishop' ? 'B' : 'P'}${p.code}`,
  role,
  name: p.name,
  title: p.title || (role === 'bishop' ? 'Bishop' : 'Pastor'),
  organization: REHOME[keep(p.denomination)]?.organization || ORGANIZATION[p.organization] || OUTREACH_GROUP[clean(p.outreachGroup)] || '',
  // Outreach rows show their group (FLOW / HJC) where a denomination would appear.
  denomination: REHOME[keep(p.denomination)]?.denomination ?? (p.organization === 'OUTREACH' ? OUTREACH_GROUP[clean(p.outreachGroup)] || '' : (DENOMINATION_ALIAS[keep(p.denomination)] ?? keep(p.denomination))),
  denominationLogo: REHOME[keep(p.denomination)]?.denominationLogo ?? (p.organization === 'OUTREACH' ? GROUP_LOGO[OUTREACH_GROUP[clean(p.outreachGroup)]] || '' : (DENOMINATION_ALIAS[keep(p.denomination)] === '' ? '' : p.denominationLogo || '')),
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
