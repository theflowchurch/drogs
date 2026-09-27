import { Readable } from 'node:stream';
export function requestHandler({ origin, api, nextHandler }) {
  return async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    const path = (req.url || '/').split('?')[0];
    if (!path.startsWith('/api/registration/') && !path.startsWith('/api/v1/')) return nextHandler(req, res);
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
