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
export const ORGANISATION_PAGES = [...data.groups.filter(g => !g.untitled).map(g => g.slug), ...ALL_ORGANISATIONS.filter(o => !o.untitled).map(o => o.slug)];
// Office instruction, 9 Nov: under each council's leaders the site lists only
// the members who are bishops in the directory (bishop: true, set from the
// roster: titles Bishop, Mother and Episcopal Sister, never lay presidents).
// Everyone else named in the documentary stays in the data file, unshown.
// A council with parts (the Kuriake Council: First Love Church and UD-OLGC)
// shows its chairmen together, then all its bishops.
export const sectionsOf = organisation => {
  const people = (organisation.sections || [{ people: organisation.people }]).flatMap(section => section.people);
  return [{ name: '', leaders: people.filter(p => p.leader), bishops: people.filter(p => !p.leader && p.bishop) }];
};
export const leadersOf = organisation => sectionsOf(organisation).flatMap(section => section.leaders);
