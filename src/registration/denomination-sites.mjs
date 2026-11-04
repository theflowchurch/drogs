import { normalName, overlayReferences, isLay, bySurname, byMinisterTitle, titleFor } from './model.mjs';
import { publicRosterFrom } from './live-roster.mjs';
import denominationCatalog from './denomination-catalog.json' with { type: 'json' };

export const DENOMINATION_SITES = {
  ...Object.fromEntries(denominationCatalog.map(({ path, ...site }) => [path, site])),
  lighthousechapelinternational: {
    homeConcept: 2,
    name: 'Lighthouse Chapel International', shortName: 'Lighthouse Chapel', subtitle: 'International',
    denominations: ['Lighthouse Chapel International'], logo: 'assets/denominations/lighthouse-chapel.webp', accent: '#786133', directoryAction: 'Explore our ministers', directoryHeading: 'Find a minister',
  },
  pleasantsurprise: {
    homeConcept: 1,
    name: 'Pleasant Surprise Church International', shortName: 'Pleasant Surprise', subtitle: 'Church International',
    denominations: ['Pleasant Surprise', 'Pleasant Surprise Church International'], logo: 'assets/denominations/pleasant-surprise-cleaned.webp', accent: '#49305b', directoryAction: 'Meet our bishops & pastors', directoryHeading: 'Meet our ministers.',
  },
  gochurch: {
    homeConcept: 2,
    name: 'Go Church', shortName: 'Go Church', subtitle: '',
    denominations: ['Go Church'], logo: 'assets/denominations/go-church-cleaned.webp', accent: '#292b28', directoryAction: 'Find a licensed minister', directoryHeading: 'Our people.',
  },
};
export const denominationSite = key => DENOMINATION_SITES[key] || null;
// Scope the saved, current public fields; never infer a church from somebody's
// name, country, or a similar-looking denomination (Go Ye and Lighthouse City
// remain distinct). The main site and office continue to see the whole roster.
export function denominationPeople(snapshot, site, fallback = []) {
  const config = denominationSite(site);
  if (!config) return [];
  const names = new Set(config.denominations.map(normalName));
  const all = overlayReferences(publicRosterFrom(snapshot, fallback), snapshot);
  // Office instruction, 23 Oct: everyone on the denomination rosters
  // is publicly approved for now. This is a presentation policy only: it does
  // not approve an account, verify a payment, or change the central-site rules.
  return all.filter(p => !p.unclaimed && names.has(normalName(p.denomination))).map(p => ({ ...p, standing: true }));
}
export const ministerSections = (people, { q = '', city = '', gender = '' } = {}) => {
  const words = normalName(q).split(' ').filter(Boolean);
  const matches = people.filter(p => (!city || p.city === city) && (!gender || p.gender === gender) && words.every(w => normalName(`${p.name} ${p.city || ''} ${p.country || ''} ${p.branch || ''}`).includes(w)));
  return {
    bishops: matches.filter(p => p.role === 'bishop' && !isLay(p)).sort(bySurname),
    pastors: matches.filter(p => p.role === 'pastor' || isLay(p)).sort(byMinisterTitle),
  };
};

// Expand the public label without rewriting the office's saved title or rank.
export const ministerDisplayTitle = person => titleFor(person).replace(/\bRev\.(?=\s|$)/g, 'Reverend');
// A church site's signup is the central signup locked to that church. The
// organization and listed denomination come from the office's live catalog,
// so the server's catalog validation accepts the record. An organization with
// no denomination list (HJC) matches by its own or its group's name.
export function churchPlacement(catalog, site, groupNames = {}) {
  const config = denominationSite(site);
  if (!config) return null;
  const names = new Set(config.denominations.map(normalName));
  const church = { path: site, config, names, organization: '', denomination: '' };
  for (const organization of catalog?.organizations || []) {
    if (names.has(normalName(organization)) || names.has(normalName(groupNames[organization] || ''))) return { ...church, organization };
    const denomination = (catalog.denominations?.[organization] || []).find(d => names.has(normalName(d)));
    if (denomination) return { ...church, organization, denomination };
  }
  return church;
}
// Members on a church site only ever see that church's people.
export const inChurch = (church, p) => !church || (church.denomination || !church.organization
  ? church.names.has(normalName(p.denomination))
  : normalName(p.organization) === normalName(church.organization));
export const churchOfDenomination = denomination => Object.keys(DENOMINATION_SITES)
  .find(key => DENOMINATION_SITES[key].denominations.some(d => normalName(d) === normalName(denomination))) || '';
