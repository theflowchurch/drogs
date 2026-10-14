import { normalName, pastorsByBishop } from './model.mjs';

// The three public umbrellas share the existing records and office. Legacy
// organization keys remain intact for approvals, attire, payments and imports.
export const ORGANIZATION_SITES = {
  firstlove: {
    name: 'First Love Movement', shortName: 'First Love',
    organizations: ['First Love'], logo: 'assets/denominations/first-love-church.png',
    heroLogo: 'assets/brand/first-love-basic.png',
    description: 'Bishops, pastors and denominations of the First Love Movement.',
  },
  ud: {
    name: 'United Denominations', shortName: 'United Denominations',
    organizations: ['United Denominations'], logo: 'assets/brand/ud-logo.png',
    description: 'United Denominations originating from the Lighthouse Group of Churches.',
  },
  flow: {
    name: 'FLOW', shortName: 'FLOW',
    organizations: ['FLOW', 'HJC', 'DHMM'], logo: 'assets/brand/flow-logo-black.png', heroLogo: 'assets/brand/flow-logo.png',
    description: 'The bishops and pastors of FLOW, Healing Jesus Campaign and DHMM.',
  },
};
export const FLOW_GROUPS = { FLOW: 'FLOW', HJC: 'Healing Jesus Campaign', DHMM: 'DHMM' };
export const siteOfOrganization = organization => Object.keys(ORGANIZATION_SITES)
  .find(key => ORGANIZATION_SITES[key].organizations.includes(organization)) || '';
export const sitePath = (site, path = '', base = '') => `${base}${site ? `/${site}` : ''}/${path ? `${path.replace(/^\/+|\/+$/g, '')}/` : ''}`;

// A unique bishop relationship takes precedence over stale pastor affiliation.
// Ambiguous names keep the saved organization; denomination names alone never
// move people, since the same denomination can belong to different umbrellas.
export function organizationMembership(people) {
  const bishops = people.filter(p => p.role === 'bishop');
  const byKey = new Map();
  for (const b of bishops) for (const key of [b.id, b.referenceId, b.bishopKey].filter(Boolean)) byKey.set(key, b);
  const candidates = new Map();
  const byId = new Map(bishops.map(b => [b.id, b]));
  for (const [id, pastors] of pastorsByBishop(people)) for (const p of pastors) {
    const matches = candidates.get(p.id) || [];
    matches.push(byId.get(id)); candidates.set(p.id, matches);
  }
  return new Map(people.map(p => {
    const matches = candidates.get(p.id) || [];
    const bishop = p.role === 'pastor' && (byKey.get(p.bishopKey || p.bishopId) || (matches.length === 1 ? matches[0] : null));
    return [p.id, bishop?.organization || p.organization];
  }));
}

export function peopleForSite(people, site) {
  if (!site) return people;
  const config = ORGANIZATION_SITES[site];
  if (!config) return [];
  const membership = organizationMembership(people);
  return people.filter(p => config.organizations.includes(membership.get(p.id)))
    .map(p => ({ ...p, ...(site === 'flow' ? { group: FLOW_GROUPS[membership.get(p.id)] } : {}) }));
}

export function siteCatalog(catalog, site) {
  if (!site) return catalog;
  const organizations = ORGANIZATION_SITES[site]?.organizations || [];
  return { ...catalog, organizations,
    denominations: Object.fromEntries(organizations.map(o => [o, catalog.denominations?.[o] || []])),
    groups: Object.fromEntries(Object.entries(catalog.groups || {}).filter(([, g]) => organizations.includes(g.organization))),
  };
}

export function organizationAudit(people) {
  const membership = organizationMembership(people);
  return {
    sites: Object.fromEntries(Object.keys(ORGANIZATION_SITES).map(site => {
      const list = peopleForSite(people, site);
      return [site, { bishops: list.filter(p => p.role === 'bishop').length, pastors: list.filter(p => p.role === 'pastor').length,
        denominations: [...new Set(list.map(p => p.denomination).filter(Boolean))].sort() }];
    })),
    inherited: people.filter(p => membership.get(p.id) !== p.organization).map(p => ({ id: p.id, name: p.name, bishop: p.bishop,
      savedOrganization: p.organization, bishopOrganization: membership.get(p.id) })),
    unassigned: people.filter(p => !siteOfOrganization(membership.get(p.id))).map(p => ({ id: p.id, name: p.name, organization: p.organization })),
    sharedDenominations: [...new Set(people.map(p => p.denomination).filter(Boolean))].filter(d =>
      new Set(people.filter(p => normalName(p.denomination) === normalName(d)).map(p => siteOfOrganization(membership.get(p.id))).filter(Boolean)).size > 1),
  };
}
