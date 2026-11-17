import Redirect from '../../../../registration/Redirect';
import { ORGANISATION_PAGES } from '../../../../registration/ministry-organisations.mjs';
// /organisations/<page>/ moved to /orderofbishopsingoodstanding/<page>/ (office, 17 Nov).
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const dynamicParams = false;
export function generateStaticParams() { return ORGANISATION_PAGES.map(organisation => ({ organisation })); }
export const metadata = { title: 'Order of Bishops in Good Standing', robots: { index: false, follow: true } };
export default async function Page({ params }) { const { organisation } = await params; return <Redirect to={`${base}/orderofbishopsingoodstanding/${organisation}/`}/>; }
