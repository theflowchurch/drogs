import RegistrationApp from '../../../registration/RegistrationApp';
import DenominationApp from '../../../registration/DenominationApp';
import { denominationSite } from '../../../registration/denomination-sites.mjs';
export default async function Page({ params }) { const { organizationSite } = await params; return denominationSite(organizationSite) ? <DenominationApp site={organizationSite} /> : <RegistrationApp organizationSite={organizationSite} />; }
