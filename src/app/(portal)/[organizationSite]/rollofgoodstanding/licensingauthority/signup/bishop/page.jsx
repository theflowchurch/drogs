import { notFound } from 'next/navigation';
import RegistrationApp from '../../../../../../../registration/RegistrationApp';
import { denominationSite } from '../../../../../../../registration/denomination-sites.mjs';
export default async function Page({ params }) { const { organizationSite } = await params; if (!denominationSite(organizationSite)) notFound(); return <RegistrationApp church={organizationSite} signup="bishop"/>; }
