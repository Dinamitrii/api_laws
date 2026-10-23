import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
const bundle = await build({entryPoints:['lib/stripe-billing.ts'],bundle:true,format:'esm',platform:'neutral',write:false});
const {billingGate,stripeWebhook,validStripeSignature} = await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const secret='whsec_testing';
async function signature(raw, timestamp = Math.floor(Date.now()/1000)) {
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(timestamp+'.'+raw))).toString('hex');
 return `t=${timestamp},v1=${sig}`;
}
test('signature rejects tampering and old events, accepts a rotated signature',async()=>{
 const sig=await signature('{}');
 assert.equal(await validStripeSignature('{}',sig,secret),true);
 assert.equal(await validStripeSignature('{"x":1}',sig,secret),false);
 assert.equal(await validStripeSignature('{}',await signature('{}',1),secret),false);
 assert.equal(await validStripeSignature('{}',sig+',v1='+'0'.repeat(64),secret),true);
});
test('checkout, paid access, CSRF, webhook validation and duplicate deliveries',async()=>{
 const sql=new DatabaseSync(':memory:');
 sql.exec(fs.readFileSync('migrations/0001_accounts.sql','utf8'));
 sql.exec(fs.readFileSync('migrations/0002_stripe.sql','utf8'));
 sql.exec("INSERT INTO auth_users VALUES('user','u@example.com','hash',0)");
 const db={withSession(){return db},prepare(query){let values=[];const statement={bind(...args){values=args;return statement},async first(){return sql.prepare(query).get(...values)??null},async run(){return sql.prepare(query).run(...values)}};return statement}};
 const env={AUTH_DB:db,STRIPE_SECRET_KEY:'sk_test_test',STRIPE_WEBHOOK_SECRET:secret,STRIPE_PRICE_ID:'price_test',STRIPE_REQUIRE_PAYMENT:'true',STRIPE_APP_URL:'https://app.test'};
 const req=(path,options={})=>new Request('https://app.test'+path,options);
 const original=globalThis.fetch;
 let order;
 globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.stripe.com/v1/checkout/sessions');assert.equal(options.body.get('line_items[0][price]'),'price_test');order=options.body.get('metadata[order_id]');return Response.json({id:'cs_test',url:'https://checkout.stripe.com/c/pay/test'})};
 try {
  assert.equal(await billingGate(req('/'),{},db,'user'),null);
  assert.equal((await billingGate(req('/api/companybook'),env,db,'user')).status,402);
  assert.equal((await billingGate(req('/'),env,db,'user')).headers.get('Location'),'/billing');
  assert.equal((await billingGate(req('/api/billing/checkout',{method:'POST',headers:{Origin:'https://evil.test'}}),env,db,'user')).status,403);
  assert.equal((await billingGate(req('/api/billing/checkout',{method:'POST',headers:{Origin:'https://app.test'}}),env,db,'user')).status,200);
  const send=async(payment='paid',sig=true,user='user')=>{const raw=JSON.stringify({type:'checkout.session.completed',data:{object:{id:'cs_test',mode:'payment',payment_status:payment,client_reference_id:user,metadata:{order_id:order,price_id:'price_test'}}}});return stripeWebhook(req('/api/stripe/webhook',{method:'POST',body:raw,headers:{'Stripe-Signature':sig?await signature(raw):'invalid'}}),env)};
  assert.equal((await send('paid',false)).status,400);
  await send('unpaid');await send('paid',true,'other-user');
  assert.equal((await billingGate(req('/api/companybook'),env,db,'user')).status,402);
  assert.equal((await send()).status,200);assert.equal((await send()).status,200);
  assert.equal(sql.prepare("SELECT count(*) n FROM billing_orders WHERE status='paid'").get().n,1);
  assert.equal(await billingGate(req('/api/companybook'),env,db,'user'),null);
  assert.equal((await billingGate(req('/api/billing/checkout',{method:'POST',headers:{Origin:'https://app.test'}}),env,db,'user')).status,409);
 } finally {globalThis.fetch=original;sql.close()}
});
