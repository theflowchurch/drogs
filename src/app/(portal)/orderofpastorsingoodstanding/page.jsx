import PastorsOrderApp from '../../../registration/PastorsOrderApp';
import { PUBLIC_PASTORS } from '../../../registration/pastors-public.mjs';
import { pastorGroups } from '../../../registration/public-entries.mjs';
import { COLOURS } from '../../../registration/ministry-organisations.mjs';
// The Order of Pastors in Good Standing (office, 17 Nov): every pastor on the
// roll, by denomination, in the Order of Bishops' style. Once open, the page
// follows the office's live changes (live-patch.mjs).
export const metadata = { title: 'Order of Pastors in Good Standing', description: 'The pastors of the Worldwide Fellowship of Pastors, by denomination.' };
const groups = pastorGroups(PUBLIC_PASTORS, COLOURS).map(g => ({ ...g, people: g.people.map(({ denomination, ...p }) => p) }));
export default function Page() { return <PastorsOrderApp groups={groups} total={PUBLIC_PASTORS.length}/>; }
