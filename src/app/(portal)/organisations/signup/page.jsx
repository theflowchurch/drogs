import Redirect from '../../../../registration/Redirect';
// /organisations/signup/ moved to /orderofbishopsingoodstanding/signup/ (office, 17 Nov).
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const metadata = { title: 'Order of Bishops in Good Standing', robots: { index: false, follow: false } };
export default function Page() { return <Redirect to={`${base}/orderofbishopsingoodstanding/signup/`}/>; }
