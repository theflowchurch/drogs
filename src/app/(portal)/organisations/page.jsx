import OrganisationsApp from '../../../registration/OrganisationsApp';
import { ORGANISATIONS } from '../../../registration/ministry-organisations.mjs';
export const metadata = { title: ORGANISATIONS.name, description: 'The Central Directory of Bishops Across All Denominations.' };
export default function Page() { return <OrganisationsApp/>; }
