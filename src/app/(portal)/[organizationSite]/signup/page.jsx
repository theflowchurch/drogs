import RegistrationApp from '../../../../registration/RegistrationApp';
export default async function Page({ params }) { const { organizationSite } = await params; return <RegistrationApp organizationSite={organizationSite} signup/>; }
