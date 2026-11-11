'use client';
import { useEffect, useState } from 'react';
import { directoryGroupBySlug, resolveGroupSlug } from './ministry-organisations.mjs';

// Office, 9 Nov: the first page is a contents page of coloured boxes, one per
// group. Choosing a box shows that group alone. The choice lives in the
// address (#ud-africa), so the browser's Back button returns to the contents
// and a group can be shared as a link. Used by both designs.
// Office, 11 Nov: a group made of several (Para-Church, First Love Church)
// opens a second contents page; choosing one of its councils or countries
// (#flow-council) shows that one alone. Returns { group, part }.
export default function useGroupFocus(initial = '') {
  const [slug, setSlug] = useState('');
  useEffect(() => {
    const read = () => { setSlug(resolveGroupSlug(decodeURIComponent(location.hash.slice(1)) || initial)); window.scrollTo(0, 0); };
    read();
    addEventListener('hashchange', read);
    return () => removeEventListener('hashchange', read);
  }, [initial]);
  const group = slug ? directoryGroupBySlug(slug) : null;
  const part = group?.parts?.find(p => p.slug === slug) || null;
  return { group, part };
}
