import OrganisationsApp from '../../../../registration/OrganisationsApp';
// The bishops' link (shared by the office): the same page as /orderofbishopsingoodstanding/
// with Sign in and Sign up for bishops. Kept out of search results.
export const metadata = { title: 'Order of Bishops in Good Standing', description: 'Bishops by group.', robots: { index: false, follow: false } };
export default function Page() { return <OrganisationsApp bishops/>; }
