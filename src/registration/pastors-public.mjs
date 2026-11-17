import people from './reference-people.json' with { type: 'json' };
import { pastorEntries } from './public-entries.mjs';
// The pastors as published, for building the pastor pages ahead of time.
export const PUBLIC_PASTORS = pastorEntries(people);
