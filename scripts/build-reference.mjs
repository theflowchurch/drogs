// Rebuilds src/registration/reference-people.json from the reconciled legacy
// rosters. Reference records are the office's existing information: they are
// not registrations and carry no account, payment or approval state.
import { writeFile, readFile, mkdir } from 'node:fs/promises';
globalThis.window = globalThis;
await import('../data/bishops.js');
await import('../data/pastors.js');
const { BISHOPS, PASTORS } = globalThis;
const ORGANIZATION = { 'UD-OLGC': 'United Denominations', 'UO-FLC190': 'First Love' };
// Outreach rows carry their group: the FLOW office or the Healing Jesus Council.
const OUTREACH_GROUP = { 'FLOW Office': 'FLOW', 'Healing Jesus Council': 'HJC', Outreach: 'FLOW' /* Gifty Krofuah, confirmed by the office */ };
// What the roll prints where a denomination would be, for groups that have none.
const GROUP_NAME = { FLOW: 'FLOW', HJC: 'Healing Jesus Campaign', DHMM: 'DHMM' };
// Spelling variants of one denomination.
const DENOMINATION_ALIAS = { 'QODESH FAMILY CHURCH': 'QODESH FAMILY CHURCHES',
  // No longer exist as denominations; their people keep their organization.
  'MORNING STAR CITY CHURCHES': '', 'MIRACLE MATRIX CHURCH': '', 'ENLARGEMENT MATRIX CHURCH': '', 'REASONABLE SERVICE': '' };
// One-off corrections to the source rows.
const REHOME = { ETHIOPIA: { organization: 'First Love', denomination: 'FIRST LOVE CHURCH', denominationLogo: 'assets/denominations/first-love-church.png' } };
// FLOW has no supplied logo yet.
const GROUP_LOGO = { HJC: 'assets/brand/hjc-logo.png', FLOW: 'assets/brand/flow-logo.png', DHMM: 'assets/brand/dhmm-logo-black.png' };
// Some legacy names were saved as UTF-8 bytes read back as Mac Roman
// ("Mois√âs" for "Moisés"). Reverse that, and drop leading symbols nothing can recover.
const MAC_ROMAN = "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»…\xa0ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ\uf8ffÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ";
const fixEncoding = text => {
  if (!/[√‚]/.test(text)) return text;
  try {
    const bytes = Uint8Array.from([...text], ch => { const i = MAC_ROMAN.indexOf(ch); return i >= 0 ? 128 + i : ch.charCodeAt(0); });
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch { /* not Mac Roman after all: leave it */ }
  // Drop a leading symbol nothing can recover; then title-case each part of a
  // name (all-caps ASCII words such as denominations are left alone).
  return text
    .replace(/^[^\p{L}]+/u, '')
    .replace(/[\p{L}'’]+/gu, w => (/^[A-Z'’]+$/.test(w) && w.length > 1 ? w : w[0].toUpperCase() + w.slice(1).toLowerCase()));
};
const clean = value => fixEncoding(String(value ?? '').trim());
const skip = new Set(['', 'n/a', 'none', 'unknown', 'international']);
const keep = value => (skip.has(clean(value).toLowerCase()) ? '' : clean(value));
const person = (role, p) => ({
  id: `${role === 'bishop' ? 'B' : 'P'}${p.code}`,
  role,
  name: clean(p.name),
  title: p.title || (role === 'bishop' ? 'Bishop' : 'Pastor'),
  organization: REHOME[keep(p.denomination)]?.organization || ORGANIZATION[p.organization] || OUTREACH_GROUP[clean(p.outreachGroup)] || '',
  // Outreach rows show their group (FLOW / HJC) where a denomination would appear.
  denomination: REHOME[keep(p.denomination)]?.denomination ?? (p.organization === 'OUTREACH' ? GROUP_NAME[OUTREACH_GROUP[clean(p.outreachGroup)]] || '' : (DENOMINATION_ALIAS[keep(p.denomination)] ?? keep(p.denomination))),
  denominationLogo: REHOME[keep(p.denomination)]?.denominationLogo ?? (p.organization === 'OUTREACH' ? GROUP_LOGO[OUTREACH_GROUP[clean(p.outreachGroup)]] || '' : (DENOMINATION_ALIAS[keep(p.denomination)] === '' ? '' : p.denominationLogo || '')),
  city: keep(p.city),
  branch: keep(p.branch),
  country: keep(p.region),
  image: p.image || '',
  email: keep(p.email).toLowerCase(),
  phone: keep(p.mobile || p.whatsapp),
  ...(role === 'pastor' && keep(p.supervisingBishop) ? { bishop: keep(p.supervisingBishop) } : {}),
});
// Office corrections by name: people who belong to FLOW whatever the old roster said.
const MOVE_TO_FLOW = new Set(['natalie welds']);
// FLOW is an online fellowship: everyone in it is listed as Online, Ghana.
const flow = p => (MOVE_TO_FLOW.has(p.name.toLowerCase()) || p.organization === 'FLOW')
  ? { ...p, organization: 'FLOW', denomination: 'FLOW', denominationLogo: GROUP_LOGO.FLOW, city: 'Online', country: 'Ghana', branch: '' }
  : p;
let people = [...BISHOPS.map(p => person('bishop', p)), ...PASTORS.map(p => person('pastor', p))].map(flow);
// ---- The official DHMM bishops list (data/official-bishops.json, from the office's
// document) is the truth about who is a bishop. Every bishop on it is matched to
// the old roster by name (exact, then alike, then the hand-resolved map); bishops
// on the old roster who are not on the list are retired from the original data;
// bishops on the list with no old record are added. Everyone gets a group.
const { namesAlike, normalName } = await import('../src/registration/model.mjs');
const official = JSON.parse(await readFile(new URL('../data/official-bishops.json', import.meta.url), 'utf8'));
const manual = JSON.parse(await readFile(new URL('../data/official-matches.json', import.meta.url), 'utf8')).matches;
const officialPhotos = JSON.parse(await readFile(new URL('../data/official-photos.json', import.meta.url), 'utf8')).photos;
const { COUNTRY_CURRENCY, countryKey } = await import('../src/registration/exchange.mjs');
const COUNTRY_FIX = { columbia: 'Colombia', 'guinea conakry': 'Guinea', 'papau new guinea': 'Papua New Guinea', 'congo brazaville': 'Congo', 'equatorial guinea malabo': 'Equatorial Guinea', 'equatorial guinea bata': 'Equatorial Guinea', 'gabon libreville': 'Gabon', 'gabon port gentil': 'Gabon', 'precious souls church namibia': 'Namibia', 'precious souls church eswatini': 'Eswatini', 'poimen church senegal': 'Senegal', 'poimen church gambia': 'Gambia', 'pacific islands missionary church fiji': 'Fiji', 'pacific islands missionary church solomon islands': 'Solomon Islands', 'pacific islands missionary church vanuatu': 'Vanuatu', 'cape verde': 'Cape Verde' };
const titleCase = t => t.replace(/[\p{L}'’]+/gu, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
const headingCountry = h => { const k = normalName(h).replace(/\s+/g, ' '); if (COUNTRY_FIX[k]) return COUNTRY_FIX[k]; return COUNTRY_CURRENCY[countryKey(h)] ? titleCase(h) : ''; };
const isCountryHeading = h => Boolean(headingCountry(h)) && !/church|chapel|assembl|international|ministr|mission/i.test(h);
const flat = official.groups.flatMap(g => g.denominations.flatMap(d => d.bishops.map(b => ({ ...b, group: g.name, organization: g.organization, heading: d.name }))));
const oldBishops = people.filter(p => p.role === 'bishop');
const taken = new Set(), linked = new Map(); // official name -> old record
for (const b of flat) if (b.name in manual) { if (manual[b.name]) { linked.set(b.name, oldBishops.find(p => p.id === manual[b.name])); taken.add(manual[b.name]); } else linked.set(b.name, null); }
for (const b of flat) if (!linked.has(b.name)) { const hit = oldBishops.find(p => !taken.has(p.id) && normalName(p.name) === normalName(b.name)); if (hit) { linked.set(b.name, hit); taken.add(hit.id); } }
for (const b of flat) if (!linked.has(b.name)) { const hits = oldBishops.filter(p => !taken.has(p.id) && namesAlike(p.name, b.name)); if (hits.length === 1) { linked.set(b.name, hits[0]); taken.add(hits[0].id); } }
const retired = oldBishops.filter(p => !taken.has(p.id));
const retiredNames = new Set(retired.map(p => normalName(p.name)));
people = people.filter(p => p.role !== 'bishop' || taken.has(p.id));
const denominationFor = b => { if (!b.heading || isCountryHeading(b.heading)) return b.organization === 'First Love' ? 'First Love Church' : b.organization === 'FLOW' ? 'FLOW' : ''; const want = normalName(b.heading); const listed = (DENOMINATIONS[b.organization] || []).find(d => normalName(d) === want || normalName(d).startsWith(want) || want.startsWith(normalName(d))); return listed || titleCase(b.heading); };
const { DENOMINATIONS } = await import('../src/registration/denominations.mjs');
const added = [];
for (const b of flat) {
  const old = linked.get(b.name);
  if (old === null) continue; // duplicate line in the document
  if (old) { old.group = b.group; old.listedPastors = b.pastors ?? null; if (b.title && old.title === 'Bishop') old.title = b.title; continue; }
  const rec = { id: `BO${b.n}`, role: 'bishop', name: titleCase(b.name.replace(/\s+/g, ' ')), title: b.title || 'Bishop', organization: b.organization, denomination: denominationFor(b), denominationLogo: '', city: '', branch: '', country: headingCountry(b.heading || ''), image: officialPhotos[b.name] || '', email: '', phone: '', group: b.group, listedPastors: b.pastors ?? null };
  people.push(rec); added.push(rec);
}
// Pastors take their bishop's group; otherwise the group of their denomination.
const bishopsNow = people.filter(p => p.role === 'bishop');
const byNorm = new Map(bishopsNow.map(p => [normalName(p.name), p]));
const groupByDenomination = new Map(official.groups.flatMap(g => g.denominations.map(d => [normalName(d.name), g.name])));
for (const p of people) {
  if (p.role !== 'pastor') continue;
  const own = byNorm.get(normalName(p.bishop || '')) || (p.bishop ? bishopsNow.find(b => namesAlike(b.name, p.bishop)) : null);
  p.group = own?.group || groupByDenomination.get(normalName(p.denomination)) || [...groupByDenomination].find(([k]) => k && normalName(p.denomination).startsWith(k))?.[1] || (p.organization === 'First Love' ? 'First Love' : ['FLOW', 'HJC'].includes(p.organization) ? 'FLOW & Healing Jesus Campaign' : '');
}
await writeFile(new URL('../data/reports/official-list-reconciliation.json', import.meta.url), JSON.stringify({
  retired: retired.map(p => ({ id: p.id, name: p.name, organization: p.organization, denomination: p.denomination, country: p.country, pastorsInOriginalData: people.filter(q => q.role === 'pastor' && q.bishop && normalName(q.bishop) === normalName(p.name)).length })),
  added: added.map(p => ({ id: p.id, name: p.name, group: p.group, organization: p.organization, denomination: p.denomination, country: p.country, listedPastors: p.listedPastors })),
  handResolved: Object.entries(manual).filter(([, v]) => v).map(([official, id]) => ({ official, id, oldName: oldBishops.find(p => p.id === id)?.name })),
  notBishops: official.notBishops,
}, null, 1) + '\n');
console.log(`Official list: ${flat.length} entries · ${linked.size - [...linked.values()].filter(v => v === null).length} matched · ${added.length} added · ${retired.length} retired from the original data: ${retired.map(p => p.name).join(', ')}`);
// Group catalog for the office, generated from the same document.
await writeFile(new URL('../src/registration/groups.mjs', import.meta.url), `// Generated by scripts/build-reference.mjs from data/official-bishops.json. Do not edit by hand.\nexport const GROUPS = ${JSON.stringify(Object.fromEntries(official.groups.map(g => [g.name, { organization: g.organization, denominations: g.denominations.map(d => d.name).filter(Boolean) }])), null, 2)};\n`);
if (new Set(people.map(p => p.id)).size !== people.length) throw Error('Reference identifiers must be unique.');
// Self-check: the encoding repair must leave every name clean and starting with a letter.
const broken = people.filter(p => /[√‚]/.test(p.name) || !/^\p{L}/u.test(p.name));
if (broken.length) throw Error(`Garbled names remain: ${broken.map(p => p.name).join(', ')}`);
await writeFile(new URL('../src/registration/reference-people.json', import.meta.url), JSON.stringify(people) + '\n');
console.log(`${people.length} reference records (${people.filter(p => p.role === 'bishop').length} bishops, ${people.filter(p => p.role === 'pastor').length} pastors).`);
