export interface UsageEnv { ADMIN_USER_IDS?:string }
export const FREE_LIMIT=25;
export function usageMonth(now=new Date()) {
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Sofia',year:'numeric',month:'2-digit'}).formatToParts(now);
 return `${parts.find(p=>p.type==='year')!.value}-${parts.find(p=>p.type==='month')!.value}`;
}
const json=(body:object,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function freeUsageGate(request:Request,env:UsageEnv,db:D1DatabaseSession,userId:string):Promise<{handled:boolean;response:Response|null}> {
 const path=new URL(request.url).pathname;
 const api=['/api/companybook','/api/magistrat','/api/vies'].includes(path);
 const status=path==='/api/usage';
 const workspace=['/','/app','/app/'].includes(path);
 if(!api&&!status&&!workspace)return{handled:false,response:null};
 const admin=(env.ADMIN_USER_IDS??'').split(',').map(s=>s.trim()).includes(userId);
 const paid=admin?false:Boolean(await db.prepare("SELECT id FROM billing_orders WHERE user_id=? AND status='paid' LIMIT 1").bind(userId).first());
 const month=usageMonth();
 if(status){
  if(request.method!=='GET')return{handled:true,response:json({error:'Методът не е позволен.'},405)};
  const row=admin||paid?null:await db.prepare('SELECT used FROM free_monthly_usage WHERE user_id=? AND month=?').bind(userId,month).first<{used:number}>();
  const used=row?.used??0;
  return{handled:true,response:json({plan:admin?'admin':paid?'paid':'free',limit:admin||paid?null:FREE_LIMIT,used,remaining:admin||paid?null:Math.max(0,FREE_LIMIT-used),month,timezone:'Europe/Sofia'})};
 }
 if(admin||paid)return{handled:true,response:null};
 if(api&&request.method==='POST'){
  const url=new URL(request.url);
  if(request.headers.get('Origin')!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site')return{handled:true,response:json({error:'Непозволена заявка.'},403)};
  // A single atomic statement admits at most 25 calls, including concurrent requests.
  const row=await db.prepare(`INSERT INTO free_monthly_usage(user_id,month,used) VALUES(?,?,1)
   ON CONFLICT(user_id,month) DO UPDATE SET used=used+1 WHERE used<25 RETURNING used`).bind(userId,month).first();
  if(!row)return{handled:true,response:json({error:'Използва всички 25 безплатни заявки за този месец. Лимитът се подновява на 1-во число по българско време.',limit:25,remaining:0,billingUrl:'/billing'},429)};
 }
 return{handled:true,response:null};
}
