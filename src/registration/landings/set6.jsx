import './set6.css';
// Landing compositions for the five church pages added on 18 Nov (FLOW and the
// four Affiliated Denominations). Each receives { config, mark, title, description, action, label, Art }.
export default {
  // FLOW: an online fellowship, concentric rings spreading out like a signal.
  compass: p => <>
    <div className="compass-rings" aria-hidden="true">{[0, 1, 2, 3, 4].map(i => <i key={i} style={{ '--ring': i }}/>)}</div>
    <div className="compass-mark">{p.mark}</div>
    <div className="compass-copy">{p.label}{p.title}{p.description}{p.action}</div>
  </>,
  // Heritage Baptist Church Global: courses of stone, the name as the cornerstone.
  cornerstone: p => <>
    <div className="cornerstone-wall" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i}/>)}</div>
    <div className="cornerstone-block"><div className="cornerstone-mark">{p.mark}</div>{p.label}{p.title}</div>
    <div className="cornerstone-foot">{p.description}{p.action}</div>
  </>,
  // Love Economy Church: warm overlapping circles.
  hearth: p => <>
    <div className="hearth-glow" aria-hidden="true"><i/><i/><i/></div>
    <div className="hearth-card"><div className="hearth-mark">{p.mark}</div>{p.label}{p.title}{p.description}{p.action}</div>
  </>,
  // Revival House of Holy Fire Ministries: a rising flame of colour.
  flame: p => <>
    <div className="flame-rise" aria-hidden="true"><i/><i/><i/></div>
    <div className="flame-copy">{p.label}{p.title}{p.description}{p.action}</div>
    <div className="flame-mark">{p.mark}</div>
  </>,
  // Christ Vision Sanctuary International: rays of light behind the sanctuary.
  beacon: p => <>
    <div className="beacon-rays" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ '--ray': i }}/>)}</div>
    <div className="beacon-mark">{p.mark}</div>
    <div className="beacon-copy">{p.label}{p.title}{p.description}{p.action}</div>
  </>,
};
