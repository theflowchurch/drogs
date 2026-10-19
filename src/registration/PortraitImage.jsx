import { portraitCrop } from '../runtime/portrait-framing';

// A viewBox crops the source before it is fitted to a card, circle or profile.
// SVG's slice keeps the face in proportion in browsers without object-view-box.
export default function PortraitImage({ media, src, alt, className = '', style, fallbackSrc }) {
  const crop = portraitCrop(media);
  const recover = fallbackSrc ? event => {
    const node = event.currentTarget;
    const attribute = node.localName === 'image' ? 'href' : 'src';
    if (node.getAttribute(attribute) !== fallbackSrc) node.setAttribute(attribute, fallbackSrc);
  } : undefined;
  if (!crop) return <img src={src} alt={alt} className={className} style={style} onError={recover} loading="lazy" decoding="async" />;
  const height = crop.height * crop.bottom;
  return <svg
    className={`${className} reg-cropped-portrait`}
    style={{ ...style, '--portrait-crop-ratio': `${crop.width} / ${height}` }}
    viewBox={`0 0 ${crop.width} ${height}`}
    preserveAspectRatio={`${crop.align || 'xMidYMin'} slice`}
    role="img"
    aria-label={alt || undefined}
    aria-hidden={alt ? undefined : true}
  >
    <image href={src} width={crop.width} height={crop.height} onError={recover} />
  </svg>;
}
