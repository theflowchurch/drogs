"use client";
import { useEffect, useState } from 'react';
import * as api from './client';
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';

function ReceiptPreview({ path }) {
  const [src, setSrc] = useState('');
  useEffect(() => { let live = true; setSrc(''); if (path) api.mediaUrl(path).then(url => live && setSrc(url)).catch(() => {}); return () => { live = false; }; }, [path]);
  return src ? <a href={src} target="_blank" rel="noreferrer"><img className="reg-receipt-preview" src={src} alt="Your payment receipt" /></a> : null;
}
// Payment is through Paystack (office, 17 Nov: Paystack now takes international
// cards, so MoMo and bank-transfer receipts are no longer offered). The page keeps
// the same three steps. The amount is a signed cedi quote from our server and the
// payment is recorded only after the server confirms it with Paystack.
export default function PaymentOptions({ current, actor, run, beforeSave, paystackKey = '', demo = null, refresh }) {
  const [quote, setQuote] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(false), [opening, setOpening] = useState(false), [retry, setRetry] = useState(0);
  const enabled = Boolean(paystackKey) || Boolean(demo);
  useEffect(() => {
    if (!enabled || (current.payment === 'pending' && current.proof)) return;
    let live = true;
    setQuote(null); setError(''); setLoading(true);
    // The demonstration never contacts Paystack: it shows a sample cedi amount.
    const get = demo ? Promise.resolve({ amount: Math.round(current.amount * 1200), currency: 'GHS', usd: current.amount, expiresAt: Date.now() + 15 * 60000, token: 'demo' }) : api.paystackQuote(current.data.role);
    get.then(q => { if (live) setQuote(q); }).catch(e => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [current.data.role, current.amount, retry, enabled]);
  // Paid but closed the page before coming back: the last checkout is checked
  // again quietly when the payment page opens, so the payment is still recorded.
  const lastCheckout = current.paystackQuotes?.at?.(-1)?.reference || '';
  useEffect(() => {
    if (demo || !enabled || !lastCheckout || current.payment === 'verified') return;
    let live = true;
    api.paystackVerify(lastCheckout).then(() => live && refresh?.()).catch(() => {});
    return () => { live = false; };
  }, [lastCheckout, enabled]);
  // An older receipt the office has not checked yet stays as it was.
  if (current.payment === 'pending' && current.proof) return <div className="reg-manual-payment" role="status">
    <h3>Receipt submitted</h3><p>The office will check your receipt against the payment received. Your payment is awaiting verification.</p>
    <ReceiptPreview path={current.proof} />
  </div>;
  const cedis = quote ? new Intl.NumberFormat('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(quote.amount / 100) : '';
  async function pay() {
    setOpening(true);
    await run(async () => {
      if (quote.expiresAt <= Date.now()) { setRetry(n => n + 1); throw Error('The cedi amount has expired. Please check the refreshed amount and pay again.'); }
      await beforeSave?.();
      if (demo) {
        // Demonstration: the payment is recorded in this browser only. No money moves.
        await api.action(actor, 'recordPaystack', { reference: `DEMO-${Date.now()}`, amount: quote.amount, expectedMinor: quote.amount, currency: 'GHS' });
        await refresh?.();
        return;
      }
      const returnUrl = /\/signup\/(?:(?:pastor|bishop)\/)?$/.test(location.pathname) ? location.href : `${location.origin}${base}/signup/`;
      const checkout = await api.paystackInitialize(quote.token, returnUrl);
      location.assign(checkout.url);
    }, demo ? 'Demonstration payment recorded. Nothing was charged.' : undefined);
    setOpening(false);
  }
  return <div className="reg-manual-payment reg-pay-steps">
    <section className="reg-pay-step" aria-labelledby="pay-step-1">
      <h3 id="pay-step-1"><span>1</span>Pay securely</h3>
      {enabled ? <>
        <p>Pay with a <strong>Visa or Mastercard card from any country</strong>, or by <strong>Mobile Money</strong> (MTN, Telecel, AT). You will go to a secure payment page, then return here automatically.</p>
        <p className="reg-pay-total">{quote ? <><strong>Checkout total: GHS {cedis}</strong><small>The ${quote.usd} USD fee in Ghana cedis at today’s rate. No extra fee is added by this site.</small></> : loading ? 'Getting today’s cedi amount…' : null}</p>
        {error && <p className="reg-receipt-error" role="alert">{error}</p>}
        <button type="button" className="reg-primary reg-pay-submit" disabled={!quote || opening || loading} onClick={pay}>{opening ? 'Opening secure checkout…' : quote ? `Pay GHS ${cedis} securely →` : loading ? 'Getting your cedi amount…' : 'Payment amount unavailable'}</button>
        {!loading && <button className="reg-text" type="button" disabled={opening} onClick={() => setRetry(n => n + 1)}>Refresh cedi amount</button>}
        <p className="reg-pay-note">If your card is in another currency, your bank converts the amount and may add its own charge.</p>
      </> : <p role="status">Online payment is being switched on. Please try again shortly, or contact the office.</p>}
    </section>
    <section className="reg-pay-step" aria-labelledby="pay-step-2">
      <h3 id="pay-step-2"><span>2</span>Payment confirmed</h3>
      <p>Once your payment is successful, you return to this page and your payment is confirmed automatically. No receipt upload is needed.</p>
      <p className="reg-small reg-pay-after">The renewal fee is non-refundable, subject to the <a href={`${base}/refunds/`} target="_blank" rel="noreferrer">refund policy</a>. Never share your card PIN or Mobile Money PIN with anyone.</p>
    </section>
  </div>;
}
