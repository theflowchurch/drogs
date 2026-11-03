import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import eng from '@tesseract.js-data/eng';
import { receiptScore, assessReceipt, SAMPLE_WIDTH } from '../registration/receipt-check.mjs';
import { HttpError } from './auth.mjs';

const rejection = 'This does not look like a payment receipt. Please upload a clear screenshot or photo of the actual transfer confirmation showing the amount, date and transaction reference.';
export function classifyReceipt({ text = '', confidence = 0, visual, photoLike = false, blank = false }) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const payment = /\b(receipt|payment|paid|transfer(?:red)?|transaction|remittance|deposit|successful|success|reference|beneficiary|recipient|ecobank|worldremit|remitly|sendwave|taptap|paiement|transfert|re[çc]u|montant|betrag|[üu]berweisung|recibo|pago|bonifico)\b/i.test(text);
  const numbers = /\d/.test(text);
  const money = /(?:GHS|GHC|USD|EUR|GBP|CAD|AUD|NGN|ZAR|KES|CHF|INR|RUB|JPY|BRL|amount|total|montant|betrag|[$€£₵₹₽₦¥]|\d[.,]\d{2})/i.test(text);
  if (payment && (numbers || money)) return { verdict: 'receipt', reason: 'Receipt details detected. The office will verify the payment received.' };
  if (blank || (photoLike && !payment && !money && words.length < 4) || (visual?.verdict === 'photograph' && !payment && !money) || (words.length >= 10 && confidence >= 55 && !payment && !money))
    return { verdict: 'not_receipt', reason: rejection };
  return { verdict: 'unclear', reason: 'Some receipt details could not be read automatically. The office will review the uploaded proof manually.' };
}

// Local OCR only: receipt images and extracted text never leave this server.
// One worker per request is terminated on completion or timeout. The cap also
// prevents parallel large images exhausting the shared hosting process.
let active = 0;
export async function inspectReceipt(bytes, { recognize } = {}) {
  const { data, info } = await sharp(bytes).resize(SAMPLE_WIDTH).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const score = receiptScore(data, info.width);
  const visual = assessReceipt(score);
  const photoLike = score && score.colours > 120 && score.flatRows < .15 && score.dominant < .55;
  const stats = await sharp(bytes).greyscale().stats();
  const blank = stats.channels[0].stdev < 2;
  if (blank) return classifyReceipt({ blank });
  if (active >= 2) throw new HttpError(503, 'Receipt checking is busy. Please try uploading again in a moment.');
  active++;
  let worker, timer, expired = false;
  try {
    const image = await sharp(bytes).rotate().resize({ width: 1600, height: 2200, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#fff' }).normalise().png().toBuffer();
    const result = await Promise.race([
      (async () => {
        if (recognize) return recognize(image);
        worker = await createWorker('eng', 1, { langPath: eng.langPath, gzip: true, cacheMethod: 'none', errorHandler: () => {} });
        if (expired) { await worker.terminate(); throw Error('Receipt check expired'); }
        await worker.setParameters({ tessedit_pageseg_mode: '11' });
        return (await worker.recognize(image)).data;
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Receipt reading timed out')), 18000); }),
    ]);
    return classifyReceipt({ text: result.text, confidence: result.confidence, visual, photoLike });
  } catch {
    // An outage is not evidence that a member's genuine receipt is wrong.
    return { verdict: 'unclear', reason: 'Receipt uploaded for office review; automatic reading was unavailable.' };
  } finally { expired = true; clearTimeout(timer); if (worker) await worker.terminate().catch(() => {}); active--; }
}
