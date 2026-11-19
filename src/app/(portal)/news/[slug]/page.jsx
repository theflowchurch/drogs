import { CastleNewsPage } from '../../../../registration/CastleSite';
import { CASTLE_NEWS, castleNews } from '../../../../registration/castle-news.mjs';
// Office, 19 Nov: each news article on Kuriake Castle's main page has its own page.
export const dynamicParams = false;
export function generateStaticParams() { return CASTLE_NEWS.map((n) => ({ slug: n.slug })); }
export async function generateMetadata({ params }) { const n = castleNews((await params).slug); return { title: `${n.title} · Kuriake Castle`, description: n.summary }; }
export default async function Page({ params }) { return <CastleNewsPage slug={(await params).slug} />; }
