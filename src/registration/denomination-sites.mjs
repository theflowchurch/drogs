import { normalName, overlayReferences, isLay, bySurname, byMinisterTitle } from './model.mjs';
import { publicRosterFrom } from './live-roster.mjs';

export const DENOMINATION_SITES = {
  lighthousechapelinternational: {
    name: 'Lighthouse Chapel International', shortName: 'Lighthouse Chapel', subtitle: 'International',
    denominations: ['Lighthouse Chapel International'], logo: 'assets/denominations/lighthouse-chapel.webp', accent: '#786133',
  },
  pleasantsurprise: {
    name: 'Pleasant Surprise Church International', shortName: 'Pleasant Surprise', subtitle: 'Church International',
    denominations: ['Pleasant Surprise', 'Pleasant Surprise Church International'], logo: 'assets/denominations/pleasant-surprise-cleaned.webp', accent: '#49305b',
  },
  gochurch: {
    name: 'Go Church', shortName: 'Go Church', subtitle: '',
    denominations: ['Go Church'], logo: 'assets/denominations/go-church-cleaned.webp', accent: '#292b28',
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
  // Office instruction, 23 Oct: everyone on these three denomination rosters
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
