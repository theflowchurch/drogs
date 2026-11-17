import Redirect from '../../../registration/Redirect';
// /organisations/ moved to /orderofbishopsingoodstanding/ (office, 17 Nov).
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const metadata = { title: 'Order of Bishops in Good Standing', robots: { index: false, follow: true } };
export default function Page() { return <Redirect to={`${base}/orderofbishopsingoodstanding/`}/>; }
