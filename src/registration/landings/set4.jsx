import './set4.css';

// Landing compositions: each receives { config, mark, title, description, action, label, Art, masthead }.
// Longest word sets the sleeve type size so single words never break mid-word.
const longestWord = name => Math.max(8, ...name.split(/\s+/).map(w => w.length));
const initialOf = name => (name.replace(/^the\s+/i, '').match(/[A-Za-z0-9]/)?.[0] || '').toUpperCase();

// Low-poly crane: [points, facet shade class].
const crane = [
  ['180,192 140,38 222,190', 'd'], ['272,203 356,70 244,196', 'c'],
  ['128,203 62,58 158,196', 'b'], ['62,58 30,80 74,72', 'd'],
  ['108,205 200,178 200,246', 'a'], ['200,178 292,205 200,246', 'c'],
  ['150,196 232,18 206,198', 'a'], ['206,198 232,18 262,194', 'b'],
];
// Flags hang from the string drawn as M0 10 Q500 110 1000 10 in a 1000x120 box.
const bunting = Array.from({ length: 13 }, (_, i) => {
  const t = (40 + i * 76.6) / 1000;
  return { left: `${t * 100}%`, top: `${(10 + 200 * t * (1 - t)) / 1.2}%` };
});

export default {
  origami: p => <>
    <div className="origami-copy">
      <div className="origami-tag">{p.label}<span>Fold · 01</span></div>
      {p.title}{p.description}{p.action}
    </div>
    <div className="origami-paper">
      <div className="origami-crease" aria-hidden="true"/>
      <svg className="origami-crane landing-motion" viewBox="20 8 350 245" aria-hidden="true">
        {crane.map(([points, shade], i) => <polygon key={i} points={points} className={`origami-${shade}`}/>)}
      </svg>
      <div className="origami-mark">{p.mark}</div>
    </div>
  </>,

  louvre: p => <>
    <p.Art count={1} className="louvre-light"/>
    <div className="louvre-copy">
      <div className="louvre-head">{p.mark}{p.label}</div>
      {p.title}{p.description}{p.action}
    </div>
    <div className="louvre-window" aria-hidden="true">
      <div className="louvre-rail"/>
      <div className="louvre-slats"/>
      <div className="louvre-sill"/>
      <span className="louvre-cord"/>
    </div>
  </>,

  record: p => <>
    <p.Art count={1} className="record-glow"/>
    <div className="record-deck">
      <div className="record-disc"><div className="record-label"><div>{p.mark}</div><span>33⅓ · Side A</span></div></div>
      <div className="record-sleeve" style={{ '--fit': longestWord(p.config.shortName) }}>
        <div className="record-sleeve-top">{p.label}<span>LP · 01</span></div>
        {p.title}
        <span className="record-sleeve-foot">Licensed bishops &amp; pastors</span>
      </div>
    </div>
    <div className="record-notes">
      <ol className="record-tracks">
        <li><span>A1</span>Bishops<em>Ordained</em></li>
        <li><span>A2</span>Pastors<em>Licensed</em></li>
        <li><span>B1</span>Search the register<em>Open</em></li>
      </ol>
      {p.description}{p.action}
    </div>
  </>,

  filmstrip: p => <>
    <div className="filmstrip-copy">
      <div className="filmstrip-slate"><span>Reel 01</span><span>Take 1</span>{p.label}</div>
      {p.title}{p.description}{p.action}
    </div>
    <div className="filmstrip-reel">
      <div className="filmstrip-strip">
        <div className="filmstrip-frame filmstrip-word" aria-hidden="true"><b>Bishops</b><small>20A</small></div>
        <div className="filmstrip-frame filmstrip-word" aria-hidden="true"><b>Pastors</b><small>21</small></div>
        <div className="filmstrip-frame filmstrip-mark">{p.mark}<small>22A</small></div>
        <div className="filmstrip-frame filmstrip-word" aria-hidden="true"><b>Licensed</b><small>23</small></div>
        <div className="filmstrip-frame filmstrip-word" aria-hidden="true"><b>Directory</b><small>24A</small></div>
      </div>
    </div>
  </>,

  transit: p => <>
    <div className="transit-header">
      <span className="transit-badges" aria-hidden="true"><i>B</i><i>P</i></span>
      {p.label}
      <span className="transit-arrow" aria-hidden="true">↗</span>
    </div>
    <div className="transit-station">
      <div className="transit-mark">{p.mark}</div>
      {p.title}
    </div>
    <div className="transit-line" aria-hidden="true">
      {['Licensed', 'Pastors', 'Bishops', 'Directory'].map(stop => <span key={stop}><i/>{stop}</span>)}
    </div>
    <div className="transit-board">
      <div className="transit-info"><span className="transit-platform" aria-hidden="true">1</span>{p.description}</div>
      {p.action}
    </div>
  </>,

  pennant: p => <>
    <svg className="pennant-bunting" viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 10 Q500 110 1000 10" fill="none"/>
    </svg>
    <div className="pennant-flags" aria-hidden="true">
      {bunting.map((pos, i) => <i key={i} className="landing-motion" style={{ '--piece': i, ...pos }}/>)}
    </div>
    <div className="pennant-top">{p.label}<span>Est. licensed ministry</span></div>
    <div className="pennant-felt">
      <div className="pennant-hoist">{p.mark}</div>
      <div className="pennant-name" style={{ '--fit': longestWord(p.config.shortName) }}>{p.title}</div>
    </div>
    <div className="pennant-bottom">{p.description}{p.action}</div>
  </>,

  initial: p => <>
    <div className="initial-specimen" aria-hidden="true">
      <span className="initial-guides"><i>Ascender</i><i>Cap height</i><i>Baseline</i></span>
      <b>{initialOf(p.config.shortName)}</b>
      <span className="initial-caption">Fig. {initialOf(p.config.shortName)} — Initial</span>
    </div>
    <div className="initial-copy">
      <div className="initial-head">{p.label}<div className="initial-mark">{p.mark}</div></div>
      {p.title}
      <div className="initial-body">{p.description}{p.action}</div>
    </div>
  </>,

  ripple: p => <>
    <p.Art count={6} className="ripple-rings"/>
    <div className="ripple-drop">{p.mark}</div>
    {p.label}{p.title}{p.description}{p.action}
  </>,

  zigzag: p => <>
    <div className="zigzag-top"><div className="zigzag-tag">{p.mark}</div>{p.label}</div>
    <div className="zigzag-title" style={{ '--fit': longestWord(p.config.shortName) }}>{p.title}</div>
    <div className="zigzag-band" aria-hidden="true"><i className="landing-motion"/></div>
    <div className="zigzag-bottom">{p.description}{p.action}</div>
  </>,

  tapestry: p => <>
    <p.Art count={1} className="tapestry-spot"/>
    <div className="tapestry-hang landing-motion">
      <span className="tapestry-rod" aria-hidden="true"/>
      <div className="tapestry-cloth">
        <span className="tapestry-band" aria-hidden="true"/>
        <div className="tapestry-medallion">{p.mark}</div>
        {p.label}{p.title}{p.description}{p.action}
        <span className="tapestry-band" aria-hidden="true"/>
      </div>
      <span className="tapestry-fringe" aria-hidden="true"/>
    </div>
  </>,
};
