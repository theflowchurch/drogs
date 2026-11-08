import { denominationSite } from './denomination-sites.mjs';
import LicensedMinisterNotice from './LicensedMinisterNotice';
import DenominationLanding from './DenominationLanding';
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
const Arrow = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
function ChurchName({ config }) {
  return <><h1 className="denom-church-name">{config.shortName}</h1>{config.subtitle && <p className="denom-church-subtitle">{config.subtitle}</p>}</>;
}
export default function DenominationHome({ site, concept = 1 }) {
  const config = denominationSite(site);
  if (config.homeLayout) return <DenominationLanding site={site} config={config}/>;
  const link = <a className="denom-action" href={`${base}/${site}/directory/`}>{config.directoryAction}<Arrow/></a>;
  const mark = <img className="denom-hero-logo" src={`${base}/${config.logo}`} alt={`${config.name} logo`} fetchPriority="high"/>;
  return <main className="denom-home denom-new-landing">
    {site === 'lighthousechapelinternational' && concept === 1 && <section className="lighthouse-beacon">
      <div className="lighthouse-rays landing-motion" aria-hidden="true"/>
      <div className="lighthouse-architecture" aria-hidden="true"><span/><span/><span/></div>
      <div className="lighthouse-hero-note"><span>LICENSED MINISTERS</span><span>THE MINISTERIAL DIRECTORY</span></div>
      <div className="denom-home-copy">{mark}<p className="denom-kicker">MINISTERIAL DIRECTORY</p><ChurchName config={config}/><p className="denom-home-description">The bishops and pastors licensed to minister<br/>{' '} within Lighthouse Chapel International.</p>{link}</div>
      <div className="lighthouse-horizon" aria-hidden="true"><span/><i/><span/></div>
    </section>}
    {site === 'pleasantsurprise' && concept === 1 && <section className="pleasant-flow">
      <div className="pleasant-ribbon pleasant-ribbon-one landing-motion" aria-hidden="true"/><div className="pleasant-ribbon pleasant-ribbon-two landing-motion" aria-hidden="true"/>
      <div className="pleasant-hero-top"><span className="denom-kicker">MINISTERIAL DIRECTORY</span></div>
      <div className="denom-home-copy"><ChurchName config={config}/><p className="denom-home-description">Directory of licensed bishops and pastors within<br/>{' '} Pleasant Surprise Church International.</p>{link}</div>
      <div className="pleasant-emblem">{mark}<span>PLEASANT SURPRISE<br/>{' '}CHURCH INTERNATIONAL</span></div>
      <div className="pleasant-hero-bottom"><span>BISHOPS & PASTORS</span><span>Licensed ministers <Arrow/></span></div>
    </section>}
    {site === 'gochurch' && concept === 1 && <><section className="go-signal">
      <div className="go-grid" aria-hidden="true"/><div className="go-signal-sweep landing-motion" aria-hidden="true"/>
      <div className="go-signal-top"><span>THE MINISTRY DIRECTORY</span><span><i className="landing-motion"/>GO CHURCH</span></div>
      <div className="go-orbit" aria-hidden="true"><span className="landing-motion"/><span className="landing-motion"/><span className="landing-motion"/></div>
      <div className="denom-home-copy">{mark}<p className="denom-kicker">LICENSED BISHOPS AND PASTORS</p><ChurchName config={config}/><p className="denom-home-description">Explore the bishops and pastors<br/>{' '} licensed to minister in Go Church.</p>{link}</div>

    </section><div className="go-type-strip" aria-hidden="true"><div className="landing-motion">{Array.from({length:4},(_,i)=><span key={i}>GO CHURCH <i>↗</i> BISHOPS & PASTORS <i>↗</i> LICENSED MINISTERS <i>↗</i></span>)}</div></div></>}
    {site === 'lighthousechapelinternational' && concept === 2 && <section className="lighthouse-atlas">
      <div className="atlas-title"><p className="denom-kicker">THE LIGHTHOUSE DIRECTORY</p><ChurchName config={config}/><p className="denom-home-description">Directory of licensed bishops and pastors.</p>{link}</div>
      <div className="atlas-compass"><div className="atlas-globe landing-motion" aria-hidden="true"><i/><i/><i/><i/><i/></div><div className="atlas-logo">{mark}<span>LIGHTHOUSE CHAPEL<br/>{' '}INTERNATIONAL</span></div><span className="atlas-north" aria-hidden="true">N</span></div>
      <div className="atlas-bottom"><span>LICENSED BISHOPS AND PASTORS</span><span>Discover our ministers <Arrow/></span></div>
    </section>}
    {site === 'lighthousechapelinternational' && concept === 3 && <section className="lighthouse-night">
      <div className="night-fan landing-motion" aria-hidden="true"/><div className="night-line" aria-hidden="true"/>
      <div className="night-top"><p className="denom-kicker">THE MINISTERIAL DIRECTORY</p><span>LIGHTHOUSE CHAPEL INTERNATIONAL</span></div>
      <div className="night-seal">{mark}<span>LICENSED MINISTERS</span></div>
      <div className="night-bottom"><div><ChurchName config={config}/></div><div><p className="denom-home-description">Meet the bishops and pastors<br/>{' '} licensed to minister within our church.</p>{link}</div></div>
    </section>}
    {site === 'pleasantsurprise' && concept === 2 && <section className="pleasant-bloom">
      <div className="bloom-flower landing-motion" aria-hidden="true">{Array.from({length:8},(_,i)=><i key={i} style={{'--petal':i}}/>)}</div>
      <div className="bloom-top"><span>MINISTERIAL DIRECTORY</span><span>LICENSED MINISTERS</span></div>
      <div className="denom-home-copy">{mark}<p className="denom-kicker">THE MINISTRY OF</p><ChurchName config={config}/><p className="denom-home-description">Meet the bishops and pastors<br/>{' '} of Pleasant Surprise Church International.</p>{link}</div>
      <span className="bloom-dot bloom-dot-one landing-motion" aria-hidden="true"/><span className="bloom-dot bloom-dot-two landing-motion" aria-hidden="true"/>
    </section>}
    {site === 'pleasantsurprise' && concept === 3 && <section className="pleasant-arch">
      <div className="pleasant-arch-main"><div className="arch-lines landing-motion" aria-hidden="true"><i/><i/><i/></div><p className="denom-kicker">PLEASANT SURPRISE · CHURCH INTERNATIONAL</p><div className="denom-home-copy"><ChurchName config={config}/></div><span className="arch-bottom-label">LICENSED MINISTERS</span></div>
      <div className="pleasant-arch-side">{mark}<p className="denom-home-description">The bishops and pastors<br/>{' '} of our church.</p>{link}<span className="arch-side-label">MEET OUR MINISTERS <Arrow/></span></div>
    </section>}
    {site === 'gochurch' && concept === 2 && <section className="go-launch">
      <div className="launch-top"><span>GO CHURCH / THE MINISTRY DIRECTORY</span><span>↗</span></div>
      <div className="launch-arrow landing-motion" aria-hidden="true">↗</div>
      <div className="denom-home-copy">{mark}<p className="denom-kicker">MINISTERIAL DIRECTORY</p><ChurchName config={config}/><p className="denom-home-description">Directory of bishops and pastors<br/>{' '} licensed to minister in Go Church.</p>{link}</div>
      <div className="launch-bottom"><span>GO CHURCH</span><span>LICENSED BISHOPS AND PASTORS</span><Arrow/></div>
    </section>}
    {site === 'gochurch' && concept === 3 && <section className="go-frame">
      <div className="frame-bands landing-motion" aria-hidden="true"><i/><i/><i/><i/><i/></div>
      <div className="frame-heading"><span>GO CHURCH</span><span>THE MINISTRY DIRECTORY ↗</span></div>
      <div className="go-frame-card"><div className="frame-logo">{mark}<span>LICENSED TO MINISTER</span></div><div className="denom-home-copy"><p className="denom-kicker">MINISTERIAL DIRECTORY</p><ChurchName config={config}/><p className="denom-home-description">Directory of licensed bishops and pastors.</p>{link}</div></div>
      <div className="frame-bottom"><span>DIRECTORY OF LICENSED MINISTERS</span><span>↗</span></div>
    </section>}
    <LicensedMinisterNotice open={config.openLicenseNotice}/>
  </main>;
}
