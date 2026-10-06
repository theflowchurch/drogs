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
  gender: keep(p.gender).toLowerCase(),
  yearAppointed: keep(p.yearAppointed), yearOrdained: keep(p.yearOrdained), yearConsecrated: role === 'bishop' ? keep(p.yearConsecrated) : '',
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
const titleCase = t => t.replace(/[\p{L}'’]+/gu, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
const { DENOMINATIONS } = await import('../src/registration/denominations.mjs');
const { namesAlike, normalName } = await import('../src/registration/model.mjs');
let people = [...BISHOPS.map(p => person('bishop', p)), ...PASTORS.map(p => person('pastor', p))].map(flow);
// ---- The office's 2026 pastors export (data/pastors-sheet-2026.json): who oversees whom, current
// city and country, years appointed and ordained, and the title (Rev., Lady Rev.). Existing pastors
// are matched by name; rows the original data never had become new pastor records (PS…).
const sheet = JSON.parse(await readFile(new URL('../data/pastors-sheet-2026.json', import.meta.url), 'utf8')).rows;
const stripTitle = t => String(t || '').replace(/^\s*(bishop|reverend|revd|rev|apostle|episcopal sister|sister|pastor|mother|dr|bs)\.?\s+/i, '').replace(/^\s*(bishop|reverend|rev|apostle|sister|pastor|dr)\.?\s+/i, '').trim();
const bishopNames = people.filter(p => p.role === 'bishop').map(p => p.name);
// Spellings in the sheet that differ from the official list.
const BISHOP_ALIAS = { 'kwabena asamoa': 'Kwabena Asare Asamoa', 'nii nortey quist therson': 'James Quist-Therson', 'mawusi adagbe': 'Mawusi Adabge', 'alex gottlieb kofi opata': 'Alexander Gottlieb Kofi-Opata', 'phillippa marka coker': 'Phillippa-Marka Coker', 'akwele ivanna kiruja': 'Akwele Ivanna Kiruja', 'rebecca joana addae': 'Rebecca-Joana Addae', 'leonora jamie hyde': 'Leonora Hyde', 'albert toss mills odoi': 'Toss Mills Odoi', 'olivia kofi opata': 'Olivia-anna Kofi-opata', 'joy phillipe bruce': 'Joy Bruce', 'michael amoh': 'Michael Amoh', 'romeo sossou': 'Romeo Sosu' };
const resolveBishop = raw => { const want = titleCase(stripTitle(raw)); if (!want) return ''; const al = BISHOP_ALIAS[normalName(want.replace(/-/g, ' '))]; if (al) return bishopNames.find(n => normalName(n) === normalName(al)) || al; const exact = bishopNames.find(n => normalName(n) === normalName(want)); if (exact) return exact; const alike = bishopNames.filter(n => namesAlike(n, want)); return alike.length === 1 ? alike[0] : want; };
const sheetTitle = r => r.statusRank === 'REVEREND' ? (r.gender === 'FEMALE' ? 'Lady Rev.' : 'Rev.') : r.statusRank === 'APOSTLE' ? 'Apostle' : 'Pastor';
const pastorsByName = new Map(); for (const p of people) if (p.role === 'pastor') { const k = normalName(p.name); if (!pastorsByName.has(k)) pastorsByName.set(k, []); pastorsByName.get(k).push(p); }
const allPastors = people.filter(p => p.role === 'pastor');
const sheetStats = { matched: 0, added: 0, bishopsSkipped: 0, ambiguous: 0 };
let newId = 1;
for (const row of sheet) { let r = row;
  if (/BISHOP|EPISCOPAL/.test(r.statusRank)) {
    // Bishops come from the official list; the sheet fills in years and a missing city or country.
    sheetStats.bishopsSkipped++;
    const bn = titleCase(fixEncoding(r.fullName).replace(/\s+/g, ' '));
    const b = people.find(p => p.role === 'bishop' && normalName(p.name) === normalName(bn)) || (() => { const a = people.filter(p => p.role === 'bishop' && namesAlike(p.name, bn)); return a.length === 1 ? a[0] : null; })();
    if (b) { if (!b.yearAppointed) b.yearAppointed = r.yearAppointed; if (!b.yearOrdained) b.yearOrdained = r.yearOrdained; if (!b.yearConsecrated) b.yearConsecrated = r.yearConsecrated; if (!b.city && r.city && !/^n\/?a$/i.test(r.city)) b.city = titleCase(fixEncoding(r.city)); if (!b.country && r.country) b.country = titleCase(r.country); if (!b.gender) b.gender = r.gender.toLowerCase(); }
    continue;
  }
  const name = titleCase(fixEncoding(r.fullName).replace(/\s+/g, ' ').replace(/(?<=[A-Za-z])0|0(?=[A-Za-z])/g, 'O'));
  let hit = (pastorsByName.get(normalName(name)) || [])[0];
  if (!hit) { const alike = allPastors.filter(p => namesAlike(p.name, name) && (!r.country || !p.country || normalName(p.country) === normalName(r.country))); if (alike.length === 1) hit = alike[0]; else if (alike.length > 1) sheetStats.ambiguous++; }
  const fields = { bishop: resolveBishop(r.bishopInCharge), city: r.city && !/^n\/?a$/i.test(r.city) ? titleCase(fixEncoding(r.city)) : '', country: r.country ? titleCase(r.country) : '', yearAppointed: r.yearAppointed, yearOrdained: r.yearOrdained, title: sheetTitle(r), gender: r.gender.toLowerCase(), branch: r.branch && !/^n\/?a$/i.test(r.branch) ? titleCase(fixEncoding(r.branch)) : '' };
  if (!hit) {
    const tokens = (n) => normalName(n).split(' ').filter(Boolean).sort().join(' ');
    const asBishop = people.find(p => p.role === 'bishop' && tokens(p.name) === tokens(name) && (!p.country || !r.country || normalName(p.country) === normalName(r.country)));
    if (asBishop) { sheetStats.bishopsSkipped++; if (!asBishop.yearAppointed) asBishop.yearAppointed = r.yearAppointed; if (!asBishop.yearOrdained) asBishop.yearOrdained = r.yearOrdained; if (!asBishop.city && fields.city) asBishop.city = fields.city; if (!asBishop.country && fields.country) asBishop.country = fields.country; if (!asBishop.gender && fields.gender) asBishop.gender = fields.gender; continue; }
  }
  if (hit) { sheetStats.matched++; if (fields.bishop) hit.bishop = fields.bishop; if (fields.city) hit.city = fields.city; if (fields.country) hit.country = fields.country; if (fields.branch) hit.branch = fields.branch; if (fields.yearAppointed) hit.yearAppointed = fields.yearAppointed; if (fields.yearOrdained) hit.yearOrdained = fields.yearOrdained; if (fields.gender) hit.gender = fields.gender; hit.title = fields.title; continue; }
  // New to us: a pastor record from what the sheet knows (no contact details).
  if (/^first love church( worldwide)?$/i.test(r.denomination)) r = { ...r, denomination: 'First Love Church' };
  const den = r.denomination ? (DENOMINATIONS['First Love'].find(d => normalName(d) === normalName(r.denomination)) || (DENOMINATIONS['United Denominations'] || []).find(d => normalName(d) === normalName(r.denomination)) || titleCase(r.denomination)) : '';
  const organization = DENOMINATIONS['First Love'].some(d => normalName(d) === normalName(den)) || /first love/i.test(r.denomination) ? 'First Love' : 'United Denominations';
  const rec = { id: `PS${newId++}`, role: 'pastor', name, title: fields.title, organization, denomination: den, denominationLogo: '', city: fields.city, branch: fields.branch, country: fields.country, image: '', gender: fields.gender, yearAppointed: fields.yearAppointed, yearOrdained: fields.yearOrdained, yearConsecrated: '', email: '', phone: '', ...(fields.bishop ? { bishop: fields.bishop } : {}) };
  people.push(rec); allPastors.push(rec); pastorsByName.set(normalName(name), [rec]); sheetStats.added++;
}
// Hand corrections the office confirmed (data/pastor-fixes.json: name → fields).
const fixes = JSON.parse(await readFile(new URL('../data/pastor-fixes.json', import.meta.url), 'utf8').catch(() => '{}'));
for (const [who, f] of Object.entries(fixes)) for (const p of people) if (p.role === 'pastor' && normalName(p.name) === normalName(who)) Object.assign(p, Object.fromEntries(Object.entries(f).filter(([k]) => k !== 'note')));
// The original data's "supervising bishop" text goes through the same spelling fixes.
for (const p of people) if (p.role === 'pastor' && p.bishop) p.bishop = resolveBishop(p.bishop) || p.bishop;
// The office's photo folders (one folder per bishop) are the current word on who is
// under whom; the old roster and the export named the previous bishop for a thousand
// pastors (e.g. Kenneth Agyei for Dennis Agyei-Gyan's). data/folder-bishops.json is
// written by scripts/audit-bishops.mjs from /tmp/photo-index.json.
const folderBishops = JSON.parse(await readFile(new URL('../data/folder-bishops.json', import.meta.url), 'utf8').catch(() => '{}'));
let moved = 0;
for (const p of people) if (p.role === 'pastor' && folderBishops[p.id] && normalName(p.bishop || '') !== normalName(folderBishops[p.id])) { p.bishop = folderBishops[p.id]; moved++; }
console.log(`Photo folders: ${moved} pastors placed under the bishop whose folder holds their photo`);
console.log(`2026 sheet: ${sheet.length} rows · ${sheetStats.matched} matched existing pastors · ${sheetStats.added} new pastors added · ${sheetStats.bishopsSkipped} bishop rows left to the official list · ${sheetStats.ambiguous} ambiguous names skipped`);
// ---- The official DHMM bishops list (data/official-bishops.json, from the office's
// document) is the truth about who is a bishop. Every bishop on it is matched to
// the old roster by name (exact, then alike, then the hand-resolved map); bishops
// on the old roster who are not on the list are retired from the original data;
// bishops on the list with no old record are added. Everyone gets a group.
const official = JSON.parse(await readFile(new URL('../data/official-bishops.json', import.meta.url), 'utf8'));
const manual = JSON.parse(await readFile(new URL('../data/official-matches.json', import.meta.url), 'utf8')).matches;
const officialPhotos = JSON.parse(await readFile(new URL('../data/official-photos.json', import.meta.url), 'utf8')).photos;
const { COUNTRY_CURRENCY, countryKey } = await import('../src/registration/exchange.mjs');
const COUNTRY_FIX = { columbia: 'Colombia', 'guinea conakry': 'Guinea', 'papau new guinea': 'Papua New Guinea', 'congo brazaville': 'Congo', 'equatorial guinea malabo': 'Equatorial Guinea', 'equatorial guinea bata': 'Equatorial Guinea', 'gabon libreville': 'Gabon', 'gabon port gentil': 'Gabon', 'precious souls church namibia': 'Namibia', 'precious souls church eswatini': 'Eswatini', 'poimen church senegal': 'Senegal', 'poimen church gambia': 'Gambia', 'pacific islands missionary church fiji': 'Fiji', 'pacific islands missionary church solomon islands': 'Solomon Islands', 'pacific islands missionary church vanuatu': 'Vanuatu', 'cape verde': 'Cape Verde' };
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
// Pastors who exist only as a photo in a bishop's office folder (data/folder-new-pastors.json,
// written by scripts/audit-bishops.mjs): added under that bishop with the bishop's organization,
// denomination, group and country. Title and gender come from the file prefix (Rev / LP).
// Their photos are picked up by scripts/import-photos.mjs by name on the next run.
const folderNew = JSON.parse(await readFile(new URL('../data/folder-new-pastors.json', import.meta.url), 'utf8').catch(() => '[]'));
const bishopById = new Map(people.filter(p => p.role === 'bishop').map(b => [b.id, b]));
let addedFromFolders = 0;
folderNew.forEach((n, i) => {
  const b = bishopById.get(n.bishopId);
  if (n.drop || !b || people.some(p => p.role === 'pastor' && namesAlike(p.name, n.name))) return; // `drop`: not a person (e.g. a church building's photo)
  people.push({ id: `PF${i + 1}`, role: 'pastor', name: n.name, title: n.title || 'Pastor', organization: b.organization, denomination: b.denomination, denominationLogo: b.denominationLogo || '', city: '', branch: '', country: b.country || '', image: '', gender: n.gender || '', yearAppointed: '', yearOrdained: '', yearConsecrated: '', bishop: b.name, group: b.group || '', source: 'photo folder' });
  addedFromFolders++;
});
console.log(`Photo folders: ${addedFromFolders} pastors added who were only in a bishop's folder`);
// Duplicate records, applied once every record (official-list bishops included) exists (scripts/find-duplicates.mjs → data/duplicate-removals.json): the kept record inherits anything it lacks.
const dupes = JSON.parse(await readFile(new URL('../data/duplicate-removals.json', import.meta.url), 'utf8').catch(() => '{"removals":[]}')).removals;
const dropIds = new Set();
for (const d of dupes) { const drop = people.find(p => p.id === d.id), keep = people.find(p => p.id === d.keep); if (!drop || !keep) continue; for (const k of ['image', 'city', 'country', 'yearAppointed', 'yearOrdained', 'bishop', 'branch', 'gender']) if (!keep[k] && drop[k] && !(k === 'bishop' && keep.role === 'bishop')) keep[k] = drop[k]; dropIds.add(d.id); }
people = people.filter(p => !dropIds.has(p.id));
// Years the office verified through its Google Form (scripts/verified-years.mjs → data/verified-years.json)
// overwrite whatever the old roster and export said; what did not match is reported for the office.
const verified = JSON.parse(await readFile(new URL('../data/verified-years.json', import.meta.url), 'utf8').catch(() => '[]'));
const vreport = { matched: 0, unmatched: [], rankDiffers: [], changed: [], kept: [] };
const sameCountry = (p, c) => !c || !p.country || normalName(p.country) === normalName(c) || normalName(c).startsWith(normalName(p.country));
for (const v of verified) {
  const wantRole = v.rank === 'bishop' || v.rank === 'mother' ? 'bishop' : 'pastor';
  const n = titleCase(stripTitle(v.name));
  const pick = (list) => list.find(p => normalName(p.name) === normalName(n)) || (() => { let a = list.filter(p => namesAlike(p.name, n)); if (a.length > 1) a = a.filter(p => sameCountry(p, v.country)); return a.length === 1 ? a[0] : null; })();
  const hit = pick(people.filter(p => p.role === wantRole)) || pick(people.filter(p => p.role !== wantRole));
  if (!hit) { vreport.unmatched.push(v); continue; }
  vreport.matched++;
  const isRev = /Rev/.test(hit.title);
  const rankDiffers = (wantRole === 'bishop') !== (hit.role === 'bishop') || (v.rank === 'reverend') !== isRev;
  if (rankDiffers) vreport.rankDiffers.push({ ...v, record: hit.name, recordTitle: hit.title, recordRole: hit.role });
  if (rankDiffers && hit.role === 'pastor' && wantRole === 'pastor') hit.title = hit.gender === 'female' ? 'Lady Rev.' : 'Rev.'; // Pastor on one side, Reverend on the other: Reverend for now (Joshua, 6 Oct 2026)
  for (const k of ['yearAppointed', 'yearOrdained', 'yearConsecrated']) {
    if (!v[k] || (k === 'yearConsecrated' && hit.role !== 'bishop')) continue;
    if (hit[k] && hit[k] !== v[k]) { if (rankDiffers) { vreport.kept.push({ name: hit.name, field: k, record: hit[k], form: v[k], formRank: v.rank, recordTitle: hit.title }); continue; } vreport.changed.push({ name: hit.name, field: k, was: hit[k], now: v[k] }); } // a different rank and a different year is likely a namesake
    hit[k] = v[k];
  }
}
await writeFile(new URL('../data/reports/verified-years.json', import.meta.url), JSON.stringify(vreport, null, 1) + '\n');
console.log(`Verified years: ${vreport.matched} of ${verified.length} matched · ${vreport.changed.length} years corrected · ${vreport.unmatched.length} names not found · ${vreport.rankDiffers.length} ranks differ from our record · ${vreport.kept.length} conflicting years kept for the office to settle`);
// Portraits imported from the office's photo folders (scripts/import-photos.mjs writes data/photo-assignments.json).
const assigned = JSON.parse(await readFile(new URL('../data/photo-assignments.json', import.meta.url), 'utf8').catch(() => '{}'));
for (const p of people) if (assigned[p.id] && (p.role === 'pastor' || !p.image)) p.image = assigned[p.id];
// There is no "Catch The Anointing Centre" (Joshua, 4 Oct 2026): anyone filed under it
// takes their bishop's denomination (Yalleh → Jesus Is The Rock, Asamoah → Anagkazo).
const GONE_DENOMINATIONS = new Set(['catch the anointing centre']);
const bishopDenomination = new Map(people.filter(p => p.role === 'bishop' && !GONE_DENOMINATIONS.has(normalName(p.denomination))).map(b => [normalName(b.name), b.denomination]));
const commonest = (list) => [...list.reduce((m, d) => m.set(d, (m.get(d) || 0) + 1), new Map())].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
for (const p of people) if (GONE_DENOMINATIONS.has(normalName(p.denomination)))
  p.denomination = p.role === 'pastor'
    ? bishopDenomination.get(normalName(p.bishop || '')) || ''
    : commonest(people.filter(q => q.role === 'pastor' && normalName(q.bishop || '') === normalName(p.name) && q.denomination && !GONE_DENOMINATIONS.has(normalName(q.denomination))).map(q => q.denomination)); // a bishop takes what their pastors are filed under
await writeFile(new URL('../src/registration/reference-people.json', import.meta.url), JSON.stringify(people.map(({ email, phone, ...rest }) => rest)) + '\n');
console.log(`${people.length} reference records (${people.filter(p => p.role === 'bishop').length} bishops, ${people.filter(p => p.role === 'pastor').length} pastors).`);
