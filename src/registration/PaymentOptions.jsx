"use client";
import { useEffect, useState } from 'react';
import * as api from './client';
import { checkReceiptImage } from './receipt-check.mjs';
import { paymentReference } from './model.mjs';
import { REGISTRATION_BANK, REGISTRATION_MOMO, REMITTANCE_APPS, inGhana } from './manual-payments.mjs';
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';

function ReceiptPreview({ path }) {
  const [src, setSrc] = useState('');
  useEffect(() => { let live = true; setSrc(''); if (path) api.mediaUrl(path).then(url => live && setSrc(url)).catch(() => {}); return () => { live = false; }; }, [path]);
  return src ? <a href={src} target="_blank" rel="noreferrer"><img className="reg-receipt-preview" src={src} alt="Your payment receipt" /></a> : null;
}
export default function PaymentOptions({ current, actor, run, refresh, beforeSave }) {
  const domestic = inGhana(current.data.country);
  const [method, setMethod] = useState('momo');
  const [proof, setProof] = useState(''), [check, setCheck] = useState(null), [transactionId, setTransactionId] = useState('');
  const [acknowledged, setAcknowledged] = useState(false), [uploading, setUploading] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState(''), [replacing, setReplacing] = useState(false);
    const reference = paymentReference({ userId: actor.id, year: current.year });
  async function upload(file) {
    setError(''); setProof(''); setCheck(null);
    if (!file) return;
    setUploading(true);
    try {
      await beforeSave?.();
      const result = await api.upload(actor, file, 'receipt', true);
      const assessment = result.receiptCheck || await checkReceiptImage(file);
      if (assessment.verdict === 'photograph' || assessment.verdict === 'not_receipt') throw Error(assessment.reason);
      setProof(result.path); setCheck(assessment);
    } catch (e) { setError(e.message || 'Your receipt could not be uploaded. Please try again.'); }
    finally { setUploading(false); }
  }
  async function submit() {
    if (!proof || !acknowledged || !transactionId.trim()) return;
    setSaving(true);
    try {
      const ok = await run(async () => {
        await beforeSave?.();
        await api.action(actor, 'payment', { proof, transactionId, method, nonrefundable: true });
        await refresh();
      }, 'Receipt submitted. The office will verify the payment received.');
      if (ok) setReplacing(false);
    } finally { setSaving(false); }
  }
  if (current.payment === 'pending' && current.proof && !replacing) return <div className="reg-manual-payment" role="status">
    <h3>Receipt submitted</h3><p>The office will check your receipt against the payment received. Your payment is awaiting verification.</p>
    <ReceiptPreview path={current.proof} />
    <button type="button" className="reg-text" onClick={() => setReplacing(true)}>Replace receipt</button>
  </div>;
  const app = method === 'momo';
  return <div className="reg-manual-payment reg-pay-steps">
    <section className="reg-pay-step" aria-labelledby="pay-step-1">
      <h3 id="pay-step-1"><span>1</span>Choose how to pay</h3>
      <fieldset className="reg-payment-methods"><legend className="reg-visually-hidden">How would you like to pay?</legend>
        <label><input type="radio" name="payment-method" value="momo" checked={app} onChange={() => setMethod('momo')} />{domestic ? 'Mobile Money (MTN MoMo)' : 'Send money using an app (Remitly, WorldRemit, Taptap Send and others)'}</label>
        <label><input type="radio" name="payment-method" value="bank" checked={!app} onChange={() => setMethod('bank')} />Pay directly to our bank account (Ecobank Ghana)</label>
      </fieldset>
    </section>
    <section className="reg-pay-step" aria-labelledby="pay-step-2">
      <h3 id="pay-step-2"><span>2</span>Make your payment</h3>
      <p>{app
        ? domestic ? <>Send the equivalent of <strong>${current.amount} USD</strong> to the Mobile Money account below.</> : <>Use your money transfer app to send the equivalent of <strong>${current.amount} USD</strong> to the Mobile Money account below. In the app, choose <strong>Ghana</strong>, then <strong>Mobile Money</strong>, then <strong>MTN</strong>.</>
        : <>Send the equivalent of <strong>${current.amount} USD</strong> to the bank account below, from your bank or a money transfer app that offers bank deposits to Ghana.</>}</p>
      <dl className="reg-details reg-pay-details">
        <div><dt>Country</dt><dd>Ghana</dd></div>
        {app ? <>
          <div><dt>Mobile Money network</dt><dd>{REGISTRATION_MOMO.network}</dd></div>
          <div><dt>Recipient name</dt><dd>{REGISTRATION_MOMO.name}</dd></div>
          <div><dt>Mobile Money number</dt><dd><CopyValue value={REGISTRATION_MOMO.number} /></dd></div>
        </> : <>
          <div><dt>Account name</dt><dd>{REGISTRATION_BANK.accountName}</dd></div>
          <div><dt>Account number</dt><dd><CopyValue value={REGISTRATION_BANK.accountNumber} /></dd></div>
          <div><dt>Bank</dt><dd>{REGISTRATION_BANK.name} · {REGISTRATION_BANK.branch}</dd></div>
        </>}
        <div><dt>Payment reference</dt><dd><CopyValue value={reference} small /><small>Add this to the payment note if the app or bank allows it.</small></dd></div>
      </dl>
      <p className="reg-pay-note">Make sure the recipient receives the full amount. Transfer fees may apply.</p>
      {!domestic && <div className="reg-remittance-apps">{REMITTANCE_APPS.map(([name, url, image]) => <a key={name} href={url} target="_blank" rel="noreferrer"><img src={`${base}/assets/payment-apps/${image}`} alt="" /><span>{name} ↗</span></a>)}</div>}
    </section>
    <section className="reg-pay-step reg-receipt-upload" aria-labelledby="pay-step-3">
      <h3 id="pay-step-3"><span>3</span>Upload your receipt</h3>
      <p>After making your payment, upload a screenshot or photo of your payment confirmation.</p>
      {current.payment === 'rejected' && <p role="alert">{current.paymentNote || 'The office requested replacement proof. Please upload a new receipt.'}</p>}
      <label className="reg-receipt-drop">
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading || saving} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; upload(file); }} />
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4m0 0-5 5m5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>
        <strong>{proof ? 'Choose a different receipt' : 'Choose receipt'}</strong>
        <small>JPG, PNG or WebP · up to 5 MB</small>
      </label>
      {uploading && <p role="status">Uploading and checking your receipt…</p>}
      {error && <p className="reg-receipt-error" role="alert">{error}</p>}
      {proof && <><ReceiptPreview path={proof} /><p role="status">{check?.verdict === 'unclear' || check?.verdict === 'unknown' ? 'Receipt uploaded. Some details could not be read automatically; the office will check it.' : 'Receipt uploaded.'}</p></>}
      <label className="reg-field"><span>Transaction number</span><input value={transactionId} maxLength={80} placeholder="Enter the number shown on your receipt" onChange={e => setTransactionId(e.target.value)} autoComplete="off" /></label>
      <label className="reg-check"><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} /><span>I confirm that I have made this payment and understand that the renewal fee is non-refundable, subject to the <a href={`${base}/refunds/`} target="_blank" rel="noreferrer">refund policy</a>.</span></label>
      <button type="button" className="reg-primary reg-pay-submit" disabled={!proof || !transactionId.trim() || !acknowledged || uploading || saving} onClick={submit}>{saving ? 'Submitting…' : 'Submit payment'}</button>
      <p className="reg-small reg-pay-after">Your payment will be checked before your renewal is confirmed.</p>
    </section>
  </div>;
}
// A payment detail people need to type into their app, with a one-tap copy.
function CopyValue({ value, small = false }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(value.replace(/\s+/g, value.startsWith('+') ? '' : ' ')); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {} };
  return <span className="reg-copy-value"><span className={small ? '' : 'reg-transfer-number'}>{value}</span><button type="button" className="reg-copy" onClick={copy} aria-label={`Copy ${value}`}>{copied ? 'Copied ✓' : 'Copy'}</button></span>;
}
