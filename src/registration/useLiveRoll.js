'use client';
import { useEffect, useState } from 'react';
import { liveRoll } from './live-patch.mjs';
// The office's live changes for the public pages (live-patch.mjs): the same
// public data the main directory reads (no contacts), fetched once per visit.
// Until it arrives, or if it cannot be had, the page shows what it was built with.
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
let pending = null;
export function loadLiveRoll() {
  if (!pending) pending = (async () => {
    const res = await fetch(`${base}/api/registration/public-directory`, { credentials: 'omit' });
    if (!res.ok) throw Error('unavailable');
    const pub = await res.json();
    if (!pub.rosterVersion) throw Error('unavailable');
    const refs = await (await fetch(`${base}/api/registration/references?version=${encodeURIComponent(pub.rosterVersion)}`, { credentials: 'omit' })).json();
    if (!Array.isArray(refs.referencePeople)) throw Error('unavailable');
    return liveRoll(refs.referencePeople, pub);
  })().catch(e => { pending = null; throw e; });
  return pending;
}
export default function useLiveRoll() {
  const [live, setLive] = useState(null);
  useEffect(() => { let on = true; loadLiveRoll().then(l => on && setLive(l)).catch(() => {}); return () => { on = false; }; }, []);
  return live;
}
// A portrait the office uploaded on the admin page (shown to everyone once it is
// on a public record; the server checks that).
const cache = new Map();
export function useUploadedPhoto(path) {
  const [src, setSrc] = useState(() => cache.get(path) || '');
  useEffect(() => {
    if (!path) return;
    if (cache.has(path)) { setSrc(cache.get(path)); return; }
    let on = true;
    const blob = `${base}/api/registration/media/blob?path=${encodeURIComponent(path)}`;
    (path.startsWith('db/') ? Promise.resolve(blob) : fetch(`${base}/api/registration/media?path=${encodeURIComponent(path)}`, { credentials: 'omit' }).then(r => r.ok ? r.json() : Promise.reject()).then(j => j.url))
      .then(url => { cache.set(path, url); if (on) setSrc(url); }).catch(() => {});
    return () => { on = false; };
  }, [path]);
  return src;
}
