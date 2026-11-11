import data from './ministry-organisations.json' with { type: 'json' };

// The ministry's organisations as presented in the THREE.ORG documentary:
// church, outreach and para-church groups, each council listing the people in
// charge (leader: true) and its members.
export const ORGANISATIONS = data;
export const ORGANISATIONS_PATH = 'organisations';
export const ALL_ORGANISATIONS = data.groups.flatMap(group => group.organisations.map(organisation => ({ ...organisation, group })));
export const organisationBySlug = slug => ALL_ORGANISATIONS.find(o => o.slug === slug) || null;
export const groupBySlug = slug => data.groups.find(g => g.slug === slug) || null;
// Older addresses (one per category and per council) still open the one page,
// scrolled to that part of it.
// Addresses from earlier layouts open the page at the matching council.
export const PAGE_ALIASES = { 'kuriake-council': 'united-denominations', church: 'united-denominations', outreach: 'give-thyself-wholly-board' };
// Councils shown as subsections (the Para-Church councils) keep their addresses.
const SUBSECTIONS = ALL_ORGANISATIONS.flatMap(o => (o.directoryGroups || []).filter(g => g.slug && g.name).map(g => g.slug));
export const ORGANISATION_PAGES = [...ALL_ORGANISATIONS.filter(o => !o.untitled).map(o => o.slug), ...SUBSECTIONS, ...Object.keys(PAGE_ALIASES)];
export const subsectionBySlug = slug => ALL_ORGANISATIONS.flatMap(o => o.directoryGroups || []).find(g => g.slug === slug) || null;
// Office instruction, 9 Nov: under each council's leaders the site lists only
// the members who are bishops in the directory (bishop: true, set from the
// roster: titles Bishop, Mother and Episcopal Sister, never lay presidents).
// Everyone else named in the documentary stays in the data file, unshown.
// A council with parts (the Kuriake Council: First Love Church and UD-OLGC)
// shows its chairmen together, then all its bishops.
// Office, 9 Nov: no large chairman cards. Each council is one list, its
// chairmen first. bishopSectionOrder (Kuriake) lists each part in turn, its
// chairman then the bishops under him: Bishop Frank's UD-OLGC, then Bishop
// Joshua's First Love Church.
export const sectionsOf = organisation => {
  const parts = organisation.sections || [{ name: '', people: organisation.people }];
  const order = organisation.bishopSectionOrder;
  const ordered = order ? [...parts].sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name)) : parts;
  const list = part => [...part.people.filter(p => p.leader), ...part.people.filter(p => !p.leader && p.bishop)];
  // A council with parts gives each part its own rows, so Bishop Joshua's
  // list starts on a new line after Bishop Frank's.
  return order ? ordered.map(part => ({ name: part.name, people: list(part) })) : [{ name: '', people: ordered.flatMap(list) }];
};
export const leadersOf = organisation => sectionsOf(organisation).flatMap(section => section.leaders);

// Office, 9 Nov (contents page): one box per group, on both /organisations/
// and /councils/, in the office's order, each with its number of bishops. The
// Para-Church councils share one box, which opens all of them on one page,
// each council under its own heading.
const PARA_CHURCH = 'para-church';
const FIRST_LOVE = 'first-love-church';
// Office, 10 Nov: in the order the work began, Africa first. First Love
// Church and the Para-Church councils are one box each, opening all their
// groups on one page.
const ORDER = ['1965-committee', 'ud-senex-council', 'first-love-senex-council', 'adjutancy', 'emeritus',
  'ud-africa', 'ud-ghana-west', 'ud-ghana-east', 'ud-ghana-central', 'ud-europe', 'ud-north-america',
  'united-jesus', 'united-islands', 'eschatos', 'ursc', FIRST_LOVE, PARA_CHURCH];
// The initials these groups are known by, shown after a dash (office, 10 Nov).
const INITIALS = { 'ud-africa': 'UD AF', 'ud-ghana-west': 'UD GHW', 'ud-ghana-east': 'UD GHE', 'ud-ghana-central': 'UD GHC', 'ud-europe': 'UD EU', 'ud-north-america': 'UD NA', 'united-jesus': 'UJ', 'united-islands': 'UI', ursc: 'URSC', 'healing-jesus-council': 'HJC' };
// Office, 9 Nov: every box reads "The Bishops of …" (a council keeps its
// "the": "The Bishops of the Adjutancy"); Emeritus and Para-Church read
// "The Emeritus Bishops" and "The Para-Church Bishops".
const OWN_NAMES = { emeritus: 'The Emeritus Bishops' };
const formalName = (o, g) => OWN_NAMES[g.slug] || `The Bishops of ${g.name.replace(/^The /, 'the ')}`;
const bishopKey = p => p.rosterId || p.name;
const countOf = people => new Set(people.map(bishopKey)).size;
const groupsOfSection = o => o.directoryGroups?.length
  ? o.directoryGroups.filter(g => g.slug && g.name)
  : [{ slug: o.slug, name: o.name, people: sectionsOf(o).flatMap(s => s.people) }];
// Muted deep tones (office, 9 Nov), a different one for each box, all dark
// enough for white lettering and calm beside the gold edge.
const COLOURS = ['#1f3a5f', '#6b2737', '#2f5233', '#4a3f6b', '#1f5357', '#5a2846', '#3a3d42', '#7a5a2e', '#2e3566', '#5c3a2a', '#2c4a40', '#34495e', '#6a3045', '#3f4a2c', '#43365a', '#24505f', '#5a4632', '#2b4257', '#5e2f3c', '#35503f', '#4d3b5e', '#3b4f5a', '#664a2b'];
// On a council's page each card names the council (office, 10 Nov);
// chairpersons keep their role. Church groups, the 1965 Committee and the
// Emeritus Bishops still show each bishop's church.
const COUNCIL_LABEL = { 'ud-senex-council': 'UD Senex Council', 'first-love-senex-council': 'First Love Senex Council', adjutancy: 'Adjutancy',
  'healing-jesus-council': 'Healing Jesus', 'flow-council': 'FLOW', 'dhmm-council': 'DHMM', 'general-schools-board': 'General Schools Board',
  'general-hospitals-board': 'General Hospitals Board', 'general-orphanage-board': 'General Orphanage Board', 'radio-ministry': 'Radio Ministry',
  'construction-estate-management-board': 'Construction & Estate Management Board', 'abmtc-board': 'ABMTC Board', 'makarios-council': 'Makarios Council' };
const labelled = g => (COUNCIL_LABEL[g.slug] ? { ...g, people: g.people.map(p => ({ ...p, church: COUNCIL_LABEL[g.slug] })) } : g);
const ONE_BOX = { [PARA_CHURCH]: 'The Para-Church Bishops', [FIRST_LOVE]: 'The Bishops of First Love Movement' };
// "The Bishop of Kenya" when a group has one bishop (office, 10 Nov).
const singular = g => (g.people?.length && countOf(g.people) === 1 ? { ...g, name: g.name.replace(/^The Bishops of /, 'The Bishop of ') } : g);
const withInitials = g => singular(labelled({ ...g, initials: INITIALS[g.slug] || '' }));
// Office, 11 Nov: the United Reasonable Service Church opens a contents page
// too, one line per denomination its bishops belong to; each card keeps the
// bishop's own church.
const BY_CHURCH = new Set(['ursc']);
// "The Bishops of the Pacific Islands Missionary Church".
const WITH_THE = new Set(['Pacific Islands Missionary Church']);
const slugOf = text => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const byChurch = (g, o) => {
  const churches = [...new Set(g.people.map(p => p.church))];
  return churches.map(church => withInitials({ slug: `${g.slug}-${slugOf(church)}`, name: formalName(o, { name: WITH_THE.has(church) ? `The ${church}` : church }), people: g.people.filter(p => p.church === church) }));
};
// Office, 11 Nov: UD Africa opens a contents page of its countries, largest
// first, with larger lettering on the lines.
const BY_COUNTRY = new Set(['ud-africa']);
const byCountry = (g, o) => {
  const countries = [...new Set(g.people.map(p => p.country || 'Other'))];
  const size = c => g.people.filter(p => (p.country || 'Other') === c).length;
  // The chairman's country first (office, 11 Nov: Mozambique, Bishop Frank
  // Otchere), then the largest.
  const chairOf = c => g.people.some(p => (p.country || 'Other') === c && (p.leader || /chair/i.test(p.role || '')));
  countries.sort((a, b) => chairOf(b) - chairOf(a) || size(b) - size(a) || a.replace(/^The /, '').localeCompare(b.replace(/^The /, '')));
  return countries.map(country => withInitials({ slug: `${g.slug}-${slugOf(country.replace(/^The /, ''))}`, name: formalName(o, { name: country }), people: g.people.filter(p => (p.country || 'Other') === country) }));
};
const groups = ALL_ORGANISATIONS.filter(o => !o.untitled).flatMap(o => ONE_BOX[o.slug]
  ? [{ slug: o.slug, name: ONE_BOX[o.slug], section: o.slug, parts: groupsOfSection(o).filter(g => g.people.length).map(g => withInitials({ ...g, name: formalName(o, g) })), people: [], twoColumns: o.slug === FIRST_LOVE }]
  : groupsOfSection(o).map(g => BY_CHURCH.has(g.slug)
    ? { slug: g.slug, name: formalName(o, g), section: o.slug, parts: byChurch(g, o), people: [], all: g.people, flat: true }
    : BY_COUNTRY.has(g.slug)
      ? { slug: g.slug, name: formalName(o, g), section: o.slug, parts: byCountry(g, o), people: [], large: true }
      : { slug: g.slug, name: formalName(o, g), section: o.slug, people: g.people }))
  .map(withInitials);
export const DIRECTORY_GROUPS = ORDER.map(slug => groups.find(g => g.slug === slug))
  .filter(g => g && (g.people.length || g.parts?.length))
  .map((g, i) => ({ ...g, count: countOf(g.parts ? g.parts.flatMap(p => p.people) : g.people), colour: COLOURS[i % COLOURS.length],
    // Each council or country gets its own colour on the second contents page.
    parts: g.parts?.map((part, j) => ({ ...part, colour: COLOURS[(j * 5 + 3) % COLOURS.length] })) }));
// Every bishop on the page once, however many councils they sit on.
export const DIRECTORY_TOTAL = countOf(DIRECTORY_GROUPS.flatMap(g => g.parts ? g.parts.flatMap(p => p.people) : g.people));
// First Love's former groups became countries (office, 10 Nov); their old
// addresses open the country most of their bishops are in.
const FORMER = { 'only-jesus': 'first-love-center', 'jesus-first': 'qodesh-city-church', 'choose-jesus': 'first-love-uk', 'serve-jesus': 'erste-liebe-kirche-switzerland', 'jesus-now': 'first-love-church-belize', 'jesus-forever': 'mighty-foundations-ministries-new-york', 'king-jesus': FIRST_LOVE,
  // Office, 11 Nov: First Love Movement lines are churches, not countries.
  'first-love-ghana': 'first-love-center', 'first-love-united-kingdom': 'first-love-uk', 'first-love-democratic-republic-of-congo': 'centre-chretien-de-lamour-dr-congo',
  'first-love-madagascar': 'fiangonana-fahazavana-velona-madagascar', 'first-love-switzerland': 'erste-liebe-kirche-switzerland', 'first-love-belize': 'first-love-church-belize',
  'first-love-cameroon': 'eglise-du-premier-amour-cameroon', 'first-love-france': 'benediction-totale-france', 'first-love-zambia': 'overcomers-house-church-zambia',
  'first-love-australia': 'first-love-church-australia', 'first-love-botswana': 'love-christian-church-botswana', 'first-love-cote-divoire': 'la-belle-eglise-cote-divoire',
  'first-love-ethiopia': 'mikdash-church-international-ethiopia', 'first-love-germany': 'jesus-gefunden-germany', 'first-love-kenya': 'mountain-of-the-lords-house-kenya',
  'first-love-new-zealand': 'first-love-church-new-zealand', 'first-love-philippines': 'first-love-church-manila', 'first-love-sierra-leone': 'tell-them-church-sierra-leone',
  'first-love-tanzania': 'mountain-of-the-lords-house-tanzania', 'first-love-united-states': 'mighty-foundations-ministries-new-york',
  'first-love-zimbabwe': 'others-international-church-zimbabwe', 'first-love-church-new-york': 'mighty-foundations-ministries-new-york',
  // Office, 11 Nov: Eric Lamptey stays in UD Africa and Maxwell Agyei-Manu in Eschatos.
  'first-love-angola': 'ud-africa-angola', 'first-love-mauritius': 'eschatos' };
// A group's address, or one council's or country's (#flow-council,
// #first-love-ghana), opens it.
export const resolveGroupSlug = slug => FORMER[slug] || slug;
// Office, 11 Nov: a group split only for its contents page (URSC, UD Africa)
// opens as one list in its original order, chairman first, whichever line
// was chosen.
export const flatPeople = group => group.all;
export const directoryGroupBySlug = slug => { slug = resolveGroupSlug(slug); return DIRECTORY_GROUPS.find(g => g.slug === slug || g.parts?.some(p => p.slug === slug)) || null; };
