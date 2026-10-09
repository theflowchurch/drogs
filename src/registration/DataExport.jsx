"use client";
import { useMemo, useState } from "react";
import { directoryPeople, titleFor, placeOf, orgLabel, caps, bySurname } from "./model.mjs";

// Office → Data: pick who, narrow down, tick the columns, download CSV or Excel.
// Everything the office has asked for by hand so far (bishops missing years, pastors
// without a photo, everyone under a bishop, contact lists) is a few clicks here.
const COLUMNS = [
  ["name", "Full Name", (p) => p.name],
  ["title", "Title", (p) => titleFor(p)],
  ["role", "Role", (p) => (p.title === "Lay President" ? "Lay President" : p.role === "bishop" ? "Bishop" : "Pastor")],
  ["gender", "Gender", (p) => (p.gender === "female" ? "Female" : p.gender === "male" ? "Male" : "")],
  ["bishop", "Bishop in Charge", (p) => (p.role === "pastor" ? p.bishop || "" : "")],
  ["unclaimed", "Why Unclaimed", (p) => p.unclaimed || ""],
  ["group", "Group", (p) => p.group || orgLabel(p.organization) || ""],
  ["organization", "Organization", (p) => orgLabel(p.organization) || ""],
  ["denomination", "Denomination", (p) => caps(p.denomination)],
  ["branch", "Branch", (p) => p.branch || ""],
  ["city", "City", (p) => p.city || ""],
  ["country", "Country", (p) => p.country || ""],
  ["place", "Place", (p) => placeOf(p)],
  ["phone", "WhatsApp Number", (p) => p.phone || ""],
  ["email", "Email", (p) => p.email || ""],
  ["yearAppointed", "Year Appointed", (p) => p.yearAppointed || ""],
  ["yearOrdained", "Year Ordained", (p) => p.yearOrdained || ""],
  ["yearConsecrated", "Year Consecrated", (p) => (p.role === "bishop" ? p.yearConsecrated || "" : "")],
  ["photo", "Photo on File", (p) => (p.image || p.registration?.data?.photo ? "Yes" : "No")],
  ["photoUrl", "Photo Link", (p) => (p.image ? `${location.origin}/${p.image}` : "")],
  ["registered", "Registered This Year", (p) => (p.registration ? "Yes" : "No")],
  ["status", "Registration Status", (p) => p.registration?.status || ""],
  ["id", "Record ID", (p) => p.id],
];
const DEFAULT_COLUMNS = ["name", "title", "role", "gender", "bishop", "group", "denomination", "city", "country", "phone", "yearAppointed", "yearOrdained", "yearConsecrated", "photo"];
// Ready-made picks: one click sets who, the narrowing and the columns.
const PRESETS = [
  { label: "All Bishops", who: "bishop", only: [], columns: ["name", "title", "gender", "group", "denomination", "city", "country", "phone", "email", "yearAppointed", "yearOrdained", "yearConsecrated", "photo"] },
  { label: "All Pastors with Their Bishop", who: "pastor", only: [], columns: ["name", "title", "gender", "bishop", "group", "denomination", "city", "country", "phone", "yearAppointed", "photo"] },
  { label: "Bishops Missing a Year", who: "bishop", only: ["missingYears"], columns: ["name", "title", "group", "denomination", "place", "yearAppointed", "yearOrdained", "yearConsecrated"] },
  { label: "Pastors Missing a Year", who: "pastor", only: ["missingYears"], columns: ["name", "title", "bishop", "group", "denomination", "place", "yearAppointed", "yearOrdained"] },
  { label: "Pastors Without a Photo", who: "pastor", only: ["noPhoto"], columns: ["name", "title", "bishop", "group", "denomination", "place", "phone"] },
  { label: "Bishops Without a Photo", who: "bishop", only: ["noPhoto"], columns: ["name", "title", "group", "denomination", "place", "phone", "email"] },
  { label: "Not Yet Registered This Year", who: "both", only: ["notRegistered"], columns: ["name", "title", "role", "bishop", "group", "denomination", "place", "phone", "email"] },
  { label: "Contact List", who: "both", only: [], columns: ["name", "title", "role", "bishop", "group", "phone", "email"] },
  { label: "Unclaimed Pastors (No Bishop)", who: "pastor", only: ["unclaimed"], columns: ["name", "title", "gender", "group", "denomination", "place", "phone", "unclaimed"] },
];
const ONLY = [
  ["missingYears", "Missing a Year Appointed, Ordained or Consecrated", (p) => !p.yearAppointed || (p.role === "bishop" ? !p.yearOrdained || !p.yearConsecrated : p.title === "Rev." && !p.yearOrdained)],
  ["noPhoto", "No Photo on File", (p) => !p.image && !p.registration?.data?.photo],
  ["notRegistered", "Not Yet Registered This Year", (p) => !p.registration],
  ["registered", "Registered This Year", (p) => Boolean(p.registration)],
  ["unclaimed", "Unclaimed (Under No Bishop)", (p) => Boolean(p.unclaimed)],
  ["noPastors", "Bishops with No Pastors", (p, all) => p.role === "bishop" && !all.some((q) => q.role === "pastor" && q.bishop === p.name)],
];
const csvCell = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const download = (name, blob) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };

export default function DataExport({ state, people, year }) {
  const [who, setWho] = useState("both");
  const [narrow, setNarrow] = useState({ group: "", denomination: "", country: "", bishop: "" });
  const [only, setOnly] = useState([]);
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [format, setFormat] = useState("xlsx");
  const everyone = useMemo(() => directoryPeople(state, people, year).map((p) => ({ ...p, ...(state.contacts?.[p.id] || {}) })), [state, people, year]);
  const options = useMemo(() => ({
    group: [...new Set(everyone.map((p) => p.group || orgLabel(p.organization)).filter(Boolean))].sort(),
    denomination: [...new Set(everyone.map((p) => caps(p.denomination)).filter(Boolean))].sort(),
    country: [...new Set(everyone.map((p) => p.country).filter(Boolean))].sort(),
    bishop: everyone.filter((p) => p.role === "bishop").map((b) => b.name).sort(),
  }), [everyone]);
  const rows = useMemo(() => everyone
    .filter((p) => who === "both" || p.role === who)
    .filter((p) => !narrow.group || (p.group || orgLabel(p.organization)) === narrow.group)
    .filter((p) => !narrow.denomination || caps(p.denomination) === narrow.denomination)
    .filter((p) => !narrow.country || p.country === narrow.country)
    .filter((p) => !narrow.bishop || p.name === narrow.bishop || p.bishop === narrow.bishop)
    .filter((p) => only.every((k) => ONLY.find(([key]) => key === k)[2](p, everyone)))
    .sort((a, b) => (a.role === b.role ? 0 : a.role === "bishop" ? -1 : 1) || (a.bishop || "").localeCompare(b.bishop || "") || bySurname(a, b)), [everyone, who, narrow, only]);
  const chosen = COLUMNS.filter(([key]) => columns.includes(key));
  const fileName = () => {
    const bits = [who === "both" ? "bishops-and-pastors" : `${who}s`, ...only, narrow.group, narrow.denomination, narrow.country, narrow.bishop].filter(Boolean).map((s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    return `kuriake-${bits.join("-")}-${new Date().toISOString().slice(0, 10)}`;
  };
  const exportNow = async () => {
    const header = chosen.map(([, label]) => label), body = rows.map((p) => chosen.map(([, , get]) => get(p)));
    if (format === "csv") return download(`${fileName()}.csv`, new Blob(["﻿" + [header, ...body].map((r) => r.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" }));
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([header, ...body]); ws["!cols"] = header.map((h, i) => ({ wch: Math.min(48, Math.max(h.length, ...body.slice(0, 200).map((r) => String(r[i] ?? "").length)) + 2) }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Data");
    download(`${fileName()}.xlsx`, new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  };
  const applyPreset = (preset) => { setWho(preset.who); setOnly(preset.only); setColumns(preset.columns); setNarrow({ group: "", denomination: "", country: "", bishop: "" }); };
  const toggle = (list, set) => (key) => set(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  return (
    <section className="reg-data-export">
      <p className="reg-small reg-data-intro">Export any selection of bishops and pastors as an Excel or CSV file. Choose a quick export, or build your own below.</p>
      <h3>Quick Exports</h3>
      <div className="reg-preset-row">{PRESETS.map((preset) => <button key={preset.label} type="button" className="reg-secondary" onClick={() => applyPreset(preset)}>{preset.label}</button>)}</div>
      <h3>Custom Export</h3>
      <div className="reg-export-grid">
        <fieldset><legend>People</legend>
          {[["bishop", "Bishops"], ["pastor", "Pastors"], ["both", "Bishops and Pastors"]].map(([v, l]) => <label key={v} className="reg-check"><input type="radio" name="who" checked={who === v} onChange={() => setWho(v)} /> {l}</label>)}
        </fieldset>
        <fieldset><legend>Filter</legend>
          {[["group", "Group", options.group], ["denomination", "Denomination", options.denomination], ["country", "Country", options.country], ["bishop", "Bishop in Charge", options.bishop]].map(([key, label, opts]) => (
            <label key={key} className="reg-field"><span>{label}</span><select value={narrow[key]} onChange={(e) => setNarrow({ ...narrow, [key]: e.target.value })}><option value="">All</option>{opts.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
          ))}
        </fieldset>
        <fieldset><legend>Conditions</legend>
          {ONLY.map(([key, label]) => <label key={key} className="reg-check"><input type="checkbox" checked={only.includes(key)} onChange={() => toggle(only, setOnly)(key)} /> {label}</label>)}
        </fieldset>
        <fieldset><legend>Columns</legend>
          <div className="reg-column-picks">{COLUMNS.map(([key, label]) => <label key={key} className="reg-check"><input type="checkbox" checked={columns.includes(key)} onChange={() => toggle(columns, setColumns)(key)} /> {label}</label>)}</div>
          <button type="button" className="reg-text" onClick={() => setColumns(columns.length === COLUMNS.length ? DEFAULT_COLUMNS : COLUMNS.map(([k]) => k))}>{columns.length === COLUMNS.length ? "Default Columns" : "Select All Columns"}</button>
        </fieldset>
      </div>
      <div className="reg-export-actions">
        <div className="reg-switch" role="group" aria-label="File Format">
          {[["xlsx", "Excel"], ["csv", "CSV"]].map(([v, l]) => <button key={v} type="button" aria-pressed={format === v} className={format === v ? "active" : ""} onClick={() => setFormat(v)}>{l}</button>)}
        </div>
        <p className="reg-small" role="status"><b>{rows.length.toLocaleString()}</b> {rows.length === 1 ? "Record" : "Records"} · {chosen.length} {chosen.length === 1 ? "Column" : "Columns"}</p>
        <button type="button" className="reg-primary" disabled={!rows.length || !chosen.length} onClick={exportNow}>Download {format === "csv" ? "CSV" : "Excel"} →</button>
      </div>
      {rows.length > 0 && (
        <table className="reg-table reg-export-preview"><thead><tr>{chosen.slice(0, 6).map(([key, label]) => <th key={key}>{label}</th>)}</tr></thead>
          <tbody>{rows.slice(0, 8).map((p) => <tr key={p.id}>{chosen.slice(0, 6).map(([key, , get]) => <td key={key}>{get(p)}</td>)}</tr>)}</tbody></table>
      )}
      {rows.length > 8 && <p className="reg-small">Preview of the first 8 of {rows.length.toLocaleString()} records. The file includes all of them.</p>}
    </section>
  );
}
