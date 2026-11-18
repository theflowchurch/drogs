import Redirect from '../../../registration/Redirect';
// The public list of bishops moved to /licensingauthority/registerofbishopsingoodstanding/ (office, 17 Nov).
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const metadata = { title: 'Register of Bishops in Good Standing', robots: { index: false, follow: true } };
export default function Page() { return <Redirect to={`${base}/licensingauthority/registerofbishopsingoodstanding/`}/>; }
