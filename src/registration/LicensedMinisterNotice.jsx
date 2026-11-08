'use client';

// The office's existing explanation, using the requested public terminology.
// Kept in one place so every church publishes the same requirements.
// `open` (a church's openLicenseNotice) shows the whole text with no label or
// expand button; otherwise the summary expands to the full requirements.
export default function LicensedMinisterNotice({ open = false }) {
  const heading = <h2>What It Means To Be A Licensed Minister</h2>;
  const intro = <p className="denom-license-preview">A bishop, reverend or pastor is a licensed minister when he or she fulfills the requirements, expectations, and responsibilities of the office as determined. A licensed minister is entitled to exercise the rights, privileges, titles, and functions attached to that ministerial office.</p>;
  const full = <div className="denom-license-full">
        <h3>When A Minister Is Not Licensed</h3>
        <p>A bishop, reverend or pastor who is not licensed is not entitled to exercise the rights, privileges, titles, or functions attached to that ministerial office for the period in which they remain unlicensed.</p>
        <p>While a bishop, reverend or pastor is not licensed in their office, the following restrictions apply:</p>
        <ul>
          <li>You may not use the title or designation of the office in which you are not licensed.</li>
          <li>You may not present or describe yourself as holding the office of a bishop, reverend or pastor, whether privately, publicly, professionally, online, or in official correspondence.</li>
          <li>You may not attend meetings, councils, conferences, or other forums specifically reserved for licensed bishops, reverends and pastors.</li>
          <li>You may not wear or use official garments, insignia, identification, jewellery, or other items specifically assigned to bishops, reverends and pastors.</li>
          <li>You may not exercise privileges or receive courtesies that are specifically attached to bishops, reverends and pastors.</li>
          <li>You may not perform functions or services that are reserved for bishops, reverends and pastors.</li>
          <li>You may be required to withdraw from official communication channels, including WhatsApp groups, mailing lists, directories, and other forums reserved for bishops, reverends and pastors.</li>
          <li>Your name will not appear in the directory of licensed bishops, reverends and pastors.</li>
        </ul>
        <h3>Restoration Of A Minister’s Licence</h3>
        <p>Being unlicensed does not necessarily mean permanent removal from ministry or permanent loss of office.</p>
        <p>A bishop, reverend or pastor’s licence may be restored when the requirements and expectations of the office have been satisfied.</p>
        <p>Upon restoration, the minister’s name may be returned to the directory of licensed ministers, together with the rights, functions, recognition, and privileges applicable to that office.</p>
      </div>;
  return <section className={`denom-license ${open ? 'denom-license-open' : ''}`} aria-label="About licensed ministry">
    {open ? <>{heading}{intro}{full}</> : <details>
      <summary><div><small>ABOUT LICENSED MINISTRY</small>{heading}{intro}</div><span className="denom-license-toggle" aria-hidden="true">+</span></summary>
      {full}
    </details>}
  </section>;
}
