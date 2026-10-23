import { DENOMINATION_SITES, denominationSite } from '../../../registration/denomination-sites.mjs';
import { notFound } from 'next/navigation';
import { ORGANIZATION_SITES, organizationSiteKey, organizationSitePaths } from '../../../registration/organization-sites.mjs';
export const dynamicParams = false;
export function generateStaticParams() { return [...organizationSitePaths, ...Object.keys(DENOMINATION_SITES)].map(organizationSite => ({ organizationSite })); }
export async function generateMetadata({ params }) { const { organizationSite } = await params; const site = denominationSite(organizationSite) || ORGANIZATION_SITES[organizationSiteKey(organizationSite)]; return site ? { title: site.name, description: site.description || `Pastors and bishops licensed to minister within ${site.name}.`, ...(denominationSite(organizationSite) ? { icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/${site.logo}`, apple: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/${site.logo}` } } : {}) } : {}; }
export default async function OrganizationLayout({ children, params }) { const { organizationSite } = await params; if (!organizationSiteKey(organizationSite) && !denominationSite(organizationSite)) notFound(); return children; }
