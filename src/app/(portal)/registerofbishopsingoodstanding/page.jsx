import Redirect from '../../../registration/Redirect';
// Moved to /licensingauthority/registerofbishopsingoodstanding/ (office, 19 Nov): Kuriake Castle is the licensing authority.
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const metadata = { title: 'Register of Bishops in Good Standing', robots: { index: false, follow: true } };
export default function Page() { return <Redirect to={`${base}/licensingauthority/registerofbishopsingoodstanding/`}/>; }
