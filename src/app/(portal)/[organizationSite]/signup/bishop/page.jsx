import { denominationSite } from '../../../../../registration/denomination-sites.mjs';
import RegistrationApp from '../../../../../registration/RegistrationApp';
export default async function Page({ params }) { const { organizationSite } = await params; return denominationSite(organizationSite) ? <RegistrationApp church={organizationSite} signup="bishop"/> : <RegistrationApp organizationSite={organizationSite} signup="bishop"/>; }
