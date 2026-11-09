'use client';
import { useEffect, useState } from 'react';
import { directoryGroupBySlug } from './ministry-organisations.mjs';

// Office, 9 Nov: the first page is a contents page of coloured boxes, one per
// group. Choosing a box shows that group alone. The choice lives in the
// address (#ud-africa), so the browser's Back button returns to the contents
// and a group can be shared as a link. Used by both designs.
export default function useGroupFocus(initial = '') {
  const [focus, setFocus] = useState(null);
  useEffect(() => {
    const read = () => {
      const slug = decodeURIComponent(location.hash.slice(1)) || initial;
      const group = directoryGroupBySlug(slug);
      setFocus(group ? group.slug : null);
      window.scrollTo(0, 0);
      // One Para-Church council's address opens Para-Church at that council.
      if (group && group.slug !== slug) setTimeout(() => document.getElementById(slug)?.scrollIntoView(), 50);
    };
    read();
    addEventListener('hashchange', read);
    return () => removeEventListener('hashchange', read);
  }, [initial]);
  return focus ? directoryGroupBySlug(focus) : null;
}
