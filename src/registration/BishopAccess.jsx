'use client';
// Sign in and Sign up for bishops, shown only on the bishops' links that the
// office shares (/orderofbishopsingoodstanding/signup/ and /councils/signup/). The public
// /orderofbishopsingoodstanding/ and /councils/ pages show the bishops alone, with no sign-up.
// Both open the bishops' own sign-up (/bishops/signup/, fellowship.mjs): DHMM's
// look with no Kuriake Castle, writing to the same records and office as the
// main directory's sign-up.
import { fellowshipSignupPath } from './fellowship.mjs';
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';

export default function BishopAccess({ className = '' }) {
  return <nav className={`bishop-access ${className}`} aria-label="Bishops">
    <a className="bishop-access-signin" href={`${fellowshipSignupPath(base)}#signin`}>Sign in</a>
    <a className="bishop-access-signup" href={fellowshipSignupPath(base)}>Sign up</a>
  </nav>;
}
