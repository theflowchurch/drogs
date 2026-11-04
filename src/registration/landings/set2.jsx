import './set2.css';

// Guilloche: interlaced sine strands tiled with a real-pixel SVG pattern, plus hypotrochoid corner rosettes.
const strands = Array.from({ length: 5 }, (_, k) => {
  let d = '';
  for (let x = 0; x <= 48; x += 2) d += `${x ? 'L' : 'M'}${x} ${(17 + (6 + k * 2.2) * Math.sin((x / 48) * Math.PI * 2 + k * 0.7)).toFixed(2)}`;
  return d;
});
const rosette = (() => {
  let d = '';
  for (let i = 0; i <= 720; i++) {
    const t = (i / 720) * Math.PI * 14, R = 21, r = 6, o = 11;
    d += `${i ? 'L' : 'M'}${((R - r) * Math.cos(t) + o * Math.cos(((R - r) / r) * t)).toFixed(2)} ${((R - r) * Math.sin(t) - o * Math.sin(((R - r) / r) * t)).toFixed(2)}`;
  }
  return d;
})();
const Band = ({ side }) => {
  const id = `certificate-band-${side}`;
  return <svg className={`certificate-band certificate-band-${side}`} aria-hidden="true">
    <defs><pattern id={id} width="48" height="34" patternUnits="userSpaceOnUse" patternTransform={side === 'left' || side === 'right' ? 'rotate(90)' : undefined}>
      {strands.map((d, k) => <path key={k} d={d} fill="none" stroke="currentColor" strokeWidth=".7" opacity={0.45 + k * 0.1}/>)}
    </pattern></defs>
    <rect width="100%" height="100%" fill={`url(#${id})`}/>
  </svg>;
};
const Rosette = ({ at }) => <svg className={`certificate-rosette certificate-rosette-${at}`} viewBox="-34 -34 68 68" aria-hidden="true"><circle r="33" fill="#fbf7ea"/><path d={rosette} fill="none" stroke="currentColor" strokeWidth=".45"/><circle r="31" fill="none" stroke="currentColor" strokeWidth=".8"/></svg>;
const Pin = () => <i className="corkboard-pin" aria-hidden="true"/>;

// Landing compositions: each receives { config, mark, title, description, action, label, Art, masthead }.
export default {
  console: p => <div className="console-app">
    <div className="console-bar" aria-hidden="true"><span className="console-dots"><i/><i/><i/></span><span className="console-path">directory / <b>overview</b></span><span className="console-live">Public</span></div>
    <aside className="console-side">
      <div className="console-org">{p.mark}</div>
      <div className="console-nav" aria-hidden="true"><span>Overview</span><span>Bishops</span><span>Pastors</span><span>Licences</span><span>Regions</span></div>
    </aside>
    <div className="console-main">
      <section className="console-panel console-hero">{p.label}{p.title}{p.description}{p.action}</section>
      <div className="console-side-panels" aria-hidden="true">
        <div className="console-panel console-chart"><span className="console-cap">Directory index<b>Live</b></span><p.Art count={16} className="console-bars"/></div>
        <div className="console-stats">
          <div className="console-panel"><span className="console-cap">Register</span><strong>Licensed</strong><small>Bishops · Pastors</small></div>
          <div className="console-panel"><span className="console-cap">Status</span><strong>Verified</strong><small>Reviewed records</small></div>
        </div>
      </div>
    </div>
  </div>,

  chalk: p => <div className="chalk-board">
    <p.Art count={5} className="chalk-smudge"/>
    <div className="chalk-copy">
      {p.label}{p.title}
      <svg className="chalk-underline" viewBox="0 0 420 24" preserveAspectRatio="none" aria-hidden="true"><path d="M3 15 C 80 4, 170 22, 250 10 S 380 6, 417 13 M 30 20 C 120 12, 260 22, 400 17"/></svg>
      {p.description}
      <div className="chalk-cta">{p.action}<span className="chalk-note" aria-hidden="true"><svg viewBox="0 0 90 50"><path d="M86 8 C 60 2, 30 10, 12 34 M 12 34 L 10 18 M 12 34 L 27 30"/></svg>start here</span></div>
    </div>
    <div className="chalk-mark"><span className="chalk-tape" aria-hidden="true"/>{p.mark}<svg className="chalk-ring" viewBox="0 0 200 200" aria-hidden="true"><path d="M104 8 C 160 6, 194 50, 192 102 C 190 158, 146 194, 96 192 C 44 190, 8 152, 10 98 C 12 48, 52 12, 112 14"/></svg></div>
    <div className="chalk-ledge" aria-hidden="true"><i/><i/><i/></div>
  </div>,

  neon: p => <>
    <p.Art count={2} className="neon-haze"/>
    <div className="neon-mark">{p.mark}</div>
    <div className="neon-sign">{p.label}{p.title}</div>
    <div className="neon-street">{p.description}{p.action}</div>
  </>,

  folder: p => <div className="folder">
    <div className="folder-tabs" aria-hidden="true"><span>Directory</span><span>Bishops</span><span>Pastors</span></div>
    <div className="folder-sheet" aria-hidden="true"/>
    <div className="folder-body">
      <div className="folder-side">
        <div className="folder-photo"><svg className="folder-clip" viewBox="0 0 24 64" aria-hidden="true"><path d="M8 52 V12 a5 5 0 0 1 10 0 V54 a8 8 0 0 1 -16 0 V18"/></svg>{p.mark}</div>
        <dl className="folder-index" aria-hidden="true"><div><dt>Subject</dt><dd>Licensed ministers</dd></div><div><dt>Status</dt><dd>Current</dd></div></dl>
      </div>
      <div className="folder-copy">{p.label}{p.title}{p.description}{p.action}</div>
      <span className="folder-stamp" aria-hidden="true">Licensed</span>
    </div>
  </div>,

  timeline: p => <div className="timeline-rail">
    <div className="timeline-step timeline-origin"><span className="timeline-when">Origin</span><div className="timeline-node">{p.mark}</div><div className="timeline-body">{p.label}<span className="timeline-org">{p.config.name}</span></div></div>
    <div className="timeline-step timeline-name"><span className="timeline-when">01 · Church</span><i className="timeline-dot"/><div className="timeline-body">{p.title}</div></div>
    <div className="timeline-step"><span className="timeline-when">02 · Register</span><i className="timeline-dot"/><div className="timeline-body">{p.description}</div></div>
    <div className="timeline-step timeline-next"><span className="timeline-when">03 · Next</span><i className="timeline-dot"/><div className="timeline-body">{p.action}</div></div>
  </div>,

  corkboard: p => <div className="corkboard">
    <div className="corkboard-paper"><Pin/>{p.label}{p.title}</div>
    <figure className="corkboard-photo"><span className="corkboard-tape" aria-hidden="true"/>{p.mark}<figcaption>{p.config.name}</figcaption></figure>
    <div className="corkboard-note"><Pin/>{p.description}</div>
    <div className="corkboard-tag"><Pin/>{p.action}</div>
  </div>,

  hardcover: p => <>
    <div className="hardcover-book">
      <div className="hardcover-spine" aria-hidden="true"><span>{p.config.shortName}</span></div>
      <div className="hardcover-cover"><div className="hardcover-frame">
        <span className="hardcover-orn" aria-hidden="true"/>{p.title}<span className="hardcover-orn" aria-hidden="true"/>
        <span className="hardcover-foot" aria-hidden="true">Ministerial Directory</span>
      </div></div>
      <i className="hardcover-ribbon" aria-hidden="true"/>
    </div>
    <div className="hardcover-copy">
      {p.label}
      <dl className="hardcover-meta"><div><dt>Contents</dt><dd>Licensed bishops and pastors</dd></div><div><dt>Binding</dt><dd>Public register, kept current</dd></div></dl>
      {p.description}{p.action}
      <div className="hardcover-imprint"><span>Published by</span>{p.mark}</div>
    </div>
  </>,

  certificate: p => <div className="certificate-sheet">
    {['top', 'bottom', 'left', 'right'].map(s => <Band key={s} side={s}/>)}
    {['tl', 'tr', 'bl', 'br'].map(a => <Rosette key={a} at={a}/>)}
    <div className="certificate-inner">
      <div className="certificate-mark">{p.mark}</div>
      {p.label}
      <p className="certificate-presents">The official register of</p>
      {p.title}
      <span className="certificate-rule" aria-hidden="true"/>
      {p.description}
      <div className="certificate-foot">
        <span className="certificate-sign" aria-hidden="true"><svg viewBox="0 0 160 40"><path d="M6 30 C 20 4, 30 4, 28 26 S 48 8, 58 22 S 80 30, 92 14 C 98 6, 104 32, 116 20 S 140 18, 154 12"/></svg>Registrar</span>
        {p.action}
        <span className="certificate-sign" aria-hidden="true"><svg viewBox="0 0 160 40"><path d="M8 24 C 30 10, 40 34, 60 20 S 84 6, 96 24 C 104 34, 120 8, 152 18"/></svg>Keeper of records</span>
      </div>
    </div>
  </div>,

  plaque: p => <>
    <div className="plaque-lamp" aria-hidden="true"/>
    <div className="plaque-plate">
      {[0, 1, 2, 3].map(k => <i key={k} className="plaque-screw" aria-hidden="true"/>)}
      <div className="plaque-face">
        <div className="plaque-medal">{p.mark}</div>
        <div className="plaque-text">{p.label}{p.title}{p.description}{p.action}</div>
      </div>
    </div>
  </>,

  aurora: p => <>
    <p.Art count={5} className="aurora-mesh"/>
    <div className="aurora-top"><div className="aurora-pill">{p.mark}{p.label}</div><span className="aurora-meta" aria-hidden="true">Bishops · Pastors</span></div>
    <div className="aurora-copy">{p.title}<div className="aurora-row">{p.description}{p.action}</div></div>
  </>,
};
