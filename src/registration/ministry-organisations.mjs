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
const ORDER = ['1965-committee', 'ud-senex-council', 'adjutancy', 'emeritus', 'ursc', 'eschatos', 'united-jesus', 'united-islands',
  'ud-africa', 'ud-ghana-west', 'ud-ghana-east', 'ud-ghana-central', 'ud-europe', 'ud-north-america', PARA_CHURCH,
  'only-jesus', 'jesus-first', 'serve-jesus', 'choose-jesus', 'jesus-now', 'jesus-forever', 'king-jesus', 'first-love-senex-council'];
// Church groups read "The Bishops of …"; councils and committees keep their own names.
const FORMAL = new Set(['united-denominations', 'first-love-church']);
const formalName = (o, g) => FORMAL.has(o.slug) || g.slug === 'ursc' ? `The Bishops of ${g.name}` : g.name;
const bishopKey = p => p.rosterId || p.name;
const countOf = people => new Set(people.map(bishopKey)).size;
const groupsOfSection = o => o.directoryGroups?.length
  ? o.directoryGroups.filter(g => g.slug && g.name)
  : [{ slug: o.slug, name: o.name, people: sectionsOf(o).flatMap(s => s.people) }];
// Muted deep tones (office, 9 Nov), a different one for each box, all dark
// enough for white lettering and calm beside the gold edge.
const COLOURS = ['#1f3a5f', '#6b2737', '#2f5233', '#4a3f6b', '#1f5357', '#5a2846', '#3a3d42', '#7a5a2e', '#2e3566', '#5c3a2a', '#2c4a40', '#34495e', '#6a3045', '#3f4a2c', '#43365a', '#24505f', '#5a4632', '#2b4257', '#5e2f3c', '#35503f', '#4d3b5e', '#3b4f5a', '#664a2b'];
const groups = ALL_ORGANISATIONS.filter(o => !o.untitled).flatMap(o => o.slug === PARA_CHURCH
  ? [{ slug: PARA_CHURCH, name: 'Para-Church Bishops', section: o.slug, parts: groupsOfSection(o).filter(g => g.people.length), people: [] }]
  : groupsOfSection(o).map(g => ({ slug: g.slug, name: formalName(o, g), section: o.slug, people: g.people })));
export const DIRECTORY_GROUPS = ORDER.map(slug => groups.find(g => g.slug === slug))
  .filter(g => g && (g.people.length || g.parts?.length))
  .map((g, i) => ({ ...g, count: countOf(g.parts ? g.parts.flatMap(p => p.people) : g.people), colour: COLOURS[i % COLOURS.length] }));
// Every bishop on the page once, however many councils they sit on.
export const DIRECTORY_TOTAL = countOf(DIRECTORY_GROUPS.flatMap(g => g.parts ? g.parts.flatMap(p => p.people) : g.people));
// A group's address, or one Para-Church council's (#flow-council), opens it.
export const directoryGroupBySlug = slug => DIRECTORY_GROUPS.find(g => g.slug === slug || g.parts?.some(p => p.slug === slug)) || null;
