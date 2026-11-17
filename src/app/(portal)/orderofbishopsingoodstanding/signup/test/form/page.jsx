import Redirect from '../../../../../../registration/Redirect';
// The demonstration form moved back to /orderofbishopsingoodstanding/signup/test/ (office, 17 Nov).
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const metadata = { robots: { index: false, follow: false } };
export default function Page() { return <Redirect to={`${base}/orderofbishopsingoodstanding/signup/test/`}/>; }
