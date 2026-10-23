import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpError } from './auth.mjs';

export async function paymentJson(fetcher, url, options = {}, timeoutMs = 8000) {
  try {
    const response = await fetcher(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
    const data = await response.json();
    if (!response.ok) throw Error('Provider request failed');
    return data;
  } catch {
    throw new HttpError(503, 'The payment service is taking too long or is unavailable. Please try again shortly.');
  }
}
const sign = (body, secret) => createHmac('sha256', secret).update(body).digest('base64url');
export function createQuote({ actor, role, year, usd, rate, secret, now = Date.now() }) {
  const amount = Math.round(usd * rate * 100);
  if (!Number.isSafeInteger(amount) || amount <= 0 || !Number.isFinite(rate) || rate <= 0)
    throw new HttpError(503, 'Today’s cedi exchange rate is unavailable. Please try again shortly.');
  const quote = { userId: actor.id, role, year, usd, rate, amount, currency: 'GHS', expiresAt: now + 15 * 60 * 1000 };
  const body = Buffer.from(JSON.stringify(quote)).toString('base64url');
  return { ...quote, token: `${body}.${sign(body, secret)}` };
}
export function readQuote(token, { actor, registration, year, secret, now = Date.now() }) {
  if (typeof token !== 'string' || token.length > 2000) throw new HttpError(400, 'Refresh the payment amount before continuing.');
  const [body, signature, extra] = token.split('.');
  const expected = sign(body || '', secret);
  if (extra || !signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected)))
    throw new HttpError(400, 'Refresh the payment amount before continuing.');
  let quote;
  try { quote = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { throw new HttpError(400, 'Invalid payment amount.'); }
  if (quote.userId !== actor.id || quote.year !== year || quote.role !== registration.data.role || quote.usd !== registration.amount || quote.expiresAt <= now)
    throw new HttpError(409, 'The payment amount has expired or changed. Refresh it before paying.');
  return quote;
}
export function checkoutReturnUrl(value, origin) {
  let url;
  try { url = new URL(value); } catch { throw new HttpError(400, 'Invalid payment return address.'); }
  if (url.origin !== origin || !/\/(?:signup)(?:\/(?:pastor|bishop))?\/$/.test(url.pathname))
    throw new HttpError(400, 'Return to your registration page before paying.');
  url.search = '?paystack_return=1'; url.hash = '';
  return url.href;
}
export function validateQuotedPayment(tx, quote, actor, year, reference) {
  if (tx.status !== 'success') throw new HttpError(400, 'Paystack has not confirmed this payment yet.');
  if (String(tx.customer?.email || '').toLowerCase() !== actor.email.toLowerCase()) throw new HttpError(400, 'This payment was made under a different email address.');
  if (quote.userId !== actor.id || quote.year !== year || tx.reference !== reference || tx.currency !== quote.currency || tx.amount !== quote.amount)
    throw new HttpError(400, 'This payment does not match the quoted registration amount. Please contact the office.');
  const metadata = typeof tx.metadata === 'string' ? JSON.parse(tx.metadata || '{}') : tx.metadata;
  if (metadata?.registrationUser !== actor.id || metadata?.registrationYear !== year || metadata?.quoteReference !== reference)
    throw new HttpError(400, 'This payment is not for this registration.');
}
