import { gzipSync } from 'node:zlib';
import { Readable } from 'node:stream';
import { canonicalSiteRedirect } from '../registration/organization-sites.mjs';
export function requestHandler({ origin, api, nextHandler }) {
  return async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    // Report-only first: Next.js needs inline scripts/styles; the rate service is the only third party.
    res.setHeader('Content-Security-Policy-Report-Only', "default-src 'self'; img-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline' https://js.paystack.co; style-src 'self' 'unsafe-inline'; connect-src 'self' https://open.er-api.com https://api.paystack.co https://*.r2.cloudflarestorage.com; frame-src https://checkout.paystack.com https://js.paystack.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    const path = (req.url || '/').split('?')[0];
    // Office, 24 Nov: a browser shut out as a blocked person gets nothing but this, on every
    // page. The office's own pages still open, so the office can never lock itself out.
    const cookies = String(req.headers.cookie || '');
    // The page's own files (scripts, styles, images) and the office's sign-in always load, so
    // the office can sign in at /admin/ on any device; signing in there clears the mark (26 Nov).
    const officeWay = path.startsWith('/admin') || path.startsWith('/_next/') || path.startsWith('/assets/') || path === '/api/registration/auth/office-code' || (path === '/api/registration/auth/me' && req.headers['x-kc-door'] === 'office') || (path.startsWith('/api/') && /kc_office=/.test(cookies));
    if (/(?:^|;\s*)kc_sv=1(?:;|$)/.test(cookies) && !officeWay) {
      res.writeHead(503, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
      return res.end('Service Unavailable');
    }
    // kuriakecastle.org is the only public address; the earlier domain sends people there.
    const host = String(req.headers.host || '').split(':')[0];
    if (host === 'drogs.dagministry.org' && !path.startsWith('/api/')) {
      res.writeHead(301, { Location: `https://kuriakecastle.org${req.url || '/'}`, 'Cache-Control': 'no-store' });
      return res.end();
    }
    const siteRedirect = canonicalSiteRedirect(req.url || '/');
    if (siteRedirect) {
      res.writeHead(308, { Location: siteRedirect, 'Cache-Control': 'no-store' });
      return res.end();
    }
    // The Order of Bishops / Pastors pages and Councils (not their sign-up pages)
    // open only after the Order pages password and a signed-in member in good
    // standing; otherwise the person goes to /access/ to do those steps.
    if (api.orderAccess && ['GET', 'HEAD'].includes(req.method) && /^\/(orderofbishopsingoodstanding|orderofpastorsingoodstanding|councils)(\/|$)/.test(path) && !/^\/[a-z]+\/signup(\/|$)/.test(path)) {
      const probe = new Request(new URL(req.url, origin), { headers: req.headers });
      const access = await api.orderAccess(probe).catch(() => ({ step: 'code' }));
      if (access.step !== 'ok') {
        res.writeHead(302, { Location: `/access/?next=${encodeURIComponent(req.url || path)}`, 'Cache-Control': 'no-store' });
        return res.end();
      }
    }
    if (!path.startsWith('/api/registration/') && !path.startsWith('/api/v1/')) {
      // Pages must not sit in the CDN for a year after a deploy. Hashed /_next/static files and
      // /assets/ images may be cached for a year (an image that changes gets a new file name).
      const immutable = path.startsWith('/_next/static/') || path.startsWith('/assets/');
      const setHeader = res.setHeader.bind(res);
      res.setHeader = (name, value) => setHeader(name, String(name).toLowerCase() === 'cache-control' ? (immutable ? 'public, max-age=31536000, immutable' : 'private, no-cache') : value);
      if (immutable) setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return nextHandler(req, res);
    }
    try {
      // The site answers on every domain attached to it; the request's own host is its origin.
      const host = String(req.headers.host || new URL(origin).host).split(',')[0].trim();
      const request = new Request(new URL(req.url, `${new URL(origin).protocol}//${host}`), {
        method: req.method, headers: req.headers,
        ...(!['GET', 'HEAD'].includes(req.method) ? { body: Readable.toWeb(req), duplex: 'half' } : {}),
      });
      const response = await api(request);
      const headers = Object.fromEntries(response.headers);
      let bytes = Buffer.from(await response.arrayBuffer());
      // The contact-free roster is ~2 MB as JSON. Compress large API replies
      // for browsers as well as the usual static assets (roughly 90% smaller).
      const acceptsGzip = String(req.headers['accept-encoding'] || '').split(',').some(part => {
        const [name, ...parameters] = part.trim().split(';');
        const quality = parameters.find(p => p.trim().startsWith('q='));
        return name.trim() === 'gzip' && (!quality || Number(quality.trim().slice(2)) > 0);
      });
      const compressible = /\bjson\b/i.test(headers['content-type'] || '') && bytes.length > 1024;
      if (compressible && !headers['content-encoding']) headers.vary = headers.vary ? `${headers.vary}, Accept-Encoding` : 'Accept-Encoding';
      if (compressible && acceptsGzip && !headers['content-encoding']) {
        bytes = gzipSync(bytes, { level: 4 });
        headers['content-encoding'] = 'gzip';
        headers['content-length'] = String(bytes.length);
      }
      res.writeHead(response.status, headers);
      res.end(bytes);
    } catch {
      res.writeHead(500, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: 'Unable to complete the request.' }));
    }
  };
}
