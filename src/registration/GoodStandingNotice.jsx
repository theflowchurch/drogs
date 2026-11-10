// The Roll of Good Standing declaration (office, 10 Nov), at the foot of both
// bishops' pages. Adapted for bishops from the licensed-minister notice the
// church sites use, so the two say the same thing in the same way.
export default function GoodStandingNotice({ className = '' }) {
  return <section className={`good-standing ${className}`} aria-labelledby="good-standing-title">
    <small>Roll of Good Standing</small>
    <h2 id="good-standing-title">What It Means To Be A Bishop In Good Standing</h2>
    <p>A bishop is in good standing when he or she fulfills the requirements, expectations and responsibilities of the office as determined. A bishop in good standing is entitled to exercise the rights, privileges, titles and functions attached to the office of a bishop.</p>
    <h3>When A Bishop Is Not In Good Standing</h3>
    <p>A bishop who is not in good standing is not entitled to exercise the rights, privileges, titles or functions of the office for the period in which they remain out of good standing. The following restrictions apply:</p>
    <ul>
      <li>You may not use the title or designation of a bishop.</li>
      <li>You may not present or describe yourself as a bishop, whether privately, publicly, professionally, online or in official correspondence.</li>
      <li>You may not attend meetings, councils, conferences or other forums reserved for bishops in good standing.</li>
      <li>You may not wear or use the garments, insignia, identification, jewellery or other items assigned to bishops.</li>
      <li>You may not exercise privileges or receive courtesies attached to the office of a bishop.</li>
      <li>You may not perform functions or services reserved for bishops.</li>
      <li>You may be required to withdraw from official communication channels, including WhatsApp groups, mailing lists, directories and other forums reserved for bishops.</li>
      <li>Your name will not appear on the Roll of Good Standing.</li>
    </ul>
    <h3>Restoration Of Good Standing</h3>
    <p>Being out of good standing does not necessarily mean permanent removal from ministry or permanent loss of office. A bishop’s good standing may be restored when the requirements and expectations of the office have been satisfied.</p>
    <p>Upon restoration, the bishop’s name may be returned to the Roll of Good Standing, together with the rights, functions, recognition and privileges of the office.</p>
  </section>;
}
