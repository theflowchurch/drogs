"use client";
import { useState } from "react";
import * as api from "./client";
import { normalName, orgLabel } from "./model.mjs";

const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
export const NEW_DENOMINATION = "__new__";
const words = (s) => normalName(s).split(" ").filter((w) => w.length > 2 && !["the", "church", "international", "int", "ministries", "ministry", "chapel"].includes(w));
// Listed denominations that look like the one being typed (19 Nov), so a
// bishop picks the existing one instead of starting a second.
export function similarDenominations(name, catalog) {
  const w = words(name);
  if (!w.length) return [];
  const all = [...new Set(Object.values(catalog.denominations || {}).flat())];
  return all.filter((d) => { const dw = words(d); return normalName(d) === normalName(name) || (dw.length && w.every((x) => dw.includes(x))) || (dw.length && dw.every((x) => w.includes(x))); }).slice(0, 4);
}
export const logoUrl = (key) => (key ? (key.startsWith("assets/") ? `${base}/${key}` : `${base}/api/registration/media/blob?path=${encodeURIComponent(key)}`) : "");

// Office, 19 Nov: a bishop whose denomination is not listed adds it: its name,
// its group and its logo. It goes live with their details, gets its own church
// page, and pastors can then choose it.
export default function NewDenomination({ value, organization, catalog, actor, onChange, onPick }) {
  const [busy, setBusy] = useState(false), [problem, setProblem] = useState("");
  const groups = Object.entries(catalog.groups || {}).filter(([, g]) => g.organization === organization).map(([n]) => n);
  const similar = similarDenominations(value.newDenomination || "", catalog);
  return (
    <div className="reg-new-denomination">
      <label className="reg-field-label">Name of your denomination
        <input required maxLength={80} value={value.newDenomination || ""} onChange={(e) => onChange({ newDenomination: e.target.value })} placeholder="e.g. Grace City Church" />
      </label>
      {similar.length > 0 && <p className="reg-similar" role="status">Is it one of these? {similar.map((d) => <button key={d} type="button" className="reg-text" onClick={() => onPick(d)}>{d}</button>)}</p>}
      {/* Office, 19 Nov: a bishop adding a denomination always says which group it is under. */}
      {groups.length > 0 ? <label className="reg-field-label">Which group is it under?
        <select required value={value.newDenominationGroup || ""} onChange={(e) => onChange({ newDenominationGroup: e.target.value })}>
          <option value="">Choose a group…</option>{groups.map((g) => <option key={g}>{g}</option>)}
        </select>
      </label> : <p className="reg-field-label">Group<span className="reg-fixed-group">{orgLabel(organization) || "Choose an organization above first"}</span></p>}
      <div className="reg-field-label">Logo
        <div className="reg-new-logo">
          {value.newDenominationLogo && <img src={logoUrl(value.newDenominationLogo)} alt="" />}
          <label className={`reg-secondary reg-file-button ${busy ? "busy" : ""}`}>
            {busy ? "Uploading…" : value.newDenominationLogo ? "Change logo" : "Upload logo"}
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => {
              const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; setBusy(true); setProblem("");
              api.upload(actor, file, "logo").then((key) => onChange({ newDenominationLogo: key })).catch((err) => setProblem(err.message || "The logo could not be uploaded.")).finally(() => setBusy(false));
            }} />
          </label>
        </div>
      </div>
      {problem && <p className="reg-error-text" role="alert">{problem}</p>}
      <p className="reg-small">Your denomination goes on the list with your details. It gets its own church page, and your pastors can then choose it.</p>
    </div>
  );
}
