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

// Office, 9 Nov (contents page): every group in page order, one coloured box
// each, on both /organisations/ and /councils/. A bishop listed under Change of
// Status appears there only, never in any other group.
const CHANGE_OF_STATUS = 'change-of-status';
const sameBishop = (a, b) => (a.rosterId && a.rosterId === b.rosterId) || a.name === b.name;
const statusChanged = (organisationBySlug(CHANGE_OF_STATUS)?.people || []).filter(p => p.bishop || p.leader);
const groupsOfSection = o => o.directoryGroups?.length
  ? o.directoryGroups.filter(g => g.slug && g.name)
  : [{ slug: o.slug, name: o.name, tabName: o.tabName, people: sectionsOf(o).flatMap(s => s.people) }];
// Each box its own colour: hues spread by the golden angle so neighbouring
// boxes never look alike, dark enough for white lettering.
const colourOf = i => `hsl(${Math.round((222 + i * 137.508) % 360)} ${i % 2 ? 62 : 52}% ${i % 3 === 1 ? 27 : 31}%)`;
export const DIRECTORY_GROUPS = (() => {
  const list = ALL_ORGANISATIONS.filter(o => !o.untitled).flatMap(o => groupsOfSection(o).map(g => ({
    slug: g.slug, name: g.name, tabName: g.tabName, section: o.slug,
    people: o.slug === CHANGE_OF_STATUS ? g.people : g.people.filter(p => !statusChanged.some(c => sameBishop(c, p))),
  }))).filter(g => g.people.length);
  // Office, 9 Nov: the First Love groups sit at the very end of the contents for now.
  const last = g => g.section === 'first-love-church';
  list.sort((a, b) => last(a) - last(b));
  return list.map((g, i) => ({ ...g, colour: colourOf(i) }));
})();
export const directoryGroupBySlug = slug => DIRECTORY_GROUPS.find(g => g.slug === slug) || null;
