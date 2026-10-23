import fs from 'node:fs';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const authPath=root+'lib/account-auth.ts';let auth=fs.readFileSync(authPath,'utf8');
if(!auth.includes('const freeResult = await freeUsageGate(')){
 const early='  const url = new URL(request.url);';
 const before=auth.includes('    const adminResult = await adminAccess(')?'    const adminResult = await adminAccess(':auth.includes('    return await billingGate(request, env, db, session.user_id);')?'    return await billingGate(request, env, db, session.user_id);':null;
 if(!before||!auth.includes(early))throw Error('Не е намерена очакваната Stripe/accountGate интеграция. Нищо не е променено.');
 auth="import { freeUsageGate } from './free-usage';\nimport { refundPolicyPage, refundGate } from './refund-policy';\n"+auth;
 auth=auth.replace(early,early+'\n  const policy = refundPolicyPage(request);\n  if (policy) return policy;');
 auth=auth.replace(before,"    const refund = await refundGate(request, env, db, session.user_id);\n    if (refund) return refund;\n    const freeResult = await freeUsageGate(request, env, db, session.user_id);\n    if (freeResult.handled) return freeResult.response;\n"+before);
 if(!auth.includes('AdminEnv')&&!auth.includes('ADMIN_USER_IDS?:'))auth=auth.replace('export interface AccountEnv extends BillingEnv {','export interface AccountEnv extends BillingEnv {\n  ADMIN_USER_IDS?: string;');
 fs.writeFileSync(authPath,auth);
}
const layoutPath=root+'app/layout.tsx';let layout=fs.readFileSync(layoutPath,'utf8');
if(!layout.includes('<UsageBanner')){
 if(!/<body\b[^>]*>/.test(layout))throw Error('Добави UsageBanner ръчно в layout.tsx. accountGate вече е настроен.');
 layout="import UsageBanner from '../components/usage-banner';\n"+layout;
 layout=layout.replace(/<body\b[^>]*>/,s=>s+'<UsageBanner />');fs.writeFileSync(layoutPath,layout);
}
const billingPath=root+'lib/stripe-billing.ts';let billing=fs.readFileSync(billingPath,'utf8');
if(!billing.includes('href="/refund-policy"')){
 billing=billing.replace('<h1>Плащания и достъп</h1>','<h1>Плащания и достъп</h1><p><strong>Безплатен план: 25 заявки на месец.</strong> <a href="/refund-policy">Политика за възстановяване на плащания</a></p>');fs.writeFileSync(billingPath,billing);
}
const adminPath=root+'lib/admin-access.ts';if(fs.existsSync(adminPath)){let admin=fs.readFileSync(adminPath,'utf8');if(!admin.includes('href="/admin/refunds"')){admin=admin.replace('<h1>Администраторски панел</h1>','<h1>Администраторски панел</h1><p><a href="/admin/refunds">Искания за възстановяване</a></p>');fs.writeFileSync(adminPath,admin)}}
console.log('Добавени са 25 безплатни заявки, видим брояч и политика за възстановяване. Изпълни миграция 0003 преди deploy.');
