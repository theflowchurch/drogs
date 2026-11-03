"use client";
import { useEffect, useState } from 'react';
import * as api from './client';
import { checkReceiptImage } from './receipt-check.mjs';
import { paymentReference } from './model.mjs';
import { REGISTRATION_BANK, REMITTANCE_APPS, inGhana } from './manual-payments.mjs';
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';

function ReceiptPreview({ path }) {
  const [src, setSrc] = useState('');
  useEffect(() => { let live = true; setSrc(''); if (path) api.mediaUrl(path).then(url => live && setSrc(url)).catch(() => {}); return () => { live = false; }; }, [path]);
  return src ? <a href={src} target="_blank" rel="noreferrer"><img className="reg-receipt-preview" src={src} alt="Your payment receipt" /></a> : null;
}
export default function PaymentOptions({ current, actor, run, refresh, paystack, beforeSave }) {
  const domestic = inGhana(current.data.country);
  const [method, setMethod] = useState(domestic && paystack ? 'paystack' : 'bank');
  const [proof, setProof] = useState(''), [check, setCheck] = useState(null), [transactionId, setTransactionId] = useState('');
  const [acknowledged, setAcknowledged] = useState(false), [uploading, setUploading] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState(''), [replacing, setReplacing] = useState(false);
  useEffect(() => { setMethod(domestic && paystack ? 'paystack' : 'bank'); }, [domestic, Boolean(paystack)]);
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
  return <div className="reg-manual-payment">
    {!domestic && <p>Registering from outside Ghana? Send the equivalent of <strong>${current.amount} USD</strong> by bank transfer, then upload your receipt below.</p>}
    <fieldset className="reg-payment-methods"><legend>How would you like to pay?</legend>
      {domestic && paystack && <label><input type="radio" name="payment-method" value="paystack" checked={method === 'paystack'} onChange={() => setMethod('paystack')} />Paystack · mobile money or local card</label>}
      <label><input type="radio" name="payment-method" value="bank" checked={method === 'bank'} onChange={() => setMethod('bank')} />Bank transfer</label>
    </fieldset>
    {method === 'paystack' ? paystack : <>
      <section className="reg-transfer-details" aria-label="Bank transfer payment details">
        <h3>Pay by bank transfer</h3><dl className="reg-details">
          <div><dt>Account name</dt><dd>{REGISTRATION_BANK.accountName}</dd></div>
          <div><dt>Account number</dt><dd className="reg-transfer-number">{REGISTRATION_BANK.accountNumber}</dd></div>
          <div><dt>Bank</dt><dd>{REGISTRATION_BANK.name}</dd></div>
          <div><dt>Branch</dt><dd>{REGISTRATION_BANK.branch}</dd></div>
          <div><dt>Country</dt><dd>{REGISTRATION_BANK.country}</dd></div>
        </dl>
        <p>You can use your bank or a money-transfer app that offers deposits to Ghanaian bank accounts. Choose Ghana, select bank deposit and enter the Ecobank details above.</p>
        <div className="reg-remittance-apps">{REMITTANCE_APPS.map(([name, url, image]) => <a key={name} href={url} target="_blank" rel="noreferrer"><img src={`${base}/assets/payment-apps/${image}`} alt="" /><span>{name} ↗</span></a>)}</div>
        <p className="reg-small">Availability, fees and exchange rates depend on your country and provider. Confirm that the app supports an Ecobank bank deposit before sending. If a routing or SWIFT code is required, ask the office for the required details first.</p>
      </section>
      <p>Send the equivalent of <strong>${current.amount} USD</strong>. Allow for your provider’s charges so the full commitment reaches the recipient.</p>
      <p>Payment reference: <strong>{reference}</strong></p>
      <section className="reg-receipt-upload" aria-label="Upload your payment receipt">
        <h3>Upload your receipt here</h3><p>Choose a clear screenshot or photo of the actual payment confirmation showing the amount, date, recipient and transaction reference. JPG, PNG or WebP, up to 5 MB.</p>
        {current.payment === 'rejected' && <p role="alert">{current.paymentNote || 'The office requested replacement proof. Please upload a new receipt.'}</p>}
        <label className="reg-field"><span>Payment receipt</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading || saving} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; upload(file); }} /></label>
        {uploading && <p role="status">Uploading and checking your receipt…</p>}
        {error && <p className="reg-receipt-error" role="alert">{error}</p>}
        {proof && <><ReceiptPreview path={proof} /><p role="status">{check?.verdict === 'unclear' || check?.verdict === 'unknown' ? 'Receipt uploaded. Some details could not be read automatically; the office will check it manually.' : 'Receipt uploaded. The office will verify the payment received.'}</p></>}
        <label className="reg-field"><span>Transaction ID or transfer reference</span><input value={transactionId} maxLength={80} onChange={e => setTransactionId(e.target.value)} autoComplete="off" /></label>
        <label className="reg-check"><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} />I confirm that this receipt is for my annual commitment and understand that payments are generally non-refundable under the refund policy.</label>
        <button type="button" className="reg-primary" disabled={!proof || !transactionId.trim() || !acknowledged || uploading || saving} onClick={submit}>{saving ? 'Submitting receipt…' : 'Submit receipt for review'}</button>
        <p className="reg-small">Upload and submit your receipt before continuing. Uploading a receipt does not mark a payment as received.</p>
      </section>
    </>}
  </div>;
}
