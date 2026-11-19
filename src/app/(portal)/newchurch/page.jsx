import LiveChurchApp from '../../../registration/LiveChurchApp';
// A church a bishop added (19 Nov); next.config.mjs sends its address here on the live site.
export const metadata = { title: 'Kuriake Castle', robots: { index: false, follow: true } };
export default function Page() { return <LiveChurchApp />; }
