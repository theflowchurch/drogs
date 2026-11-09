import { notFound } from 'next/navigation';
import OrganisationsApp from '../../../../registration/OrganisationsApp';
import { ORGANISATION_PAGES, organisationBySlug, subsectionBySlug, PAGE_ALIASES } from '../../../../registration/ministry-organisations.mjs';
// One address per category (church, outreach, para-church) and per organisation.
export const dynamicParams = false;
export function generateStaticParams() { return ORGANISATION_PAGES.map(organisation => ({ organisation })); }
export async function generateMetadata({ params }) { const { organisation } = await params; const o = organisationBySlug(PAGE_ALIASES[organisation] || organisation) || subsectionBySlug(organisation); return o ? { title: o.name, description: `The people in charge of ${o.name}.` } : {}; }
export default async function Page({ params }) { const { organisation } = await params; if (!ORGANISATION_PAGES.includes(organisation)) notFound(); return <OrganisationsApp slug={organisation}/>; }
