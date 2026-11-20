import { notFound } from 'next/navigation';
import DenominationApp from '../../../../../registration/DenominationApp';
import { denominationSite } from '../../../../../registration/denomination-sites.mjs';
// A church's page (office, 19 Nov): /<church>/rollofgoodstanding/licensingauthority/.
// Office, 20 Nov: it opens straight on the directory of ministers.
export default async function Page({ params }) { const { organizationSite } = await params; if (!denominationSite(organizationSite)) notFound(); return <DenominationApp site={organizationSite} browse />; }
