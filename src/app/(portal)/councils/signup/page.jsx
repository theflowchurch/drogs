import CouncilsApp from '../../../../registration/CouncilsApp';
// The bishops' link (shared by the office): the same page as /councils/
// with Sign in and Sign up for bishops. Kept out of search results.
export const metadata = { title: 'Councils', description: 'Bishops by group.', robots: { index: false, follow: false } };
export default function Page() { return <CouncilsApp bishops/>; }
