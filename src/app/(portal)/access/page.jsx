import AccessGate from '../../../registration/AccessGate';
// The way in to the private Order of Bishops / Pastors pages and Councils (17 Nov).
export const metadata = { title: 'Private page', description: 'Enter the password and sign in to continue.', robots: { index: false } };
export default function Page() { return <AccessGate />; }
