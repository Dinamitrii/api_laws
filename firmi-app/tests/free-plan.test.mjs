import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {DatabaseSync} from 'node:sqlite';import {build} from 'esbuild';
const bundle=async p=>{const b=await build({entryPoints:[p],bundle:true,write:false,format:'esm'});return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'))};
const {freeUsageGate:gate,usageMonth}=await bundle('lib/free-usage.ts');const {refundPolicyPage,refundGate}=await bundle('lib/refund-policy.ts');
const req=(path,method='GET',body)=>new Request('https://firmi.test'+path,{method,headers:{Origin:'https://firmi.test'},...(body?{body:JSON.stringify(body)}:{})});
function database(){const sql=new DatabaseSync(':memory:');for(const p of ['0001_accounts','0002_stripe','0003_free_usage'])sql.exec(fs.readFileSync('migrations/'+p+'.sql','utf8'));sql.exec("INSERT INTO auth_users VALUES('user','user@example.com','hash',0)");const db={prepare(query){let values=[];const s={bind(...v){values=v;return s},async first(){return sql.prepare(query).get(...values)??null},async run(){return sql.prepare(query).run(...values)},async all(){return{results:sql.prepare(query).all(...values)}}};return s}};return{sql,db}}
test('25 atomic monthly admissions, free pages, paid/admin bypass, CSRF and Sofia month boundary',async()=>{
 const {sql,db}=database();try{
 assert.equal(usageMonth(new Date('2026-10-31T22:30:00Z')),'2026-11');assert.equal(usageMonth(new Date('2026-10-31T21:30:00Z')),'2026-10');
 const foreign=new Request('https://firmi.test/api/magistrat',{method:'POST',headers:{Origin:'https://evil.test'}});assert.equal((await gate(foreign,{},db,'user')).response.status,403);
 await gate(req('/app'),{},db,'user');await gate(req('/api/magistrat'),{},db,'user');
 assert.equal(sql.prepare('SELECT count(*) n FROM free_monthly_usage').get().n,0);
 const responses=await Promise.all(Array.from({length:30},()=>gate(req('/api/magistrat','POST'),{},db,'user')));
 assert.equal(responses.filter(r=>r.response===null).length,25);assert.equal(responses.filter(r=>r.response?.status===429).length,5);
 let status=await(await gate(req('/api/usage'),{},db,'user')).response.json();assert.equal(status.remaining,0);assert.equal(status.used,25);
 assert.equal((await gate(req('/api/companybook','POST'),{ADMIN_USER_IDS:'user'},db,'user')).response,null);
 sql.exec("INSERT INTO billing_orders(id,user_id,price_id,status,created_at) VALUES('paid','user','price_test','paid',0)");assert.equal((await gate(req('/api/companybook','POST'),{},db,'user')).response,null);
 status=await(await gate(req('/api/usage'),{},db,'user')).response.json();assert.equal(status.plan,'paid');
 }finally{sql.close()}
});
test('policy is public, requests stored for owner, admin-only review',async()=>{
 const {sql,db}=database();try{
 assert.equal(refundPolicyPage(req('/refund-policy')).status,200);
 const submitted=await refundGate(req('/api/refund-request','POST',{message:'Отказ от платената услуга'}),{},db,'user');assert.equal(submitted.status,201);
 assert.equal(sql.prepare('SELECT user_id FROM refund_requests').get().user_id,'user');
 assert.equal((await refundGate(req('/api/admin/refunds'),{},db,'user')).status,403);
 const result=await(await refundGate(req('/api/admin/refunds'),{ADMIN_USER_IDS:'user'},db,'user')).json();assert.equal(result.requests.length,1);
 }finally{sql.close()}
});
