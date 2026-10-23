import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const path=root+'lib/account-auth.ts';let source=fs.readFileSync(path,'utf8');
if(!source.includes('const adminResult = await adminAccess(')){
 const anchor='    return await billingGate(request, env, db, session.user_id);';
 if(!source.includes(anchor)||!source.includes('export interface AccountEnv extends BillingEnv {'))throw Error('Липсва очакваната Stripe интеграция. Нищо не е променено.');
 source="import { adminAccess, type AdminEnv } from './admin-access';\n"+source;
 source=source.replace('export interface AccountEnv extends BillingEnv {','export interface AccountEnv extends BillingEnv, AdminEnv {');
 source=source.replace(anchor,'    const adminResult = await adminAccess(request, env, db, session.user_id);\n    if (adminResult.handled) return adminResult.response;\n'+anchor);
 fs.writeFileSync(path,source);
}
const pagePath=root+'app/page.tsx';let page=fs.readFileSync(pagePath,'utf8');
if(!page.includes('href="/admin"')&&page.includes('<header>'))fs.writeFileSync(pagePath,page.replace('<header>','<header><a href="/admin">Администратор</a>'));
console.log('Администраторският панел е добавен. Настрой ADMIN_USER_IDS в Cloudflare.');
