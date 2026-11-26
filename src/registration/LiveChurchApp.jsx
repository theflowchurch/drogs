"use client";
import { useEffect, useState } from "react";
import DenominationApp from "./DenominationApp";
import RegistrationApp from "./RegistrationApp";
import { liveChurchFrom, registerLiveChurch, denominationSite } from "./denomination-sites.mjs";
import * as api from "./client";

// Office, 19 Nov: the church page of a denomination a bishop added. Its address is
// /<church>/rollofgoodstanding/licensingauthority/ like every other church; the
// live site sends it here, and the page is drawn from the live list.
export default function LiveChurchApp({ browse = false, signup = false }) {
  const [site, setSite] = useState(null), [missing, setMissing] = useState(false);
  useEffect(() => {
    const path = decodeURIComponent(location.pathname.replace(process.env.NEXT_PUBLIC_BASE_PATH || "", "").split("/").filter(Boolean)[0] || "");
    if (denominationSite(path)) { setSite(path); return; }
    api.publicDirectory().then((pub) => { const config = liveChurchFrom(pub.catalog, path); if (!config) { setMissing(true); return; } registerLiveChurch(path, config); setSite(path); }).catch(() => setMissing(true));
  }, []);
  if (missing) return <main className="reg-loading" role="alert"><h1>Page not found</h1><p>There is no church page at this address.</p></main>;
  if (!site) return <main className="reg-loading" role="status">Opening the church page…</main>;
  // Its sign-up is the church's own, like every other church's (26 Nov).
  if (signup) return <RegistrationApp church={site} signup />;
  return <DenominationApp site={site} browse={browse} />;
}
