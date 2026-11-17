import RegistrationApp from '../../../../../registration/RegistrationApp';
import { FELLOWSHIPS } from '../../../../../registration/fellowship.mjs';
// The pastors' sign-up demonstration (office, 17 Nov): the same pages as
// /orderofpastorsingoodstanding/signup/, every step already filled in, through
// payment to the end. It runs in the visitor's browser only: nothing is saved
// or sent. Kept out of search results.
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const metadata = {
  title: `${FELLOWSHIPS.pastors.name} · Sign-up demonstration`,
  icons: { icon: `${base}/assets/organisations/dhmm-favicon.png`, apple: `${base}/assets/organisations/dhmm-favicon.png` },
  robots: { index: false, follow: false },
};
export default function Page() { return <RegistrationApp signup="pastor" fellowship="pastors" demo/>; }
