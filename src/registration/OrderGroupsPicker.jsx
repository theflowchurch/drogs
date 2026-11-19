"use client";
import { useState } from "react";
import { orderGroupOptions } from "./order-choices.mjs";

// Office, 19 Nov: a bishop ticks every group they belong to on the Order of
// Bishops pages, and may give their role in each (Chairman, Secretary…), or
// leave it blank. Their country and church come from their own details.
// One tidy row per group, a search, and what is chosen shown at the top.
export default function OrderGroupsPicker({ structure, value = [], onChange }) {
  const sections = orderGroupOptions(structure);
  const names = new Map(sections.flatMap((s) => s.options.map((o) => [o.slug, o.name])));
  const chosen = new Map(value.map((c) => [c.slug, c]));
  const [q, setQ] = useState(""), [open, setOpen] = useState(() => new Set(sections.filter((s) => s.options.some((o) => chosen.has(o.slug))).map((s) => s.name)));
  const toggle = (slug, on) => onChange(on ? [...value, { slug, role: "" }] : value.filter((c) => c.slug !== slug));
  const setRole = (slug, role) => onChange(value.map((c) => (c.slug === slug ? { ...c, role } : c)));
  const term = q.trim().toLowerCase();
  const flip = (name) => setOpen((s) => { const n = new Set(s); n.has(name) ? n.delete(name) : n.add(name); return n; });
  return (
    <div className="reg-order-groups">
      <p className="reg-small">Tick every group you belong to on the Order of Bishops pages. You can choose more than one, and add your role in each if you have one.</p>
      <div className="reg-order-chosen" aria-live="polite">
        {value.length ? value.map((c) => (
          <span key={c.slug} className="reg-order-chip">{names.get(c.slug) || c.slug}{c.role && <em> · {c.role}</em>}
            <button type="button" aria-label={`Remove ${names.get(c.slug) || c.slug}`} onClick={() => toggle(c.slug, false)}>×</button></span>
        )) : <span className="reg-small">No groups chosen yet.</span>}
      </div>
      <input className="reg-order-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a group, e.g. Adjutancy or UD Ghana" aria-label="Find a group" />
      {sections.map((s) => {
        const options = s.options.filter((o) => !term || o.name.toLowerCase().includes(term));
        if (!options.length) return null;
        const count = s.options.filter((o) => chosen.has(o.slug)).length;
        const isOpen = Boolean(term) || open.has(s.name);
        return (
          <section key={s.name} className="reg-order-section">
            <button type="button" className="reg-order-head" aria-expanded={isOpen} onClick={() => flip(s.name)}>
              <span>{s.name}</span><span className="reg-order-meta">{count > 0 && <b>{count} chosen</b>}<i aria-hidden="true">{isOpen ? "−" : "+"}</i></span>
            </button>
            {isOpen && <ul className="reg-order-list">
              {options.map((o) => {
                const c = chosen.get(o.slug);
                return (
                  <li key={o.slug} className={c ? "is-on" : ""}>
                    <label><input type="checkbox" checked={Boolean(c)} onChange={(e) => toggle(o.slug, e.target.checked)} /><span>{o.name}</span></label>
                    {c && <input className="reg-order-role" value={c.role} maxLength={80} placeholder="Role (optional)" aria-label={`Your role in ${o.name} (optional)`} onChange={(e) => setRole(o.slug, e.target.value)} />}
                  </li>
                );
              })}
            </ul>}
          </section>
        );
      })}
    </div>
  );
}
