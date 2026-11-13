import OrganisationsApp from '../../../../registration/OrganisationsApp';
// The bishops' link (shared by the office): the same page as /organisations/
// with Sign in and Sign up for bishops. Kept out of search results.
export const metadata = { title: 'Organisations', description: 'Bishops by group.', robots: { index: false, follow: false } };
export default function Page() { return <OrganisationsApp bishops/>; }
