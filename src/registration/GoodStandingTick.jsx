'use client';
// Office, 19 Nov: a green tick on the photo of everyone in good standing for
// the year (registered, fee confirmed, and a pastor confirmed by their bishop),
// on every public page, so it can be seen without opening the records.
import useLiveRoll from './useLiveRoll';
import './good-standing-tick.css';

const EMPTY = new Set();
// Who is in good standing, from the live roll (nobody until it has loaded).
export function useGoodStanding() {
  const live = useLiveRoll();
  return { has: (id) => Boolean(id) && (live?.goodStanding || EMPTY).has(id), year: live?.year || '' };
}
export function StandingTick({ on, year = '' }) {
  if (!on) return null;
  const label = `In good standing${year ? ` for ${year}` : ''}`;
  return <i className="gs-tick" title={label} role="img" aria-label={label}>
    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
  </i>;
}
