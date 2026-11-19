import { CastleEventPage } from '../../../registration/CastleSite';
import { castleEvent } from '../../../registration/castle-events.mjs';
const e = castleEvent('thanksgiving');
export const metadata = { title: `${e.title} · Kuriake Castle`, description: e.lead };
export default function Page() { return <CastleEventPage slug="thanksgiving" />; }
