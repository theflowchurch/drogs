import LicensedMinisterNotice from './LicensedMinisterNotice';
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';

// Layouts share the directory contract; identity and composition come from the
// denomination catalogue. Missing artwork stays a wordmark, never a made-up logo.
export default function DenominationLanding({ site, config }) {
  const layout = config.homeLayout;
  const logo = config.logo && <img className="church-landing-logo" src={`${base}/${config.logo}`} alt={`${config.name} logo`} fetchPriority="high"/>;
  const panelMark = logo || <span className="church-text-mark">{config.shortName}</span>;
  const identity = <div className="church-landing-identity"><h1 className="denom-church-name">{config.shortName}</h1>{config.subtitle && <p className="denom-church-subtitle">{config.subtitle}</p>}</div>;
  const action = <a className="denom-action" href={`${base}/${site}/directory/`}>{config.directoryAction}<span aria-hidden="true">→</span></a>;
  const description = <p className="denom-home-description">Directory of bishops and pastors licensed to minister within {config.name}.</p>;
  const label = <p className="denom-kicker">MINISTERIAL DIRECTORY</p>;
  return <main className="denom-home denom-new-landing church-landing">
    <section className={`church-hero church-layout-${layout} ${config.logo ? '' : 'church-wordmark-only'}`} aria-label={`${config.name} ministerial directory`}>
      <div className="church-hero-art landing-motion" aria-hidden="true"><i/><i/><i/></div>
      {layout === 'folio' && <><div className="church-hero-copy">{label}{identity}{description}{action}</div><div className="church-logo-panel">{logo}<span>{config.name}</span></div><div className="church-hero-rule">Licensed bishops and pastors</div></>}
      {layout === 'panels' && <><div className="church-title-panel">{label}{identity}</div><div className="church-detail-panel">{logo}{description}{action}</div></>}
      {layout === 'seal' && <div className="church-hero-copy">{logo}{label}{identity}{description}{action}</div>}
      {layout === 'columns' && <><div className="church-vertical-label">MINISTERIAL DIRECTORY</div><div className="church-hero-copy">{logo}{identity}{description}{action}</div><div className="church-side-note">Licensed<br/>bishops and pastors</div></>}
      {layout === 'frame' && <div className="church-identity-frame"><div className="church-logo-panel">{panelMark}{label}</div><div className="church-hero-copy">{identity}{description}{action}</div></div>}
      {layout === 'banner' && <><div className="church-banner-top">{logo}{label}</div>{identity}<div className="church-banner-bottom">{description}{action}</div></>}
      {layout === 'ribbon' && <><div className="church-hero-copy">{label}{identity}{description}{action}</div><div className="church-logo-panel">{logo}<span>{config.name}</span></div></>}
      {layout === 'arch' && <><div className="church-arch-panel">{panelMark}{label}</div><div className="church-hero-copy">{identity}{description}{action}</div></>}
    </section>
    <LicensedMinisterNotice/>
  </main>;
}
