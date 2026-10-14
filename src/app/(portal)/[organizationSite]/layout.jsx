import { notFound } from 'next/navigation';
import { ORGANIZATION_SITES } from '../../../registration/organization-sites.mjs';
export const dynamicParams = false;
export function generateStaticParams() { return Object.keys(ORGANIZATION_SITES).map(organizationSite => ({ organizationSite })); }
export async function generateMetadata({ params }) { const { organizationSite } = await params; const site = ORGANIZATION_SITES[organizationSite]; return site ? { title: site.name, description: site.description } : {}; }
export default async function OrganizationLayout({ children, params }) { const { organizationSite } = await params; if (!ORGANIZATION_SITES[organizationSite]) notFound(); return children; }
