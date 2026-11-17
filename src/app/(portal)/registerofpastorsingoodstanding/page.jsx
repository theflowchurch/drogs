import BishopsApp from '../../../registration/BishopsApp';
import { PUBLIC_PASTORS } from '../../../registration/pastors-public.mjs';
// The public register of pastors (office, 17 Nov): every pastor on the roll, A to
// Z by surname, in the same style as the Register of Bishops. A pastor's card
// opens their church, their year appointed (ordained, for a Reverend) and the
// bishop they serve under (pastors-public.mjs).
export const metadata = { title: 'Register of Pastors in Good Standing', description: 'Every pastor of the Worldwide Fellowship of Pastors, A to Z.' };
const list = PUBLIC_PASTORS.map(({ denomination, ...p }) => p);
export default function Page() { return <BishopsApp bishops={list} kind="pastor" masthead={{ sub: 'Worldwide Fellowship of Pastors' }}/>; }
