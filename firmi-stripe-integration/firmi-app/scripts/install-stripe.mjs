import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const path=root+'lib/account-auth.ts';
let auth=fs.readFileSync(path,'utf8');
if(!auth.includes("from './stripe-billing'")){
 const anchors=["import { accountPage } from './account-page';",'export interface AccountEnv {',"  const auth = url.pathname.startsWith('/api/auth/');",'    return null;\n  } catch {'];
 for(const anchor of anchors)if(!auth.includes(anchor))throw Error('Непозната версия на account-auth.ts. Нужно е ръчно сливане.');
 auth=auth.replace(anchors[0],anchors[0]+"\nimport { billingGate, stripeWebhook, type BillingEnv } from './stripe-billing';")
 .replace(anchors[1],'export interface AccountEnv extends BillingEnv {')
 .replace(anchors[2],"  if (url.pathname === '/api/stripe/webhook') return stripeWebhook(request, env);\n"+anchors[2])
 .replace('.first() : null;','.first<{user_id: string}>() : null;')
 .replace(anchors[3],'    return await billingGate(request, env, db, session.user_id);\n  } catch {');
 fs.writeFileSync(path,auth);
}
const pagePath=root+'app/page.tsx';
let page=fs.readFileSync(pagePath,'utf8');
if(!page.includes('href="/billing"')){
 if(page.includes('<header>')){page=page.replace('<header>','<header><a href="/billing">Плащания</a>');fs.writeFileSync(pagePath,page)}
 else console.log('Добави връзка към /billing в интерфейса.');
}
console.log('Stripe е свързан. Следвай STRIPE-SETUP.md.');
