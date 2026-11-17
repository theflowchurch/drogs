import OrganisationsApp from '../../../../../registration/OrganisationsApp';
// The sign-up demonstration starts where a bishop starts (office, 17 Nov): the
// Order of Bishops page with Sign in and Sign up; both open the filled-in
// demonstration form (./form/), which saves and sends nothing.
export const metadata = { title: 'Order of Bishops in Good Standing · Sign-up demonstration', robots: { index: false, follow: false } };
export default function Page() { return <OrganisationsApp bishops demo/>; }
