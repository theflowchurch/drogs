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
  // Office, 20 Nov: the verified seal (option 2): a green wavy-edged badge with a white tick.
  return <i className="gs-tick" title={label} role="img" aria-label={label}>
    <svg viewBox="0 0 100 100" aria-hidden="true"><path d="M98.5 50.0 L97.9 52.5 L96.2 54.9 L94.0 57.0 L91.6 58.8 L89.6 60.6 L88.5 62.5 L88.3 64.7 L88.8 67.3 L89.6 70.2 L90.3 73.3 L90.2 76.1 L89.2 78.5 L87.3 80.2 L84.6 81.1 L81.5 81.5 L78.4 81.6 L75.8 81.9 L73.8 82.8 L72.3 84.4 L71.2 86.8 L70.2 89.6 L68.9 92.5 L67.2 94.8 L65.0 96.1 L62.4 96.3 L59.7 95.5 L57.0 94.0 L54.4 92.3 L52.1 91.0 L50.0 90.5 L47.9 91.0 L45.6 92.3 L43.0 94.0 L40.3 95.5 L37.6 96.3 L35.0 96.1 L32.8 94.8 L31.1 92.5 L29.8 89.6 L28.8 86.8 L27.7 84.4 L26.2 82.8 L24.2 81.9 L21.6 81.6 L18.5 81.5 L15.4 81.1 L12.7 80.2 L10.8 78.5 L9.8 76.1 L9.7 73.3 L10.4 70.2 L11.2 67.3 L11.7 64.7 L11.5 62.5 L10.4 60.6 L8.4 58.8 L6.0 57.0 L3.8 54.9 L2.1 52.5 L1.5 50.0 L2.1 47.5 L3.8 45.1 L6.0 43.0 L8.4 41.2 L10.4 39.4 L11.5 37.5 L11.7 35.3 L11.2 32.7 L10.4 29.8 L9.7 26.7 L9.8 23.9 L10.8 21.5 L12.7 19.8 L15.4 18.9 L18.5 18.5 L21.6 18.4 L24.2 18.1 L26.2 17.2 L27.7 15.6 L28.8 13.2 L29.8 10.4 L31.1 7.5 L32.8 5.2 L35.0 3.9 L37.6 3.7 L40.3 4.5 L43.0 6.0 L45.6 7.7 L47.9 9.0 L50.0 9.5 L52.1 9.0 L54.4 7.7 L57.0 6.0 L59.7 4.5 L62.4 3.7 L65.0 3.9 L67.2 5.2 L68.9 7.5 L70.2 10.4 L71.2 13.2 L72.3 15.6 L73.8 17.2 L75.8 18.1 L78.4 18.4 L81.5 18.5 L84.6 18.9 L87.3 19.8 L89.2 21.5 L90.2 23.9 L90.3 26.7 L89.6 29.8 L88.8 32.7 L88.3 35.3 L88.5 37.5 L89.6 39.4 L91.6 41.2 L94.0 43.0 L96.2 45.1 L97.9 47.5 L98.5 50.0Z" fill="#fff"/><path d="M93.6 50.0 L93.1 52.3 L91.6 54.4 L89.5 56.3 L87.4 57.9 L85.6 59.5 L84.6 61.2 L84.4 63.2 L84.9 65.5 L85.6 68.2 L86.2 70.9 L86.2 73.5 L85.3 75.6 L83.5 77.1 L81.1 78.0 L78.3 78.3 L75.6 78.4 L73.2 78.7 L71.4 79.4 L70.1 80.9 L69.1 83.1 L68.2 85.6 L67.0 88.2 L65.5 90.3 L63.5 91.5 L61.2 91.6 L58.7 90.9 L56.3 89.5 L54.0 88.0 L51.9 86.8 L50.0 86.4 L48.1 86.8 L46.0 88.0 L43.7 89.5 L41.3 90.9 L38.8 91.6 L36.5 91.5 L34.5 90.3 L33.0 88.2 L31.8 85.6 L30.9 83.1 L29.9 80.9 L28.6 79.4 L26.8 78.7 L24.4 78.4 L21.7 78.3 L18.9 78.0 L16.5 77.1 L14.7 75.6 L13.8 73.5 L13.8 70.9 L14.4 68.2 L15.1 65.5 L15.6 63.2 L15.4 61.2 L14.4 59.5 L12.6 57.9 L10.5 56.3 L8.4 54.4 L6.9 52.3 L6.4 50.0 L6.9 47.7 L8.4 45.6 L10.5 43.7 L12.6 42.1 L14.4 40.5 L15.4 38.8 L15.6 36.8 L15.1 34.5 L14.4 31.8 L13.8 29.1 L13.8 26.5 L14.7 24.4 L16.5 22.9 L18.9 22.0 L21.7 21.7 L24.4 21.6 L26.8 21.3 L28.6 20.6 L29.9 19.1 L30.9 16.9 L31.8 14.4 L33.0 11.8 L34.5 9.7 L36.5 8.5 L38.8 8.4 L41.3 9.1 L43.7 10.5 L46.0 12.0 L48.1 13.2 L50.0 13.6 L51.9 13.2 L54.0 12.0 L56.3 10.5 L58.7 9.1 L61.2 8.4 L63.5 8.5 L65.5 9.7 L67.0 11.8 L68.2 14.4 L69.1 16.9 L70.1 19.1 L71.4 20.6 L73.2 21.3 L75.6 21.6 L78.3 21.7 L81.1 22.0 L83.5 22.9 L85.3 24.4 L86.2 26.5 L86.2 29.1 L85.6 31.8 L84.9 34.5 L84.4 36.8 L84.6 38.8 L85.6 40.5 L87.4 42.1 L89.5 43.7 L91.6 45.6 L93.1 47.7 L93.6 50.0Z" fill="#1e9e5a"/><path d="M31 51l12 12 26-27" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/></svg>
  </i>;
}
