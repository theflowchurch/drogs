"use client";
import { useEffect, useState } from 'react';
import * as api from './client';
import { checkReceiptImage } from './receipt-check.mjs';
import { paymentReference } from './model.mjs';
import { REGISTRATION_MOMO, REMITTANCE_APPS } from './manual-payments.mjs';
import { currencyFor, loadRates, rateFor, localAmount } from './exchange.mjs';
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';

function ReceiptPreview({ path }) {
  const [src, setSrc] = useState('');
  useEffect(() => { let live = true; setSrc(''); if (path) api.mediaUrl(path).then(url => live && setSrc(url)).catch(() => {}); return () => { live = false; }; }, [path]);
  return src ? <a href={src} target="_blank" rel="noreferrer"><img className="reg-receipt-preview" src={src} alt="Your payment receipt" /></a> : null;
}
// Two ways to pay (office, 17 Nov): card or Mobile Money through the secure
// checkout, confirmed automatically; or a money transfer app (Remitly, WorldRemit,
// Taptap Send…) to the Mobile Money account, with a receipt the office checks.
// The checkout amount is a signed cedi quote from our server, recorded only after
// the server confirms it with Paystack.
export default function PaymentOptions({ current, actor, run, beforeSave, paystackKey = '', demo = null, refresh }) {
  const [quote, setQuote] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(false), [opening, setOpening] = useState(false), [retry, setRetry] = useState(0);
  const enabled = Boolean(paystackKey) || Boolean(demo);
  const [method, setMethod] = useState('card');
  const [proof, setProof] = useState(''), [check, setCheck] = useState(null), [transactionId, setTransactionId] = useState('');
  const [acknowledged, setAcknowledged] = useState(false), [uploading, setUploading] = useState(false), [saving, setSaving] = useState(false), [uploadError, setUploadError] = useState(''), [replacing, setReplacing] = useState(false);
  useEffect(() => { if (demo && method === 'app') { setProof(p => p || demo.proof); setCheck(c => c || { verdict: 'receipt' }); setTransactionId(t => t || demo.transactionId); setAcknowledged(true); } }, [demo, method]);
  const reference = paymentReference({ userId: actor.id, year: current.year });
  // Only the registrant's own country's currency is shown beside the US dollars
  // (office, 17 Nov). The checkout still settles through the signed quote.
  const [rates, setRates] = useState(null);
  const country = String(current.data?.country || '').trim(), currency = currencyFor(country);
  useEffect(() => { if (!currency || currency === 'USD') return; let live = true; loadRates().then(v => live && setRates(v)); return () => { live = false; }; }, [currency]);
  const rate = rateFor(rates, currency), local = rate > 0 ? localAmount(current.amount, rate, currency) : '';
  async function upload(file) {
    setUploadError(''); setProof(''); setCheck(null);
    if (!file) return;
    setUploading(true);
    try {
      await beforeSave?.();
      const result = await api.upload(actor, file, 'receipt', true);
      const assessment = result.receiptCheck || await checkReceiptImage(file);
      if (assessment.verdict === 'photograph' || assessment.verdict === 'not_receipt') throw Error(assessment.reason);
      setProof(result.path); setCheck(assessment);
    } catch (e) { setUploadError(e.message || 'Your receipt could not be uploaded. Please try again.'); }
    finally { setUploading(false); }
  }
  async function submit() {
    if (!proof || !acknowledged || !transactionId.trim()) return;
    setSaving(true);
    try {
      const ok = await run(async () => {
        await beforeSave?.();
        await api.action(actor, 'payment', { proof, transactionId, method: 'app', receiptCheck: check, nonrefundable: true });
        await refresh?.();
      }, 'Receipt submitted. The office will confirm your payment.');
      if (ok) setReplacing(false);
    } finally { setSaving(false); }
  }
  useEffect(() => {
    if (!enabled || (current.payment === 'pending' && current.proof && !replacing)) return;
    let live = true;
    setQuote(null); setError(''); setLoading(true);
    // The demonstration never contacts Paystack: it shows a sample cedi amount.
    const get = demo ? Promise.resolve({ amount: Math.round(current.amount * 1200), currency: 'GHS', usd: current.amount, expiresAt: Date.now() + 15 * 60000, token: 'demo' }) : api.paystackQuote(current.data.role);
    get.then(q => { if (live) setQuote(q); }).catch(e => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [current.data.role, current.amount, retry, enabled, replacing]);
  // Paid but closed the page before coming back: the last checkout is checked
  // again quietly when the payment page opens, so the payment is still recorded.
  const lastCheckout = current.paystackQuotes?.at?.(-1)?.reference || '';
  useEffect(() => {
    if (demo || !enabled || !lastCheckout || current.payment === 'verified') return;
    let live = true;
    api.paystackVerify(lastCheckout).then(() => live && refresh?.()).catch(() => {});
    return () => { live = false; };
  }, [lastCheckout, enabled]);
  // A receipt the office has not checked yet.
  if (current.payment === 'pending' && current.proof && !replacing) return <div className="reg-manual-payment" role="status">
    <h3>Receipt submitted</h3><p>The office will check your receipt against the payment received. Your payment is awaiting confirmation.</p>
    <ReceiptPreview path={current.proof} />
    <button type="button" className="reg-text" onClick={() => { setReplacing(true); setMethod('app'); }}>Replace receipt</button>
  </div>;
  async function pay() {
    setOpening(true);
    await run(async () => {
      if (quote.expiresAt <= Date.now()) { setRetry(n => n + 1); throw Error('The payment amount has expired. It has been refreshed; please pay again.'); }
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
  const app = method === 'app';
  return <div className="reg-manual-payment reg-pay-steps">
    <section className="reg-pay-step" aria-labelledby="pay-step-1">
      <h3 id="pay-step-1"><span>1</span>Choose how to pay</h3>
      <fieldset className="reg-payment-methods"><legend className="reg-visually-hidden">How would you like to pay?</legend>
        <label><input type="radio" name="payment-method" value="card" checked={!app} onChange={() => setMethod('card')} />Card or Mobile Money · confirmed instantly</label>
        <label><input type="radio" name="payment-method" value="app" checked={app} onChange={() => setMethod('app')} />Send money using an app (Remitly, WorldRemit, Taptap Send and others)</label>
      </fieldset>
    </section>
    {!app ? <>
    <section className="reg-pay-step" aria-labelledby="pay-step-2">
      <h3 id="pay-step-2"><span>2</span>Pay securely</h3>
      {enabled ? <>
        <p>Pay with a <strong>Visa or Mastercard card from any country</strong>, or by <strong>Mobile Money</strong> (MTN, Telecel, AT). You will go to a secure payment page, then return here automatically.</p>
        <p className="reg-pay-total">{quote ? <><strong>Amount to pay: ${quote.usd} USD{local ? ` · approximately ${local} in ${country}` : ''}</strong><small>No extra fee is added by this site.</small></> : loading ? 'Getting today’s amount…' : null}</p>
        {error && <p className="reg-receipt-error" role="alert">{error}</p>}
        <button type="button" className="reg-primary reg-pay-submit" disabled={!quote || opening || loading} onClick={pay}>{opening ? 'Opening secure checkout…' : quote ? `Pay $${quote.usd} USD securely →` : loading ? 'Getting today’s amount…' : 'Payment amount unavailable'}</button>
        {!loading && <button className="reg-text" type="button" disabled={opening} onClick={() => setRetry(n => n + 1)}>Refresh amount</button>}
        <p className="reg-pay-note">If your card is in another currency, your bank converts the amount and may add its own charge.</p>
      </> : <p role="status">Online payment is being switched on. Please try again shortly, or contact the office.</p>}
    </section>
    <section className="reg-pay-step" aria-labelledby="pay-step-3">
      <h3 id="pay-step-3"><span>3</span>Payment confirmed</h3>
      <p>Once your payment is successful, you return to this page and your payment is confirmed automatically. No receipt upload is needed.</p>
      <p className="reg-small reg-pay-after">The renewal fee is non-refundable, subject to the <a href={`${base}/refunds/`} target="_blank" rel="noreferrer">refund policy</a>. Never share your card PIN or Mobile Money PIN with anyone.</p>
    </section>
    </> : <>
    <section className="reg-pay-step" aria-labelledby="pay-step-2">
      <h3 id="pay-step-2"><span>2</span>Make your payment</h3>
      <p>Use your money transfer app to send the equivalent of <strong>${current.amount} USD</strong> to the Mobile Money account below. In the app, choose <strong>Ghana</strong>, then <strong>Mobile Money</strong>, then <strong>MTN</strong>.</p>
      <dl className="reg-details reg-pay-details">
        <div><dt>Country</dt><dd>Ghana</dd></div>
        <div><dt>Mobile Money network</dt><dd>{REGISTRATION_MOMO.network}</dd></div>
        <div><dt>Recipient name</dt><dd>{REGISTRATION_MOMO.name}</dd></div>
        <div><dt>Mobile Money number</dt><dd><CopyValue value={REGISTRATION_MOMO.number} /></dd></div>
        <div><dt>Payment reference</dt><dd><CopyValue value={reference} small /><small>Add this to the payment note if the app allows it.</small></dd></div>
      </dl>
      <p className="reg-pay-note">Make sure the recipient receives the full amount. Transfer fees may apply.</p>
      <div className="reg-remittance-apps">{REMITTANCE_APPS.map(([name, url, image]) => <a key={name} href={url} target="_blank" rel="noreferrer"><img src={`${base}/assets/payment-apps/${image}`} alt="" /><span>{name} ↗</span></a>)}</div>
    </section>
    <section className="reg-pay-step reg-receipt-upload" aria-labelledby="pay-step-3">
      <h3 id="pay-step-3"><span>3</span>Upload your receipt</h3>
      <p>After making your payment, upload a screenshot or photo of your payment confirmation.</p>
      {current.payment === 'rejected' && <p role="alert">{current.paymentNote || 'The office requested replacement proof. Please upload a new receipt.'}</p>}
      <label className="reg-receipt-drop">
        <input type="file" aria-label="Payment receipt" accept="image/jpeg,image/png,image/webp" disabled={uploading || saving} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; upload(file); }} />
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4m0 0-5 5m5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>
        <strong>{proof ? 'Choose a different receipt' : 'Choose receipt'}</strong>
        <small>JPG, PNG or WebP · up to 5 MB</small>
      </label>
      {uploading && <p role="status">Uploading and checking your receipt…</p>}
      {uploadError && <p className="reg-receipt-error" role="alert">{uploadError}</p>}
      {proof && <><ReceiptPreview path={proof} /><p role="status">{check?.verdict === 'unclear' || check?.verdict === 'unknown' ? 'Receipt uploaded. Some details could not be read automatically; the office will check it.' : 'Receipt uploaded.'}</p></>}
      <label className="reg-field"><span>Transaction number</span><input value={transactionId} maxLength={80} placeholder="Enter the number shown on your receipt" onChange={e => setTransactionId(e.target.value)} autoComplete="off" /></label>
      <label className="reg-check"><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} /><span>I confirm that I have made this payment and understand that the renewal fee is non-refundable, subject to the <a href={`${base}/refunds/`} target="_blank" rel="noreferrer">refund policy</a>.</span></label>
      <button type="button" className="reg-primary reg-pay-submit" disabled={!proof || !transactionId.trim() || !acknowledged || uploading || saving} onClick={submit}>{saving ? 'Submitting…' : 'Submit payment'}</button>
      <p className="reg-small reg-pay-after">The office will check your receipt and confirm your payment before your renewal is confirmed.</p>
    </section>
    </>}
  </div>;
}
// A payment detail people need to type into their app, with a one-tap copy.
function CopyValue({ value, small = false }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(value.replace(/\s+/g, value.startsWith('+') ? '' : ' ')); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {} };
  return <span className="reg-copy-value"><span className={small ? '' : 'reg-transfer-number'}>{value}</span><button type="button" className="reg-copy" onClick={copy} aria-label={`Copy ${value}`}>{copied ? 'Copied ✓' : 'Copy'}</button></span>;
}
