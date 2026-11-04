import './set3.css';

// Contour rings around a few summits; each ring is the same wobbly outline scaled, so rings nest without crossing.
const ring = (cx, cy, r, seed) => Array.from({ length: 73 }, (_, i) => {
  const t = (i / 72) * Math.PI * 2;
  const k = r * (1 + 0.16 * Math.sin(3 * t + seed) + 0.08 * Math.sin(5 * t + seed * 2) + 0.05 * Math.cos(2 * t - seed));
  return `${i ? 'L' : 'M'}${(cx + Math.cos(t) * k * 1.25).toFixed(1)} ${(cy + Math.sin(t) * k).toFixed(1)}`;
}).join('') + 'Z';
const topoRings = [[770, 250, 30, 11, 0.7], [140, 560, 28, 7, 2.1], [430, 30, 22, 3, 4.2]]
  .flatMap(([cx, cy, step, n, seed]) => Array.from({ length: n }, (_, k) => ({ d: ring(cx, cy, step * (k + 1), seed), index: (k + 1) % 5 === 0 })));

// Longest word in the name, so wide display type can shrink until that word fits on one line.
const fit = c => ({ '--word': Math.max(6, ...c.shortName.split(/\s+/).map(w => w.length)) });

const tickerText = name => `${name} ▲ MINISTERIAL DIRECTORY ▲ BISHOPS ▲ PASTORS ▲ `;
const Ticker = ({ text, className }) => <div className={`tickertape-band landing-motion ${className}`} aria-hidden="true"><div className="tickertape-track">{[0, 1].map(k => <span key={k}>{text.repeat(4)}</span>)}</div></div>;

// Landing compositions: each receives { config, mark, title, description, action, label, Art, masthead }.
export default {
  halftone: p => <div className="halftone-page" style={fit(p.config)}>
    <div className="halftone-panel halftone-hero-panel">
      <div className="halftone-dots" aria-hidden="true"><i/></div>
      <div className="halftone-caption">{p.label}</div>
      {p.title}
    </div>
    <div className="halftone-panel halftone-burst-panel"><div className="halftone-burst">{p.mark}</div></div>
    <div className="halftone-panel halftone-copy-panel">{p.description}{p.action}</div>
  </div>,

  tickertape: p => <>
    <Ticker text={tickerText(p.config.name)} className="tickertape-top"/>
    <div className="tickertape-body" style={fit(p.config)}>
      <div className="tickertape-head">{p.label}{p.title}</div>
      <div className="tickertape-side"><div className="tickertape-mark">{p.mark}</div>{p.description}{p.action}</div>
    </div>
    <div className="tickertape-cross">
      <Ticker text={tickerText('LICENSED MINISTERS')} className="tickertape-a"/>
      <Ticker text={tickerText(p.config.name)} className="tickertape-b"/>
    </div>
  </>,

  notebook: p => <>
    <p.Art count={3} className="notebook-holes"/>
    <div className="notebook-header"><span>Subject: {p.config.name}</span><span>No. 01</span></div>
    <div className="notebook-page">
      <div className="notebook-copy">
        {p.label}{p.title}
        <svg className="notebook-scribble" viewBox="0 0 400 20" preserveAspectRatio="none" aria-hidden="true"><path d="M4 13C60 4 110 18 170 10S300 4 396 9"/></svg>
        {p.description}
        <div className="notebook-action">{p.action}</div>
      </div>
      <div className="notebook-photo"><div>{p.mark}</div><span>Bishops &amp; pastors</span></div>
    </div>
  </>,

  invitation: p => <div className="invitation-env">
    <div className="invitation-back" aria-hidden="true"/>
    <div className="invitation-card">{p.label}<span className="invitation-ornament" aria-hidden="true">❦</span>{p.title}{p.description}</div>
    <div className="invitation-pocket"><div className="invitation-seal">{p.mark}</div>{p.action}</div>
  </div>,

  stack: p => <>
    <div className="stack-copy" style={fit(p.config)}>{p.label}{p.title}{p.description}{p.action}</div>
    <div className="stack-fan" style={fit(p.config)}>
      <p.Art count={4} className="stack-backs"/>
      <div className="stack-front">
        <span className="stack-index">B<small>✦</small></span>
        <div className="stack-face">{p.mark}</div>
        <span className="stack-index stack-index-flip">P<small>✦</small></span>
      </div>
    </div>
  </>,

  catalogcard: p => <div className="catalogcard-drawer">
    <div className="catalogcard-card">
      <div className="catalogcard-head"><span>262.14</span><span>{p.config.name}</span><div className="catalogcard-stamp">{p.mark}</div></div>
      {p.label}{p.title}{p.description}
      <p className="catalogcard-tracing">1. Bishops. 2. Pastors. 3. Licensed ministers. I. Title.</p>
      <div className="catalogcard-foot">{p.action}</div>
    </div>
    <aside className="catalogcard-front" aria-hidden="true"><div className="catalogcard-label"><b>Directory</b><span>A – Z</span></div><i/></aside>
  </div>,

  topo: p => <>
    <svg className="topo-map" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {topoRings.map((r, i) => <path key={i} d={r.d} className={r.index ? 'topo-index' : undefined}/>)}
    </svg>
    <div className="topo-frame" aria-hidden="true"><span>A</span><span>B</span><span>C</span><span>D</span></div>
    <div className="topo-body">
      <div className="topo-copy">{p.label}{p.title}{p.description}{p.action}</div>
      <div className="topo-pin"><div className="topo-pin-head">{p.mark}</div><span>▲ Summit · licensed ministers</span></div>
    </div>
    <div className="topo-legend" aria-hidden="true"><span className="topo-north">N</span><span className="topo-scale"><i/><i/><i/><i/></span><span>Contour interval · one fellowship</span></div>
  </>,

  sunburst: p => <>
    <p.Art count={1} className="sunburst-rays"/>
    <div className="sunburst-copy">{p.label}{p.title}{p.description}{p.action}</div>
    <div className="sunburst-sun"><div className="sunburst-mark">{p.mark}</div></div>
  </>,

  azulejo: p => <div className="azulejo-wall">
    <div className="azulejo-medallion">{p.mark}</div>
    <div className="azulejo-panel">{p.label}{p.title}<span className="azulejo-rule" aria-hidden="true"/>{p.description}{p.action}</div>
  </div>,

  weave: p => <>
    <div className="weave-copy">{p.label}{p.title}{p.description}{p.action}</div>
    <div className="weave-stole">
      <svg className="weave-cloth" aria-hidden="true">
        <defs>
          <linearGradient id="weave-h"><stop offset="0" stopColor="#000" stopOpacity=".28"/><stop offset=".5" stopColor="#000" stopOpacity="0"/><stop offset="1" stopColor="#000" stopOpacity=".28"/></linearGradient>
          <linearGradient id="weave-v" x2="0" y2="1"><stop offset="0" stopColor="#000" stopOpacity=".22"/><stop offset=".5" stopColor="#000" stopOpacity="0"/><stop offset="1" stopColor="#000" stopOpacity=".22"/></linearGradient>
          <pattern id="weave-p" width="36" height="36" patternUnits="userSpaceOnUse">
            <rect width="36" height="36" className="weave-gap"/>
            <rect x="1" y="1" width="16" height="16" className="weave-warp"/><rect x="1" y="1" width="16" height="16" fill="url(#weave-h)"/>
            <rect x="18" y="1" width="18" height="16" className="weave-weft"/><rect x="18" y="1" width="18" height="16" fill="url(#weave-v)"/>
            <rect x="0" y="19" width="18" height="16" className="weave-weft"/><rect x="0" y="19" width="18" height="16" fill="url(#weave-v)"/>
            <rect x="19" y="18" width="16" height="18" className="weave-warp"/><rect x="19" y="18" width="16" height="18" fill="url(#weave-h)"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#weave-p)"/>
      </svg>
      <div className="weave-label">{p.mark}<span>Ministerial directory</span></div>
    </div>
  </>,
};
