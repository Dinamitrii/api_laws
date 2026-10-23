import {loadEnvFile} from 'node:process';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
const root=fileURLToPath(new URL('../',import.meta.url));
const keys=['STRIPE_SECRET_KEY','STRIPE_PRICE_ID','STRIPE_APP_URL','STRIPE_WEBHOOK_SECRET','TURNSTILE_SECRET_KEY'];
try {loadEnvFile(root+'.env.local')} catch {console.error('Не мога да прочета firmi-app/.env.local.');process.exit(1)}
const missing=keys.filter(key=>!process.env[key]?.trim());
if(missing.length){console.error('Липсват настройки в .env.local: '+missing.join(', '));process.exit(1)}
const payload=Object.fromEntries(keys.map(key=>[key,process.env[key].trim()]));
if(!/^sk_(test|live)_/.test(payload.STRIPE_SECRET_KEY)||!payload.STRIPE_PRICE_ID.startsWith('price_')||!payload.STRIPE_WEBHOOK_SECRET.startsWith('whsec_')){
 console.error('Провери форматите: STRIPE_SECRET_KEY=sk_..., STRIPE_PRICE_ID=price_..., STRIPE_WEBHOOK_SECRET=whsec_...');process.exit(1);
}
try {if(new URL(payload.STRIPE_APP_URL).protocol!=='https:')throw Error()}catch{console.error('STRIPE_APP_URL трябва да е пълен HTTPS адрес.');process.exit(1)}
if(!fs.existsSync(root+'dist/server/wrangler.json')){console.error('Първо изпълни npm run build.');process.exit(1)}
const result=spawnSync(process.execPath,[root+'node_modules/wrangler/bin/wrangler.js','secret','bulk','--config',root+'dist/server/wrangler.json','--name','firmi'],{
 cwd:root,input:JSON.stringify(payload),encoding:'utf8',stdio:['pipe','pipe','pipe'],
});
// Never echo CLI logs: a failure may include request contents.
if(result.error||result.status!==0){console.error('Качването не успя. Провери Cloudflare входа (npx wrangler login) и интернет връзката. Стойностите не са показани.');process.exit(1)}
console.log('Stripe настройките и Turnstile secret са качени в firmi. Презареди /auth и /billing.');
