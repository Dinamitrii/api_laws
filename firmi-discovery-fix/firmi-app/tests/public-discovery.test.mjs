import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle=await build({entryPoints:['lib/account-auth.ts'],bundle:true,format:'esm',platform:'neutral',write:false});
const {accountGate}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const get=(path,method='GET')=>accountGate(new Request('https://firmi.test'+path,{method}),{}, {waitUntil(){}});
test('discovery is public before auth configuration, with actual Markdown and JSON',async()=>{
 const text=await get('/llms.txt');assert.equal(text.status,200);
 const body=await text.text();assert.match(body,/^# .+/m);assert.match(body,/\[.+\]\(https:\/\//);
 for(const path of ['/ai-catalog.json','/.well-known/ai-catalog.json','/.well-known/ard.json']){
  const response=await get(path);assert.equal(response.status,200);assert.match(response.headers.get('Content-Type'),/application\/json/);
  const catalog=await response.json();assert.equal(catalog.entries.length,1);
  const entry=catalog.entries[0];assert.equal(entry.url,'https://firmi.test/llms.txt');assert.equal(entry.type,'text/markdown');assert.match(entry.identifier,/^urn:air:/);
 }
 assert.equal(await (await get('/llms.txt','HEAD')).text(),'');
 assert.equal((await get('/llms.txt','POST')).status,405);
 assert.equal((await get('/api/companybook')).status,503);
 assert.equal((await get('/.well-known/secret')).status,503);
});
