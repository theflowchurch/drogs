'use client';
import { useEffect } from 'react';
// An old address that now lives elsewhere: go there at once, with a link for
// anyone whose browser does not follow.
export default function Redirect({ to }) {
  useEffect(() => { location.replace(to + location.hash); }, [to]);
  return <p style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>This page has moved to <a href={to}>{to}</a>.</p>;
}
