import PastorsOrderApp from '../../../registration/PastorsOrderApp';
import { PASTOR_GROUPS, PUBLIC_PASTORS } from '../../../registration/pastors-public.mjs';
import { COLOURS } from '../../../registration/ministry-organisations.mjs';
// The Order of Pastors in Good Standing (office, 17 Nov): every pastor on the
// roll, by denomination, in the Order of Bishops' style.
export const metadata = { title: 'Order of Pastors in Good Standing', description: 'The pastors of the Worldwide Fellowship of Pastors, by denomination.' };
const groups = PASTOR_GROUPS.map(({ denomination, logo, ...g }, i) => ({ ...g, colour: COLOURS[i % COLOURS.length], people: g.people.map(({ denomination, ...p }) => p) }));
export default function Page() { return <PastorsOrderApp groups={groups} total={PUBLIC_PASTORS.length}/>; }
