// HELD DRAFT (office, 20 Nov): not part of the site build. Waiting for leadership to confirm
// the licensing policy. To restore: move this route to src/app/(portal)/licensing/page.jsx
// and the component and text below back into src/registration/CastleSite.jsx.

import { CastleLicensingPage } from '../../../registration/CastleSite';
// Office, 20 Nov: what Kuriake Castle's licensing and registration mean.
export const metadata = { title: 'Licensing and Registration · Kuriake Castle', description: 'How Kuriake Castle’s ecclesiastical licensing, annual registration and Roll of Good Standing work, and what they do not cover.' };
export default function Page() { return <CastleLicensingPage />; }

/* --- text and component, held ---
// DRAFT, held (office, 20 Nov): the Licensing and Registration page waits for leadership to confirm the policy; its route is in drafts/licensing-page.jsx and nothing links to it.
const LICENSING_LEAD = "Kuriake Castle’s licensing records ecclesiastical recognition within the fellowship. Each participating denomination or group retains authority over its own leadership appointments, governance, finances and operations.";
const LICENSING_QA = [
  ["What does a Kuriake Castle licence confirm?", "That a bishop or pastor serving in a participating denomination or group has registered for the year and been confirmed, and is recognised within the fellowship. It is not a government licence and gives no legal or statutory powers."],
  ["Who can apply?", "Bishops and pastors, including reverends, who serve in a denomination or group participating in the fellowship. Licensing is for individual ministers; it is not a licence for a church, denomination or group."],
  ["Who confirms and approves registration?", "A pastor’s bishop confirms that the pastor serves under them. A bishop’s registration is confirmed by the Kuriake Castle office, which also checks the records submitted."],
  ["What is the Roll of Good Standing?", "The public register of bishops and pastors whose registration has been confirmed for the current year. Anyone can search it to check a minister’s standing within the fellowship."],
  ["Why is renewal annual?", "So that the register stays current. Each year ministers confirm their details, and the Roll shows those confirmed for that year."],
  ["What happens if a licence is not renewed?", "After the registration deadline, a minister who has not renewed no longer appears on the public Roll for that year. Their record is kept, and they return to the Roll once they renew and are confirmed."],
  ["Does licensing give Kuriake Castle authority over a denomination or group?", "No. As the Declaration sets out, Kuriake Castle does not govern any denomination, group or local church. Each denomination or group appoints and removes its own leaders and manages its own governance, finances and operations."],
];

export function CastleLicensingPage() {
  return <TopicPage eyebrow="Kuriake Castle" title="Licensing and Registration" lead={LICENSING_LEAD}>
    <section className="kc-licensing kc-page-body">
      {LICENSING_QA.map(([q, a]) => <article key={q}><h2>{q}</h2><p>{a}</p></article>)}
      <div className="kc-licensing-links">
        <More to="signup">Register or renew online</More>
        <More to="directory">Search the Roll of Good Standing</More>
        <More to="declaration">Read the Declaration</More>
      </div>
    </section>
  </TopicPage>;
}
*/
