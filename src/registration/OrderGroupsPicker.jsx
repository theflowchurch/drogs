"use client";
import { orderGroupOptions } from "./order-choices.mjs";

// Office, 19 Nov: a bishop ticks every group they belong to on the Order of
// Bishops pages, and may give their role in each (Chairman, Secretary…), or
// leave it blank. Their country and church come from their own details.
export default function OrderGroupsPicker({ structure, value = [], onChange }) {
  const sections = orderGroupOptions(structure);
  const chosen = new Map(value.map((c) => [c.slug, c]));
  const toggle = (slug, on) => onChange(on ? [...value, { slug, role: "" }] : value.filter((c) => c.slug !== slug));
  const setRole = (slug, role) => onChange(value.map((c) => (c.slug === slug ? { ...c, role } : c)));
  return (
    <div className="reg-order-groups">
      <p className="reg-small">Tick every group you belong to on the Order of Bishops pages. You can choose more than one. A role is optional.</p>
      {sections.map((s) => {
        const count = s.options.filter((o) => chosen.has(o.slug)).length;
        return (
          <details key={s.name} className="reg-order-section" open={count > 0}>
            <summary><span>{s.name}</span>{count > 0 && <b>{count} chosen</b>}</summary>
            <div className="reg-order-options">
              {s.options.map((o) => {
                const c = chosen.get(o.slug);
                return (
                  <div key={o.slug} className={`reg-order-option ${c ? "is-on" : ""}`}>
                    <label><input type="checkbox" checked={Boolean(c)} onChange={(e) => toggle(o.slug, e.target.checked)} /> {o.name}</label>
                    {c && <input className="reg-order-role" value={c.role} maxLength={80} placeholder="Your role (optional), e.g. Chairman" aria-label={`Your role in ${o.name} (optional)`} onChange={(e) => setRole(o.slug, e.target.value)} />}
                  </div>
                );
              })}
            </div>
          </details>
        );
      })}
    </div>
  );
}
