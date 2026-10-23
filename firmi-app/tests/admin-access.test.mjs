import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';
const b=await build({entryPoints:['lib/admin-access.ts'],bundle:true,format:'esm',platform:'neutral',write:false});
const {adminAccess}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const req=(p,method='GET')=>new Request('https://app.test'+p,{method});
const db={prepare(){return{async first(){return{totalUsers:2,paidOrders:1}},async all(){return{results:[{id:'user',email:'<script>bad</script>',created_at:1,paid_orders:1}]}}}}};
test('explicit server user ID bypasses billing; regular users cannot access admin',async()=>{
 const env={ADMIN_USER_IDS:'owner'};
 assert.equal((await adminAccess(req('/'),env,db,'owner')).handled,true);
 assert.equal((await adminAccess(req('/'),env,db,'user')).handled,false);
 assert.equal((await adminAccess(req('/admin'),env,db,'user')).response.status,403);
 assert.equal((await adminAccess(req('/api/admin/overview'),{},db,'owner')).response.status,403);
 assert.equal((await adminAccess(req('/admin?admin=true'),env,db,'user')).response.status,403);
 assert.equal((await adminAccess(req('/admin'),env,db,'owner')).response.status,200);
 assert.equal((await adminAccess(req('/api/admin/overview','POST'),env,db,'owner')).response.status,405);
 const data=await(await adminAccess(req('/api/admin/overview'),env,db,'owner')).response.json();assert.equal(data.totalUsers,2);assert.equal(data.users.length,1);
 const status=await(await adminAccess(req('/api/billing/status'),env,db,'owner')).response.json();assert.equal(status.admin,true);assert.equal(status.paid,false);
 assert.equal((await adminAccess(req('/api/billing/checkout','POST'),env,db,'owner')).response.status,409);
});
