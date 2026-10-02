import { Readable } from 'node:stream';
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
    // kuriakecastle.org is the only public address; the earlier domain sends people there.
    const host = String(req.headers.host || '').split(':')[0];
    if (host === 'drogs.dagministry.org' && !path.startsWith('/api/')) {
      res.writeHead(301, { Location: `https://kuriakecastle.org${req.url || '/'}`, 'Cache-Control': 'no-store' });
      return res.end();
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
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      res.writeHead(500, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: 'Unable to complete the request.' }));
    }
  };
}
