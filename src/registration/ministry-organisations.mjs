import data from './ministry-organisations.json' with { type: 'json' };

// The ministry's organisations as presented in the THREE.ORG documentary:
// church, outreach and para-church groups, each organisation listing the
// people in charge (leader: true) and its members.
export const ORGANISATIONS = data;
export const ORGANISATIONS_PATH = 'organisations';
export const ALL_ORGANISATIONS = data.groups.flatMap(group => group.organisations.map(organisation => ({ ...organisation, group })));
export const organisationBySlug = slug => ALL_ORGANISATIONS.find(o => o.slug === slug) || null;
// Office instruction, 9 Nov: the site shows only the people in charge of each
// organisation, not the members under them. The members stay in the data
// file so they can be shown again by setting SHOW_MEMBERS to true.
export const SHOW_MEMBERS = false;
export const sectionsOf = organisation => (organisation.sections || [{ name: '', people: organisation.people }])
  .map(section => ({ ...section, people: SHOW_MEMBERS ? section.people : section.people.filter(p => p.leader) }));
export const peopleOf = organisation => sectionsOf(organisation).flatMap(section => section.people);
export const plainName = value => value.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^dr\.?\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();
// The same person can serve on several bodies, named slightly differently
// (with or without "Dr." or a middle name); the roster record joins them.
export const personKey = person => person.rosterId || plainName(person.name);
export function serviceIndex() {
  const map = new Map();
  for (const organisation of ALL_ORGANISATIONS) for (const person of peopleOf(organisation)) {
    const key = personKey(person);
    if (!map.has(key)) map.set(key, []);
    if (!map.get(key).some(s => s.organisation.slug === organisation.slug)) map.get(key).push({ organisation, person });
  }
  return map;
}
