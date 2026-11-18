import { notFound } from 'next/navigation';
import DenominationApp from '../../../../../../registration/DenominationApp';
import { denominationSite } from '../../../../../../registration/denomination-sites.mjs';
export default async function Page({ params }) { const { organizationSite } = await params; if (!denominationSite(organizationSite)) notFound(); return <DenominationApp site={organizationSite} browse />; }
