import { notFound } from 'next/navigation';
import { ORGANIZATION_SITES, organizationSiteKey, organizationSitePaths } from '../../../registration/organization-sites.mjs';
export const dynamicParams = false;
export function generateStaticParams() { return organizationSitePaths.map(organizationSite => ({ organizationSite })); }
export async function generateMetadata({ params }) { const { organizationSite } = await params; const site = ORGANIZATION_SITES[organizationSiteKey(organizationSite)]; return site ? { title: site.name, description: site.description } : {}; }
export default async function OrganizationLayout({ children, params }) { const { organizationSite } = await params; if (!organizationSiteKey(organizationSite)) notFound(); return children; }
