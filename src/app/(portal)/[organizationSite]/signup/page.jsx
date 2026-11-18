import { notFound } from 'next/navigation';
import { denominationSite } from '../../../../registration/denomination-sites.mjs';
import RegistrationApp from '../../../../registration/RegistrationApp';
export default async function Page({ params }) { const { organizationSite } = await params; if (denominationSite(organizationSite)) notFound(); return <RegistrationApp organizationSite={organizationSite} signup/>; }
