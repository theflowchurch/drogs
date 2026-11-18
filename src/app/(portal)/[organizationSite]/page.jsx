import { notFound } from 'next/navigation';
import RegistrationApp from '../../../registration/RegistrationApp';
import { denominationSite } from '../../../registration/denomination-sites.mjs';
// Church pages live at /<church>/rollofgoodstanding/licensingauthority/ (office, 19 Nov); here only the umbrella sites.
export default async function Page({ params }) { const { organizationSite } = await params; if (denominationSite(organizationSite)) notFound(); return <RegistrationApp organizationSite={organizationSite} />; }
