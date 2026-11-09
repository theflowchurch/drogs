import OrganisationsApp from '../../../registration/OrganisationsApp';
import { ORGANISATIONS } from '../../../registration/ministry-organisations.mjs';
export const metadata = { title: ORGANISATIONS.name, description: 'The church, outreach and para-church organisations of Dag Heward-Mills, and the people in charge of them.' };
export default function Page() { return <OrganisationsApp/>; }
