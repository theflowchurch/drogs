import RegistrationApp from '../../../../registration/RegistrationApp';
import { FELLOWSHIP } from '../../../../registration/fellowship.mjs';
// The bishops' sign-up linked from /orderofbishopsingoodstanding/signup/ and /councils/signup/
// (office, 14 Nov): DHMM's look with no Kuriake Castle name or imagery, writing
// to the same records and office as the main sign-up. Kept out of search results.
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const metadata = {
  title: FELLOWSHIP.name,
  description: 'Registration for bishops of the Worldwide Fellowship of Bishops.',
  icons: { icon: `${base}/assets/organisations/dhmm-favicon.png`, apple: `${base}/assets/organisations/dhmm-favicon.png` },
  robots: { index: false, follow: false },
};
export default function Page() { return <RegistrationApp signup="bishop" fellowship/>; }
