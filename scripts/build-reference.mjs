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
const DENOMINATION_ALIAS = { 'QODESH FAMILY CHURCH': 'QODESH FAMILY CHURCHES', 'SAVIOR OF MEN INTERNATIONAL': 'SAVIOURS OF MEN INTERNATIONAL',
  // No longer exist as denominations; their people keep their organization.
  'MORNING STAR CITY CHURCHES': '', 'MIRACLE MATRIX CHURCH': '', 'ENLARGEMENT MATRIX CHURCH': '', 'REASONABLE SERVICE': '' };
// One-off corrections to the source rows.
const REHOME = { ETHIOPIA: { organization: 'First Love', denomination: 'FIRST LOVE CHURCH', denominationLogo: 'assets/denominations/first-love-church.png' },
  'FIRST LOVE CHURCH WORLDWIDE': { organization: 'First Love', denomination: 'FIRST LOVE CHURCH', denominationLogo: 'assets/denominations/first-love-church.png' },
  'FIRST LOVE CHURCH': { organization: 'First Love', denomination: 'FIRST LOVE CHURCH', denominationLogo: 'assets/denominations/first-love-church.png' },
  // La Belle Eglise (Côte d'Ivoire) belongs to First Love; La Belle Eglise Gabon stays with UD Africa.
  'LA BELLE EGLISE': { organization: 'First Love', denomination: 'La Belle Eglise', denominationLogo: '' } };
// Pastors whose row has no denomination but whose branch says which church they serve.
const BRANCH_REHOME = { 'belle eglise kwashieman': { organization: 'First Love', denomination: 'La Belle Eglise', denominationLogo: '' } };
const COUNCIL_REHOME = { 'la belle eglise': { organization: 'First Love', denomination: 'La Belle Eglise', denominationLogo: '' } };
const byBranch = p => ((DENOMINATION_ALIAS[keep(p.denomination)] ?? keep(p.denomination)) ? undefined : BRANCH_REHOME[clean(p.branch).toLowerCase()] || COUNCIL_REHOME[clean(p.council || '').toLowerCase()]);
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
  organization: REHOME[keep(p.denomination)]?.organization || byBranch(p)?.organization || ORGANIZATION[p.organization] || OUTREACH_GROUP[clean(p.outreachGroup)] || '',
  // Outreach rows show their group (FLOW / HJC) where a denomination would appear.
  denomination: REHOME[keep(p.denomination)]?.denomination ?? byBranch(p)?.denomination ?? (p.organization === 'OUTREACH' ? GROUP_NAME[OUTREACH_GROUP[clean(p.outreachGroup)]] || '' : (DENOMINATION_ALIAS[keep(p.denomination)] ?? keep(p.denomination))),
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
const ALIAS = { 'other international': 'Others International Church', 'loyalty house internatioanal': 'Loyalty House International', 'everything by prayer church': 'Everything By Prayer Center', 'the glorious mega church': 'The Glorious Church', 'makarios church': 'The Makarios Church', 'primero amor': 'Premiero Amor', 'precious souls church eswatini': 'Precious Souls Swaziland', 'precious souls church namibia': 'Precious Souls Namibia', 'fruitiferos internationale': 'Fruitferos Internacional Guinea Bissau', 'poimen church gambia': 'Poimen Church Senegal-Gambia', 'poimen church senegal': 'Poimen Church Senegal-Gambia' };
const UNITED_CITIES_HEADING = h => isCountryHeading(h) || /^pacific islands missionary church/i.test(normalName(h));
const denominationFor = b => { if (!b.heading || UNITED_CITIES_HEADING(b.heading)) return b.organization === 'First Love' ? 'First Love Church' : b.organization === 'FLOW' ? 'FLOW' : b.heading ? 'United Cities' : ''; if (ALIAS[normalName(b.heading)]) return ALIAS[normalName(b.heading)]; const want = normalName(b.heading); const listed = (DENOMINATIONS[b.organization] || []).find(d => normalName(d) === want || normalName(d).startsWith(want) || want.startsWith(normalName(d))); return listed || titleCase(b.heading); };
const { DENOMINATIONS } = await import('../src/registration/denominations.mjs');
const added = [];
// Only UD – OLGC is organised in groups; First Love, FLOW and HJC list their denominations directly.
const groupFor = x => (x.organization === 'United Denominations' ? x.group : '');
// Eschatos is a group and a denomination at once: its bishops sit in different countries, all under the Eschatos denomination.
const SAME_AS_GROUP = new Set(['Eschatos']);
const GROUP_DENOMINATION_LOGO = { Eschatos: 'assets/denominations/eschatos-church.png' };
for (const b of flat) {
  const old = linked.get(b.name);
  if (old === null) continue; // duplicate line in the document
  // Only UD – OLGC is organised in groups; First Love, FLOW and HJC list their denominations directly.
  // The official list files FLOW and Healing Jesus Campaign bishops together under FLOW; the original data knows which is which, so that group never changes an organization.
  if (old) { if (b.organization !== 'FLOW' && old.organization !== b.organization) { old.denomination = ''; old.denominationLogo = ''; old.organization = b.organization; } old.group = groupFor(b); old.listedPastors = b.pastors ?? null; if (b.title && old.title === 'Bishop') old.title = b.title; if (!old.denomination || normalName(old.denomination) === 'united cities') { old.denomination = denominationFor(b); old.denominationLogo = ''; } if (SAME_AS_GROUP.has(old.group)) { old.denomination = old.group; old.denominationLogo = GROUP_DENOMINATION_LOGO[old.group] || ''; } continue; }
  const rec = { id: `BO${b.n}`, role: 'bishop', name: titleCase(b.name.replace(/\s+/g, ' ')), title: b.title || 'Bishop', organization: b.organization, denomination: denominationFor(b), denominationLogo: '', city: '', branch: '', country: headingCountry(b.heading || ''), image: officialPhotos[b.name] || '', email: '', phone: '', group: groupFor(b), listedPastors: b.pastors ?? null };
  if (SAME_AS_GROUP.has(rec.group)) { rec.denomination = rec.group; rec.denominationLogo = GROUP_DENOMINATION_LOGO[rec.group] || ''; }
  people.push(rec); added.push(rec);
}
// "United Cities" stays the denomination of its pastors, as the office's lists
// name it; a pastor whose bishop leads a country takes that country. African
// rows sit in UD Africa, Pacific ones in United Islands.
const UC_AFRICA = new Set(['central african republic', 'cape verde', 'guinea', 'burkina faso', 'lesotho', 'niger', 'chad', 'mali', 'sao tome and principe', 'gambia', 'equatorial guinea']);
const UC_PACIFIC = new Set(['australia', 'new zealand', 'solomon islands', 'papua new guinea', 'fiji', 'vanuatu', 'samoa', 'tonga']);
const UC_GROUPS = new Set(), ucSettled = new Set();
const bishopsAfter = people.filter(p => p.role === 'bishop');
for (const p of people) {
  if (normalName(p.denomination) !== 'united cities') continue;
  const c = normalName(p.country);
  const own = p.bishop ? bishopsAfter.find(b => normalName(b.name) === normalName(p.bishop)) || bishopsAfter.find(b => namesAlike(b.name, p.bishop)) : null;
  p.denomination = own?.denomination && normalName(own.denomination) !== 'united cities' ? own.denomination : 'United Cities';
  p.denominationLogo = '';
  if (own?.group) p.group = own.group; else if (UC_AFRICA.has(c)) p.group = 'UD Africa'; else if (UC_PACIFIC.has(c)) p.group = 'United Islands';
  if (p.group) { UC_GROUPS.add(p.group); ucSettled.add(p.id); }
}
// Group catalog for the office, generated from the same document. Each entry is
// spelled the way the sign-up list spells it: an exact or prefix match on the
// list, else the denomination the bishops under that heading already carry (so
// a country heading like "Guinea Conakry" becomes that country's church), else
// the heading itself.
const udList = DENOMINATIONS['United Denominations'] || [];
const canonical = (heading, group) => {
  const want = normalName(heading);
  if (ALIAS[want]) return ALIAS[want];
  const listed = udList.find(d => normalName(d) === want) || udList.find(d => normalName(d).startsWith(want) || want.startsWith(normalName(d)));
  if (listed) return listed;
  const carried = flat.filter(b => b.group === group && normalName(b.heading) === want).map(b => linked.get(b.name)).filter(Boolean).map(o => o.denomination).filter(Boolean);
  const byList = carried.map(c => udList.find(d => normalName(d) === normalName(c))).filter(Boolean);
  if (byList.length) return byList.sort((a, b) => byList.filter(x => x === b).length - byList.filter(x => x === a).length)[0];
  return titleCase(heading);
};
const GROUP_ENTRIES = Object.fromEntries(official.groups.filter(g => g.organization === 'United Denominations').map(g => [g.name, { organization: g.organization, denominations: SAME_AS_GROUP.has(g.name) ? [g.name] : [...new Set(g.denominations.map(d => d.name).filter(Boolean).map(h => canonical(h, g.name)))].filter(d => normalName(d) !== 'united cities') }]));
for (const g of UC_GROUPS) if (GROUP_ENTRIES[g] && !GROUP_ENTRIES[g].denominations.includes('United Cities')) GROUP_ENTRIES[g].denominations.push('United Cities');
// Pastors take their bishop's group; otherwise the group of their denomination.
const bishopsNow = people.filter(p => p.role === 'bishop');
const byNorm = new Map(bishopsNow.map(p => [normalName(p.name), p]));
const groupByDenomination = new Map(official.groups.filter(g => g.organization === 'United Denominations').flatMap(g => g.denominations.map(d => [normalName(d.name), g.name])));
for (const [g, v] of Object.entries(GROUP_ENTRIES)) for (const d of v.denominations) groupByDenomination.set(normalName(d), g);
for (const p of people) {
  if (p.role !== 'pastor') continue;
  if (ucSettled.has(p.id)) continue; // settled above
  const own = byNorm.get(normalName(p.bishop || '')) || (p.bishop ? bishopsNow.find(b => namesAlike(b.name, p.bishop)) : null);
  p.group = p.organization !== 'United Denominations' ? '' : own?.group || groupByDenomination.get(normalName(p.denomination)) || [...groupByDenomination].find(([k]) => k && normalName(p.denomination).startsWith(k))?.[1] || '';
  if (SAME_AS_GROUP.has(p.group)) { p.denomination = p.group; p.denominationLogo = GROUP_DENOMINATION_LOGO[p.group] || ''; }
}
await writeFile(new URL('../data/reports/official-list-reconciliation.json', import.meta.url), JSON.stringify({
  retired: retired.map(p => ({ id: p.id, name: p.name, organization: p.organization, denomination: p.denomination, country: p.country, pastorsInOriginalData: people.filter(q => q.role === 'pastor' && q.bishop && normalName(q.bishop) === normalName(p.name)).length })),
  added: added.map(p => ({ id: p.id, name: p.name, group: p.group, organization: p.organization, denomination: p.denomination, country: p.country, listedPastors: p.listedPastors })),
  handResolved: Object.entries(manual).filter(([, v]) => v).map(([official, id]) => ({ official, id, oldName: oldBishops.find(p => p.id === id)?.name })),
  notBishops: official.notBishops,
}, null, 1) + '\n');
console.log(`Official list: ${flat.length} entries · ${linked.size - [...linked.values()].filter(v => v === null).length} matched · ${added.length} added · ${retired.length} retired from the original data: ${retired.map(p => p.name).join(', ')}`);
// Default denomination logos: the artwork the old records already carry, keyed by the sign-up list's spelling.
const LOGO_MAP = {};
for (const d of Object.values(DENOMINATIONS).flat()) { const hit = people.find(p => p.denominationLogo && normalName(p.denomination) === normalName(d)) || people.find(p => p.denominationLogo && (normalName(p.denomination).startsWith(normalName(d)) || normalName(d).startsWith(normalName(p.denomination)))); if (hit) LOGO_MAP[d] = hit.denominationLogo; }
await writeFile(new URL('../src/registration/logos.mjs', import.meta.url), `// Generated by scripts/build-reference.mjs from the old records' artwork. Do not edit by hand.\nexport const LOGOS = ${JSON.stringify(LOGO_MAP, null, 2)};\n`);
await writeFile(new URL('../src/registration/groups.mjs', import.meta.url), `// Generated by scripts/build-reference.mjs from data/official-bishops.json. Do not edit by hand.\nexport const GROUPS = ${JSON.stringify(GROUP_ENTRIES, null, 2)};\n`);
if (new Set(people.map(p => p.id)).size !== people.length) throw Error('Reference identifiers must be unique.');
// Self-check: the encoding repair must leave every name clean and starting with a letter.
const broken = people.filter(p => /[√‚]/.test(p.name) || !/^\p{L}/u.test(p.name));
if (broken.length) throw Error(`Garbled names remain: ${broken.map(p => p.name).join(', ')}`);
// Contact details never reach the browser: the public bundle gets the roster
// without them; the server merges them back from data/reference-contacts.json.
const contacts = Object.fromEntries(people.filter(p => p.email || p.phone).map(p => [p.id, { email: p.email || '', phone: p.phone || '' }]));
await writeFile(new URL('../data/reference-contacts.json', import.meta.url), JSON.stringify(contacts) + '\n');
await writeFile(new URL('../src/registration/reference-people.json', import.meta.url), JSON.stringify(people.map(({ email, phone, ...rest }) => rest)) + '\n');
console.log(`${people.length} reference records (${people.filter(p => p.role === 'bishop').length} bishops, ${people.filter(p => p.role === 'pastor').length} pastors).`);
