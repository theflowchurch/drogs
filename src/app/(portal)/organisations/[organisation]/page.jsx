import { notFound } from 'next/navigation';
import OrganisationsApp from '../../../../registration/OrganisationsApp';
import { ALL_ORGANISATIONS, ORGANISATIONS, organisationBySlug } from '../../../../registration/ministry-organisations.mjs';
export const dynamicParams = false;
export function generateStaticParams() { return ALL_ORGANISATIONS.map(o => ({ organisation: o.slug })); }
export async function generateMetadata({ params }) { const { organisation } = await params; const o = organisationBySlug(organisation); return o ? { title: `${o.name} · ${ORGANISATIONS.shortName}`, description: `The people in charge of and serving in ${o.name}.` } : {}; }
export default async function Page({ params }) { const { organisation } = await params; if (!organisationBySlug(organisation)) notFound(); return <OrganisationsApp slug={organisation}/>; }
