'use client';
import { useEffect, useState } from 'react';

// Office, 9 Nov: the whole directory scrolls as one page, but choosing a
// section from the boxes shows that section alone until the reader goes back
// to the sections or to the top of the page. Used by both designs.
export default function useSectionFocus() {
  const [focus, setFocus] = useState(null);
  const [target, setTarget] = useState(null);
  // Scroll once the page has been redrawn, so the reader lands at the start
  // of what is now shown.
  useEffect(() => { if (target) document.getElementById(target.id)?.scrollIntoView(); }, [target]);
  const open = slug => event => { event?.preventDefault(); setFocus(slug); setTarget({ id: slug }); };
  const close = to => event => { event?.preventDefault(); setFocus(null); setTarget({ id: to }); };
  return { focus, open, close };
}
