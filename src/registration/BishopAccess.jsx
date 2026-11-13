'use client';
// Sign in and Sign up for bishops, shown only on the bishops' links that the
// office shares (/organisations/signup/ and /councils/signup/). The public
// /organisations/ and /councils/ pages show the bishops alone, with no sign-up.
// Sign up opens the same bishop sign-up as /signup/bishop/, so it is exactly
// the process used from the main directory.
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';

export default function BishopAccess({ className = '' }) {
  return <nav className={`bishop-access ${className}`} aria-label="Bishops">
    <a className="bishop-access-signin" href={`${base}/signup/#signin`}>Sign in</a>
    <a className="bishop-access-signup" href={`${base}/signup/bishop/`}>Sign up</a>
  </nav>;
}
