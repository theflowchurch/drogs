import people from './reference-people.json' with { type: 'json' };
import { pastorEntries, orderEntries } from './public-entries.mjs';
// The pastors as published, for building the pastor pages ahead of time.
export const PUBLIC_PASTORS = pastorEntries(people);
// The Order of Pastors also lists the bishops (office, 22 Nov); the register does not.
export const ORDER_PASTORS = orderEntries(people);
