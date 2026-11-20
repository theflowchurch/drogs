import { existsSync } from 'node:fs';
// The browser tab icon is a square copy of the logo (assets/denominations/icons), so wide logos are not squashed.
import { DENOMINATION_SITES, denominationSite } from '../../../registration/denomination-sites.mjs';
import { notFound } from 'next/navigation';
import { ORGANIZATION_SITES, organizationSiteKey, organizationSitePaths } from '../../../registration/organization-sites.mjs';
export const dynamicParams = false;
export function generateStaticParams() { return [...new Set([...organizationSitePaths, ...Object.keys(DENOMINATION_SITES)])].map(organizationSite => ({ organizationSite })); }
export async function generateMetadata({ params }) { const { organizationSite } = await params; const site = denominationSite(organizationSite) || ORGANIZATION_SITES[organizationSiteKey(organizationSite)]; return site ? { title: site.name, description: site.description || `Bishops and pastors of ${site.name} on Kuriake Castle’s Roll of Good Standing.`, ...(denominationSite(organizationSite) && site.logo ? { icons: (() => { const icon = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/${existsSync(`assets/denominations/icons/${organizationSite}.png`) ? `assets/denominations/icons/${organizationSite}.png` : site.logo}`; return { icon, apple: icon }; })() } : {}) } : {}; }
export default async function OrganizationLayout({ children, params }) { const { organizationSite } = await params; if (!organizationSiteKey(organizationSite) && !denominationSite(organizationSite)) notFound(); return children; }
