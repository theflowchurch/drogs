'use client';
import { useEffect, useRef } from 'react';

// The restrained fabric folds from the approved homepage concepts. Draw at a
// modest resolution and frame rate; stop all animation when hidden or paused.
export default function DenominationTexture({ site, paused }) {
  const canvas = useRef(null);
  useEffect(() => {
    const element = canvas.current, ctx = element?.getContext('2d', { alpha: false });
    if (!ctx) return;
    const palettes = {
      lighthousechapelinternational: { base: [250,250,246], shade: [185,174,142], axis: .68 },
      pleasantsurprise: { base: [252,250,253], shade: [170,147,185], axis: -.7 },
      gochurch: { base: [250,249,246], shade: [170,164,148], axis: 1.12 },
    };
    const p = palettes[site];
    let width, height, frame = 0, last = 0;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    function paint(ms = 0) {
      const t = ms * .000085;
      ctx.fillStyle = `rgb(${p.base})`; ctx.fillRect(0, 0, width, height);
      for (let i = -3; i < 10; i++) {
        const span = width * .4;
        ctx.save(); ctx.translate((i * .22 + Math.sin(t * .28 + i) * .035) * width, height * .5);
        ctx.rotate(p.axis + Math.sin(t * .2 + i) * .026);
        const g = ctx.createLinearGradient(-span / 2, 0, span / 2, 0);
        g.addColorStop(0, `rgba(${p.shade},0)`); g.addColorStop(.36, `rgba(${p.shade},.016)`);
        g.addColorStop(.49, `rgba(${p.shade},.12)`); g.addColorStop(.54, `rgba(${p.shade},.025)`);
        g.addColorStop(.64, 'rgba(255,255,255,.7)'); g.addColorStop(1, `rgba(${p.shade},0)`);
        ctx.fillStyle = g; ctx.fillRect(-span / 2, -height * 2, span, height * 4); ctx.restore();
      }
    }
    function tick(ms) {
      if (ms - last > 90) { last = ms; paint(ms); }
      frame = requestAnimationFrame(tick);
    }
    function start() {
      cancelAnimationFrame(frame);
      if (!paused && !document.hidden && !reduced.matches) frame = requestAnimationFrame(tick);
    }
    function resize() {
      width = element.width = Math.min(920, Math.round(innerWidth * .65));
      height = element.height = Math.round(innerHeight * width / innerWidth);
      paint(last); start();
    }
    resize(); window.addEventListener('resize', resize); document.addEventListener('visibilitychange', start); reduced.addEventListener('change', start);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', start); reduced.removeEventListener('change', start); };
  }, [site, paused]);
  return <canvas ref={canvas} className="denom-texture" aria-hidden="true"/>;
}
