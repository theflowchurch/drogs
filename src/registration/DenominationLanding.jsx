import LicensedMinisterNotice from './LicensedMinisterNotice';
import set1 from './landings/set1';
import set2 from './landings/set2';
import set3 from './landings/set3';
import set4 from './landings/set4';
import set5 from './landings/set5';
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';

export default function DenominationLanding({ site, config }) {
  const style = config.homeLayout;
  const mark = config.logo
    ? <img className="church-landing-logo" src={`${base}/${config.logo}`} alt={`${config.name} logo`} fetchPriority="high"/>
    : <span className="church-text-mark">{config.shortName}</span>;
  const title = <div className="church-landing-identity"><h1 className="denom-church-name">{config.shortName}</h1>{config.subtitle && <p className="denom-church-subtitle">{config.subtitle}</p>}</div>;
  const action = <a className="denom-action" href={`${base}/${site}/directory/`}>{config.directoryAction}<span aria-hidden="true">→</span></a>;
  const description = <p className="denom-home-description">Directory of bishops and pastors licensed to minister within {config.name}.</p>;
  const label = <p className="denom-kicker">MINISTERIAL DIRECTORY</p>;
  const Copy = ({ logo = false, kicker = true }) => <div className="hero-copy">{logo && mark}{kicker && label}{title}{description}{action}</div>;
  const Art = ({ count = 4, className = '' }) => <div className={`hero-art landing-motion ${className}`} aria-hidden="true">{Array.from({ length: count }, (_, i) => <i key={i} style={{ '--piece': i }}/>)}</div>;
  const masthead = <div className="hero-masthead"><span>MINISTERIAL DIRECTORY</span><span>LICENSED BISHOPS AND PASTORS</span></div>;
  const pages = {
    cinema: () => <><Art className="cinema-beam"/><div className="cinema-screen"><div className="cinema-mark">{mark}</div><div className="cinema-bottom"><div>{label}{title}</div><div>{description}{action}</div></div></div><div className="cinema-credit">{config.name}</div></>,
    marquee: () => <div className="marquee-poster"><Art count={12}/><div className="marquee-top">{mark}{label}</div>{title}<div className="marquee-baseline">{description}{action}</div></div>,
    swiss: () => <><div className="swiss-rail"><span>LICENSED MINISTERS</span>{mark}</div><div className="swiss-main">{label}{title}<div className="swiss-bottom">{description}{action}</div></div><Art count={2}/></>,
    quiet: () => <><div className="quiet-top">{label}<span>{config.name}</span></div><div className="quiet-title">{title}</div><div className="quiet-bottom">{mark}<div>{description}{action}</div></div></>,
    terminal: () => <><Art count={1}/><div className="mono-header">{label}<span>Licensed ministers</span></div><div className="mono-body"><div>{title}{description}</div><div className="mono-mark">{mark}</div></div><div className="mono-footer"><span>Bishops / Pastors</span>{action}</div></>,
    deco: () => <><Art count={7}/><div className="deco-border"><div className="deco-mark">{mark}</div>{label}{title}{description}{action}</div></>,
    bauhaus: () => <><Art count={4}/><div className="bauhaus-top">{label}<div className="bauhaus-mark">{mark}</div></div><div className="bauhaus-title">{title}</div><div className="bauhaus-bottom">{description}{action}</div></>,
    noir: () => <><div className="noir-strip">{mark}<span>LICENSED MINISTERS</span></div><div className="noir-main">{label}{title}<div className="noir-rule"/><div className="noir-bottom">{description}{action}</div></div><Art count={2}/></>,
    newsprint: () => <><div className="newsprint-top"><span>{config.name}</span><span>MINISTERIAL DIRECTORY</span></div>{title}<div className="newsprint-columns"><div>{label}{description}</div><div className="newsprint-mark">{mark}</div><div><span className="hero-caption">Bishops and pastors</span>{action}</div></div></>,
    poster: () => <><Art count={3}/><div className="poster-rail">{label}<span>LICENSED MINISTERS</span></div><div className="poster-name">{title}</div><div className="poster-mark">{mark}</div><div className="poster-bottom">{description}{action}</div></>,
    horizon: () => <><Art count={4}/><div className="horizon-top">{mark}{label}</div><div className="horizon-copy">{title}{description}{action}</div><div className="horizon-line" aria-hidden="true"/></>,
    riso: () => <><Art count={3}/><div className="riso-sheet"><div className="riso-note">{label}<span>{config.name}</span></div>{title}<div className="riso-bottom">{description}{action}</div></div><div className="riso-mark">{mark}</div></>,
    gallery: () => <><div className="gallery-masthead">{label}<span>{config.name}</span></div><div className="gallery-object">{mark}<span>Licensed bishops and pastors</span></div><div className="gallery-title">{title}</div><div className="gallery-note">{description}{action}</div></>,
    index: () => <><aside className="index-margin"><span>MINISTERIAL<br/>DIRECTORY</span><div>Bishops<br/>Pastors</div>{mark}</aside><div className="index-content">{title}<div className="index-entry"><span>Directory</span>{description}</div><div className="index-action">{action}</div></div></>,
    glass: () => <><Art count={3}/><div className="glass-window"><div className="glass-window-bar">{label}<span>{config.name}</span></div><div className="glass-window-copy">{title}{description}{action}</div></div><div className="glass-logo">{mark}</div></>,
    brutalist: () => <><div className="brutalist-top"><span>MINISTERIAL DIRECTORY</span><div>{mark}</div></div><div className="brutalist-title">{title}</div><div className="brutalist-bottom"><div>{description}</div><div>{action}</div></div></>,
    letterpress: () => <><Art count={2}/><div className="letterpress-title">{label}{title}</div><div className="letterpress-seal">{mark}</div><div className="letterpress-note">{description}{action}</div><div className="letterpress-imprint">{config.name}</div></>,
    spotlight: () => <><Art count={9}/><div className="spotlight-identity">{mark}</div><div className="spotlight-title">{label}{title}</div><div className="spotlight-bottom">{description}{action}</div></>,
    panorama: () => <><Art count={4}/><div className="panorama-top">{label}{mark}</div><div className="panorama-bottom"><div>{title}</div><div>{description}{action}</div></div></>,
    memphis: () => <><Art count={5}/><div className="memphis-copy">{label}{title}{description}{action}</div><div className="memphis-logo">{mark}<span>{config.name}</span></div></>,
    blueprint: () => <><Art count={5}/><div className="blueprint-top">{label}<span>{config.name}</span></div><div className="blueprint-plan"><div className="blueprint-mark">{mark}</div><span>Licensed bishops and pastors</span></div><div className="blueprint-copy">{title}{description}{action}</div></>,
    monolith: () => <><div className="monolith-panel">{mark}<span>MINISTERIAL DIRECTORY</span></div><div className="monolith-copy">{label}{title}{description}{action}</div><Art count={1}/></>,
    ribbonfold: () => <><Art count={3}/><div className="fold-title">{label}{title}</div><div className="fold-mark">{mark}</div><div className="fold-note">{description}{action}</div></>,
    columnar: () => <><Art count={5}/><div className="columnar-top">{mark}{label}</div><div className="columnar-title">{title}</div><div className="columnar-baseline">{description}{action}</div></>,
    signal: () => <><Art count={4}/><div className="signal-top">{label}<div>{mark}</div></div><div className="signal-title">{title}</div><div className="signal-bottom">{description}{action}</div></>,
    chrome: () => <><Art count={4}/>{masthead}<div className="chrome-identity">{mark}{title}</div><div className="chrome-bottom">{description}{action}</div></>,
    quilt: () => <div className="quilt-grid"><div className="quilt-title">{label}{title}</div><div className="quilt-logo">{mark}</div><div className="quilt-description">{description}</div><div className="quilt-action">{action}<span>{config.name}</span></div></div>,
    ledger: () => <><div className="ledger-spine"><span>MINISTERIAL DIRECTORY</span></div><div className="ledger-page"><div className="ledger-top">{mark}<span>{config.name}</span></div>{title}<div className="ledger-bottom">{description}{action}</div></div></>,
    gallerydark: () => <><Art count={1}/><div className="gallerydark-caption">{label}{title}{description}{action}</div><div className="gallerydark-stage">{mark}<span>{config.name}</span></div></>,
    orbit: () => <><Art count={6}/><div className="orbit-logo">{mark}{label}</div><div className="orbit-title">{title}</div><div className="orbit-bottom">{description}{action}</div></>,
    typographic: () => <><div className="type-top">{label}{mark}</div><div className="type-title">{title}</div><div className="type-stripe" aria-hidden="true"/><div className="type-bottom">{action}{description}</div></>,
    sandstone: () => <><Art count={3}/><div className="sandstone-title">{label}{title}{description}{action}</div><div className="sandstone-mark">{mark}<span>{config.name}</span></div></>,
    diagonal: () => <><Art count={2}/><div className="diagonal-mark">{mark}<span>MINISTERIAL DIRECTORY</span></div><div className="diagonal-copy">{label}{title}{description}{action}</div></>,
    letter: () => <><div className="letter-heading">{mark}<span>{config.name}</span></div><div className="letter-body">{label}{title}{description}</div><div className="letter-signoff">{action}<span>Licensed bishops and pastors</span></div></>,
    mosaic: () => <><Art count={9}/><div className="mosaic-top">{label}{mark}</div><div className="mosaic-bottom"><div>{title}</div><div>{description}{action}</div></div></>,
    ...set1, ...set2, ...set3, ...set4, ...set5,
  };
  return <main className="denom-home denom-new-landing church-landing">
    <section className={`church-hero church-style-${style} ${config.logo ? '' : 'church-wordmark-only'}`} aria-label={`${config.name} ministerial directory`}>
      {pages[style]?.({ config, mark, title, description, action, label, Art, masthead }) || <Copy logo/>}
    </section>
    <LicensedMinisterNotice open={config.openLicenseNotice}/>
  </main>;
}
