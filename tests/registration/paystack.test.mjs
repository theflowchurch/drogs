import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuote, readQuote, validateQuotedPayment, checkoutReturnUrl, paymentJson } from '../../src/server/paystack.mjs';
const actor = { id: 'member-1', email: 'member@example.com' }, secret = 's'.repeat(64), now = 1000000;
const registration = { amount: 25, data: { role: 'pastor' } };
const quote = () => createQuote({ actor, role: 'pastor', year: 2027, usd: 25, rate: 11.6592, secret, now });
const read = (token, changes = {}) => readQuote(token, { actor, registration, year: 2027, secret, now, ...changes });
test('the $25 fee becomes an exact signed cedi amount without adding a fee', () => {
 const q = quote(); assert.equal(q.amount, 29148); assert.equal(q.currency, 'GHS'); assert.equal(read(q.token).amount, 29148);
 assert.throws(() => createQuote({ actor, role:'pastor', year:2027, usd:25, rate:NaN, secret }), /rate/);
});
test('a cedi quote cannot be edited, reused by another member or applied to a changed fee/year/role', () => {
 const q = quote(); const body = Buffer.from(JSON.stringify({...q, amount: 1})).toString('base64url');
 assert.throws(() => read(`${body}.${q.token.split('.')[1]}`), /Refresh/);
 for (const changes of [{actor:{...actor,id:'other'}},{year:2028},{registration:{...registration,amount:20}},{registration:{...registration,data:{role:'bishop'}}},{now:q.expiresAt}]) assert.throws(() => read(q.token,changes), /expired or changed/);
});
test('verification uses the frozen amount even after quote expiry, rejects under/overpayments, wrong currency, account and year', () => {
 const q = {...read(quote().token),reference:'KC-test'};
 const tx = {status:'success',amount:q.amount,currency:'GHS',reference:q.reference,customer:{email:actor.email},metadata:{registrationUser:actor.id,registrationYear:2027,quoteReference:q.reference}};
 assert.doesNotThrow(() => validateQuotedPayment(tx,q,actor,2027,q.reference));
 for (const change of [{amount:q.amount-1},{amount:q.amount+1},{currency:'USD'},{status:'pending'},{reference:'wrong'},{customer:{email:'other@example.com'}},{metadata:{...tx.metadata,registrationYear:2028}}]) assert.throws(() => validateQuotedPayment({...tx,...change},q,actor,2027,q.reference));
});
test('checkout only returns to a registration page on this website', () => {
 assert.equal(checkoutReturnUrl('https://kuriakecastle.org/flow/signup/pastor/?old=1#x','https://kuriakecastle.org'),'https://kuriakecastle.org/flow/signup/pastor/?paystack_return=1');
 for (const value of ['https://other.example/signup/','javascript:alert(1)','https://kuriakecastle.org/admin/','https://kuriakecastle.org/signup/evil/']) assert.throws(()=>checkoutReturnUrl(value,'https://kuriakecastle.org'));
});
test('provider failure, invalid JSON and a stalled payment request fail safely', async () => {
 for (const fetcher of [async()=>({ok:false,json:async()=>({})}),async()=>({ok:true,json:async()=>{throw Error('bad body');}}),async(_,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('timeout'))))]) {
   // Keep the event loop active while AbortSignal.timeout expires in Node.
   const keepAlive=setInterval(()=>{},10);
   try { await assert.rejects(paymentJson(fetcher,'https://api.paystack.co/test',{},15),/payment service/); } finally {clearInterval(keepAlive);}
 }
});
