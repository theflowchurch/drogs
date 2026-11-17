import RegistrationApp from '../../../../../registration/RegistrationApp';
import { FELLOWSHIP } from '../../../../../registration/fellowship.mjs';
// The bishops' sign-up demonstration (office, 17 Nov): the same pages as
// /bishops/signup/, every step already filled in, ending at Payment. Nothing is
// saved or sent. Kept out of search results.
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const metadata = {
  title: `${FELLOWSHIP.name} · Sign-up demonstration`,
  icons: { icon: `${base}/assets/organisations/dhmm-favicon.png`, apple: `${base}/assets/organisations/dhmm-favicon.png` },
  robots: { index: false, follow: false },
};
export default function Page() { return <RegistrationApp signup="bishop" fellowship demo/>; }
