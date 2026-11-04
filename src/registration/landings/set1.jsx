import './set1.css';

// Landing compositions: each receives { config, mark, title, description, action, label, Art, masthead }.
const initials = name => name.split(/[\s-]+/).filter(w => /^[A-Za-z]/.test(w)).map(w => w[0].toUpperCase()).join('').slice(0, 3);
const longest = name => Math.max(...name.split(/\s+/).map(w => w.length));
const mrz = (text, n = 44) => (text.toUpperCase().normalize('NFD').replace(/[^A-Z0-9]+/g, '<') + '<'.repeat(n)).slice(0, n);
// 120-tooth serrated edge for the embossed seal.
const sealEdge = `polygon(${Array.from({ length: 120 }, (_, i) => {
  const r = i % 2 ? 47.5 : 50, a = i * Math.PI / 60;
  return `${(50 + r * Math.cos(a)).toFixed(2)}% ${(50 + r * Math.sin(a)).toFixed(2)}%`;
}).join(',')})`;

export default {
  splitscreen: p => <>
    <div className="splitscreen-top"><div>{p.label}</div><div className="splitscreen-mark">{p.mark}</div></div>
    <div className="splitscreen-title">{p.title}</div>
    <div className="splitscreen-bottom"><div>{p.description}</div><div>{p.action}</div></div>
    <p.Art count={1} className="splitscreen-art"/>
  </>,

  passport: p => <div className="passport-page">
    <div className="passport-head">{p.label}<span>Republic of licensed ministry · Passeport</span></div>
    <div className="passport-body">
      <div className="passport-photo">{p.mark}<span>{initials(p.config.shortName)}</span></div>
      <div className="passport-data">
        <span className="passport-field">Name of church / Nom de l’église</span>
        {p.title}
        <dl className="passport-row">
          <div><dt>Type</dt><dd>Directory</dd></div>
          <div><dt>Code</dt><dd>{initials(p.config.name) || 'DIR'}</dd></div>
          <div><dt>Holders</dt><dd>Bishops · Pastors</dd></div>
        </dl>
        {p.description}
        {p.action}
      </div>
    </div>
    <div className="passport-stamp" aria-hidden="true"><b>Licensed</b><span>Ministerial directory</span></div>
    <div className="passport-mrz" aria-hidden="true"><span>{mrz(`P<DIR<${p.config.name}`)}</span><span>{mrz(`${initials(p.config.name)}0000001<MINISTERS<LICENSED`)}</span></div>
  </div>,

  ticket: p => <div className="ticket-shadow"><div className="ticket-card">
    <div className="ticket-main" style={{ '--longest': longest(p.config.shortName) }}>
      <div className="ticket-head">{p.label}<span>Nº 000001</span></div>
      <span className="ticket-admit">Admit one</span>
      {p.title}
      <div className="ticket-foot">{p.description}{p.action}</div>
    </div>
    <div className="ticket-stub">
      <span className="ticket-stub-text">Licensed bishops &amp; pastors</span>
      <div className="ticket-mark">{p.mark}</div>
      <span className="ticket-barcode" aria-hidden="true"/>
      <span className="ticket-keep">Keep this stub</span>
    </div>
  </div></div>,

  vertical: p => <>
    <div className="vertical-column" style={{ '--longest': longest(p.config.shortName) }}>{p.title}</div>
    <div className="vertical-side">
      <div className="vertical-top">{p.label}<div className="vertical-mark">{p.mark}</div></div>
      <div className="vertical-copy">{p.description}{p.action}</div>
    </div>
    <p.Art count={1} className="vertical-ruler"/>
  </>,

  magazine: p => <>
    <div className="magazine-dateline"><span>Vol. 01</span>{p.label}<span>Licensed edition</span></div>
    <div className="magazine-nameplate">{p.title}</div>
    <div className="magazine-cover">
      <div className="magazine-lines">
        <p><b>Bishops</b>Ordained and in good standing</p>
        <p><b>Pastors</b>Every licensed minister, listed</p>
        <p><b>Inside</b>Search by name, city or office</p>
      </div>
      <div className="magazine-image"><p.Art count={3} className="magazine-gloss"/><div className="magazine-mark">{p.mark}</div><span className="magazine-sticker">The full<br/>directory</span></div>
      <div className="magazine-lines magazine-feature">
        <span className="magazine-exclusive">Cover story</span>
        {p.description}
        {p.action}
        <span className="magazine-barcode" aria-hidden="true"/>
      </div>
    </div>
  </>,

  bento: p => <div className="bento-grid">
    <div className="bento-tile bento-title">{p.label}{p.title}</div>
    <div className="bento-tile bento-mark">{p.mark}</div>
    <div className="bento-tile bento-ring" aria-hidden="true"><i/><i/><i/></div>
    <div className="bento-tile bento-stat"><b>Bishops</b><span>Licensed and listed</span></div>
    <div className="bento-tile bento-desc">{p.description}</div>
    <div className="bento-tile bento-go">{p.action}</div>
    <div className="bento-tile bento-stat bento-stat-b"><b>Pastors</b><span>Verified records</span></div>
  </div>,

  seal: p => <>
    <div className="seal-left">{p.label}{p.title}</div>
    <div className="seal-disc">
      <div className="seal-edge" style={{ clipPath: sealEdge }}/>
      <svg className="seal-ring" viewBox="0 0 300 300" aria-hidden="true">
        <defs><path id="seal-ring-path" d="M150,150 m-121,0 a121,121 0 1,1 242,0 a121,121 0 1,1 -242,0"/></defs>
        <text><textPath href="#seal-ring-path" textLength="755" lengthAdjust="spacing">{`${p.config.name} ✦ Licensed ministers ✦ `.toUpperCase()}</textPath></text>
      </svg>
      <div className="seal-core">{p.mark}</div>
    </div>
    <div className="seal-right">{p.description}{p.action}</div>
  </>,

  stainedglass: p => <>
    <p.Art count={4} className="stainedglass-spill"/>
    <div className="stainedglass-rose">
      <div className="stainedglass-glass landing-motion" aria-hidden="true"><i/><i/><i/></div>
      <div className="stainedglass-medallion">{p.mark}</div>
    </div>
    <div className="stainedglass-copy">{p.label}{p.title}{p.description}{p.action}</div>
  </>,

  scroll: p => <div className="scroll-roll">
    <span className="scroll-rod" aria-hidden="true"/>
    <div className="scroll-sheet">
      <div className="scroll-mark">{p.mark}</div>
      {p.label}
      {p.title}
      <svg className="scroll-flourish" viewBox="0 0 240 24" aria-hidden="true"><path d="M2 12 C40 2 70 22 120 12 S200 2 238 12" fill="none" stroke="currentColor" strokeWidth="1.4"/><circle cx="120" cy="12" r="3.5" fill="currentColor"/></svg>
      {p.description}
      {p.action}
    </div>
    <span className="scroll-rod" aria-hidden="true"/>
  </div>,

  arch: p => <div className="arch-window">
    <div className="arch-light" aria-hidden="true"><i/><i/></div>
    <div className="arch-oculus">{p.mark}<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 8a20 20 0 0 1 0 40a20 20 0 0 1 0-40ZM50 52a20 20 0 0 1 0 40a20 20 0 0 1 0-40ZM8 50a20 20 0 0 1 40 0a20 20 0 0 1-40 0ZM52 50a20 20 0 0 1 40 0a20 20 0 0 1-40 0Z" fill="none" stroke="currentColor" strokeWidth="2.2"/><circle cx="50" cy="50" r="7" fill="currentColor"/></svg></div>
    {p.label}
    {p.title}
    {p.description}
    {p.action}
  </div>,
};
