import { LegalFooter, renderMarkdown } from './Docs';
import { LEGAL_PAGES, POLICY_DATE } from './legal.mjs';

const base = process.env.NEXT_PUBLIC_BASE_PATH || '';

export default function PublicInformation({ slug }) {
  const page = LEGAL_PAGES.find(item => item.slug === slug);
  // Only trusted, source-controlled Markdown is rendered here.
  const markdown = page.markdown.replace(/\]\(\/(?!\/)/g, `](${base}/`);
  return (
    <div className="reg-app reg-information-page">
      <header className="reg-header">
        <a className="reg-brand" href={`${base}/`} aria-label="Kuriake Castle home">
          <span className="reg-brand-mark"><img src={`${base}/assets/brand/castle-blue.png`} alt="" /></span>
          <strong>Kuriake Castle</strong>
        </a>
        <a className="reg-text" href={`${base}/directory/`}>Directory ↗</a>
      </header>
      <div className="reg-information-layout">
        <aside className="reg-information-sidebar">
          <p className="reg-eyebrow">Kuriake Castle</p>
          <nav aria-label="Information pages">
            {LEGAL_PAGES.map(item => <a key={item.slug} href={`${base}/${item.slug}/`} aria-current={item.slug === slug ? 'page' : undefined}>{item.label}</a>)}
          </nav>
          <p className="reg-information-date">Effective date<br />{POLICY_DATE}</p>
        </aside>
        <main id="main-content" className="reg-docs reg-information-content">
          <article dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }} />
          <a className="reg-information-back" href={`${base}/`}>← Back to Kuriake Castle</a>
        </main>
      </div>
      <LegalFooter />
    </div>
  );
}
