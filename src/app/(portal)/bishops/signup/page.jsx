import Redirect from '../../../../registration/Redirect';
// The bishops' sign-up moved to /orderofbishopsingoodstanding/signup/ (office, 17 Nov).
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const metadata = { robots: { index: false, follow: false } };
export default function Page() { return <Redirect to={`${base}/orderofbishopsingoodstanding/signup/`}/>; }
