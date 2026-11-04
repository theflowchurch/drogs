import './set5.css';

// Star chart: fixed points in a 1000x600 sky, joined into one figure.
const stars = [[585, 120, 3.2], [660, 205, 2.4], [748, 150, 4], [842, 236, 2.6], [905, 128, 2], [812, 352, 3.4], [690, 330, 2.2], [612, 452, 2.8], [930, 470, 2.4]];
const dust = Array.from({ length: 70 }, (_, i) => [(i * 137.5) % 1000, (i * 89.3 + 40) % 600, (i % 5) * .25 + .45]);
const enso = 'M214 70C312 70 352 150 340 222C326 304 248 350 174 336C96 322 50 252 62 176C72 116 116 76 176 64';
const Ghost = ({ name, k }) => <span className="denom-church-name echo-ghost" style={{ '--k': k }} aria-hidden="true">{name}</span>;

// Landing compositions: each receives { config, mark, title, description, action, label, Art, masthead }.
export default {
  eclipse: p => <>
    <p.Art count={40} className="eclipse-sky"/>
    <div className="eclipse-body">
      <div className="eclipse-corona landing-motion"/>
      <div className="eclipse-moon">{p.mark}</div>
    </div>
    <div className="eclipse-copy">
      <p className="eclipse-phase"><span>01</span>Light in darkness<span>{p.config.name}</span></p>
      {p.label}{p.title}{p.description}{p.action}
    </div>
  </>,

  constellation: p => <>
    <svg className="constellation-map" viewBox="0 0 1000 600" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
      <g className="constellation-dust">{dust.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r}/>)}</g>
      <polyline points={[0, 1, 2, 3, 4].map(i => stars[i].slice(0, 2)).join(' ')}/>
      <polyline points={[3, 5, 6, 1].map(i => stars[i].slice(0, 2)).join(' ')}/>
      <polyline points={[6, 7].concat([5, 8]).map(i => stars[i].slice(0, 2)).join(' ')} className="constellation-faint"/>
      {stars.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} className="constellation-star"/>)}
      <text x={758} y={140}>α BISHOPS</text><text x={822} y={372}>β PASTORS</text>
    </svg>
    <div className="constellation-strip"><span>RA 04ʰ 12ᵐ</span><span>DEC +23° 07′</span><span>{p.config.name}</span></div>
    <div className="constellation-target">{p.mark}</div>
    <div className="constellation-copy">{p.label}{p.title}<div className="constellation-foot">{p.description}{p.action}</div></div>
  </>,

  watercolor: p => <>
    <svg className="watercolor-defs" aria-hidden="true"><filter id="watercolor-bleed"><feTurbulence type="fractalNoise" baseFrequency=".011" numOctaves="3" seed="7"/><feDisplacementMap in="SourceGraphic" scale="70" xChannelSelector="R" yChannelSelector="G"/></filter></svg>
    <p.Art count={5} className="watercolor-washes"/>
    <div className="watercolor-sheet">
      <div className="watercolor-mark">{p.mark}</div>
      {p.label}{p.title}
      <span className="watercolor-stroke" aria-hidden="true"/>
      {p.description}{p.action}
    </div>
  </>,

  postcard: p => <div className="postcard-card">
    <div className="postcard-head"><span>POST CARD</span>{p.label}</div>
    <div className="postcard-message">
      <p className="postcard-greeting" aria-hidden="true">Greetings from</p>
      {p.title}{p.description}
    </div>
    <div className="postcard-back">
      <div className="postcard-stamp">{p.mark}<span>{p.config.name}</span></div>
      <div className="postcard-postmark" aria-hidden="true"><span>LICENSED · MINISTERS ·</span></div>
      <div className="postcard-address">
        <span>To the reader of</span>
        <span>The ministerial directory</span>
        <span>{p.config.name}</span>
      </div>
      {p.action}
    </div>
  </div>,

  heraldry: p => <>
    <div className="heraldry-achievement">
      <div className="heraldry-shield"><div className="heraldry-field"><div className="heraldry-roundel">{p.mark}</div></div></div>
      <div className="heraldry-ribbon"><span>Licensed · Ministers</span></div>
    </div>
    <div className="heraldry-copy">
      {p.label}{p.title}
      <div className="heraldry-divider" aria-hidden="true"><i/><b/><i/></div>
      {p.description}{p.action}
    </div>
  </>,

  triptych: p => <div className="triptych-altar">
    <div className="triptych-wing triptych-left"><div className="triptych-inner">{p.mark}<span>Bishops</span></div></div>
    <div className="triptych-centre"><div className="triptych-inner">{p.label}{p.title}{p.description}{p.action}</div></div>
    <div className="triptych-wing triptych-right"><div className="triptych-inner"><span>Pastors</span><small>{p.config.name}</small></div></div>
  </div>,

  vigil: p => <>
    <div className="vigil-glow landing-motion" aria-hidden="true"/>
    <div className="vigil-copy">
      <div className="vigil-mark">{p.mark}</div>
      {p.label}{p.title}{p.description}{p.action}
    </div>
    <div className="vigil-candles" aria-hidden="true">
      {[0, 1, 2, 3, 4].map(i => <div key={i} className="vigil-candle" style={{ '--c': i }}><i className="landing-motion"/></div>)}
    </div>
  </>,

  zen: p => <>
    <svg className="zen-enso" viewBox="0 0 400 400" aria-hidden="true">
      <defs><filter id="zen-brush"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="7"/></filter></defs>
      <g filter="url(#zen-brush)">
        {[30, 21, 12, 6].map((w, i) => <path key={w} d={enso} pathLength="100" className="zen-enso-body" style={{ strokeWidth: w, strokeDasharray: `${62 + i * 12} 200` }}/>)}
        <path d="M232 64C312 80 344 156 334 222C322 296 252 340 182 332" className="zen-enso-dry"/>
      </g>
    </svg>
    <div className="zen-seal">{p.mark}</div>
    <div className="zen-copy">{p.label}{p.title}{p.description}{p.action}</div>
  </>,

  billboard: p => <>
    <div className="billboard-board" aria-hidden="true"><span>{p.config.shortName} {p.config.shortName}</span></div>
    <div className="billboard-panel">
      <div className="billboard-mark">{p.mark}</div>
      <div className="billboard-text">{p.label}{p.title}</div>
      <div className="billboard-cta">{p.description}{p.action}</div>
    </div>
  </>,

  echo: p => <>
    <div className="echo-top">{p.label}{p.mark}</div>
    <div className="echo-title">{[4, 3, 2, 1].map(k => <Ghost key={k} k={k} name={p.config.shortName}/>)}{p.title}</div>
    <div className="echo-card">{p.description}{p.action}</div>
  </>,
};
