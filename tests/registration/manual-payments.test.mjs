import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { inspectReceipt, classifyReceipt } from '../../src/server/receipt-check.mjs';
import { REGISTRATION_BANK, inGhana, paymentReady } from '../../src/registration/manual-payments.mjs';
import { emptyState, applyAction } from '../../src/registration/model.mjs';
import { writeFile, mkdir } from 'node:fs/promises';

const receipt = (background = '#fff', ink = '#111') => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1000"><rect width="100%" height="100%" fill="${background}"/><g fill="${ink}" font-family="Arial" font-size="30"><text x="40" y="70">TEST TRANSFER CONFIRMATION</text><text x="40" y="150">Payment successful</text><text x="40" y="230">GHS 300.00</text><text x="40" y="310">03 November 2026</text><text x="40" y="390">KURIAKE CASTLE LBG</text><text x="40" y="470">Ecobank 1441005268161</text><text x="40" y="550">Reference TEST-2026-11303</text></g></svg>`);

test('local OCR accepts light, dark and photographed receipts and rejects portraits, blank images and unrelated documents', { timeout: 60000 }, async () => {
  const images = [await sharp(receipt()).png().toBuffer(), await sharp(receipt('#14181e', '#fafafa')).png().toBuffer(), await sharp(receipt('#f9f4e7')).rotate(6, { background: '#716c61' }).jpeg({ quality: 75 }).toBuffer()];
  assert.equal((await inspectReceipt(images[0])).verdict, 'receipt', 'the OCR model reads payment details from a clear receipt');
  for (const bytes of images) assert.notEqual((await inspectReceipt(bytes)).verdict, 'not_receipt');
  assert.equal((await inspectReceipt(await sharp('assets/brand/pastor-suit-example.jpg').toBuffer())).verdict, 'not_receipt');
  assert.equal((await inspectReceipt(await sharp({ create: { width: 500, height: 700, channels: 3, background: '#fff' } }).png().toBuffer())).verdict, 'not_receipt');
  assert.equal(classifyReceipt({ text: 'Our church Sunday programme welcomes everyone to join the choir and weekly services', confidence: 90 }).verdict, 'not_receipt');
  assert.equal(classifyReceipt({ text: 'Montant EUR 25,00 paiement reçu référence ABC123', confidence: 80 }).verdict, 'receipt');
  assert.equal((await inspectReceipt(images[0], { recognize: async () => { throw Error('OCR unavailable'); } })).verdict, 'unclear', 'an OCR outage does not falsely reject a receipt');
  if (process.env.RECEIPT_FIXTURES) { await mkdir(process.env.RECEIPT_FIXTURES, { recursive: true }); await writeFile(`${process.env.RECEIPT_FIXTURES}/receipt.png`, images[0]); }
});

test('bank receipts can be submitted on a draft and remain pending until office verification', () => {
  const actor = { id: 'international-pastor', email: 'pastor@example.com' };
  let state = applyAction(emptyState(), actor, 'save', { role: 'pastor', firstName: 'Test', lastName: 'Pastor', organization: 'FLOW', country: 'United States' });
  assert.equal(paymentReady(state.registrations[0]), false);
  assert.throws(() => applyAction(state, actor, 'payment', { transactionId: 'BANK-1234', nonrefundable: true }), /Upload payment proof/);
  state = applyAction(state, actor, 'payment', { proof: 'own/receipt/test.webp', transactionId: 'BANK 2026/1234', method: 'bank', nonrefundable: true, receiptCheck: { verdict: 'unclear', reason: 'Manual review' } });
  const record = state.registrations[0];
  assert.equal(record.status, 'draft'); assert.equal(record.payment, 'pending'); assert.equal(record.paymentMethod, 'bank'); assert.equal(record.amount, 25);
  assert.equal(paymentReady(record), true); assert.equal(record.receiptCheck.verdict, 'unclear');
  assert.equal(paymentReady({ payment: 'pending' }), false);
  assert.equal(paymentReady({ payment: 'rejected', proof: 'old' }), false);
  assert.equal(inGhana(' Ghana '), true); assert.equal(inGhana('United States'), false);
  assert.equal(REGISTRATION_BANK.accountNumber, '1441005268161');
});
