import RegistrationApp from '../../../../registration/RegistrationApp';
import { FELLOWSHIPS } from '../../../../registration/fellowship.mjs';
// The pastors' sign-up (office, 17 Nov): opens straight onto the email box, in
// DHMM's look with no Kuriake Castle, writing to the same records and office as
// the main sign-up. Kept out of search results.
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const metadata = {
  title: FELLOWSHIPS.pastors.name,
  description: 'Registration for pastors of the Worldwide Fellowship of Pastors.',
  icons: { icon: `${base}/assets/organisations/dhmm-favicon.png`, apple: `${base}/assets/organisations/dhmm-favicon.png` },
  robots: { index: false, follow: false },
};
export default function Page() { return <RegistrationApp signup="pastor" fellowship="pastors"/>; }
