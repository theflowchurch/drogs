import OrganisationsApp from '../../../../registration/OrganisationsApp';
// A group the office adds later (Admin › Bishops & Pastors pages) has no page
// built for it. On the live site its address, /orderofbishopsingoodstanding/<group>/,
// is served by this page (next.config.mjs rewrites), which opens the group
// named in the address.
export const metadata = { title: 'Order of Bishops in Good Standing' };
export default function Page() { return <OrganisationsApp slug="" fromAddress/>; }
