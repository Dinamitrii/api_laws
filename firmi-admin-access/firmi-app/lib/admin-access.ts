export interface AdminEnv { ADMIN_USER_IDS?: string }
const json=(body:object,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const html=`<!doctype html><html lang="bg"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Администратор</title><style>body{font:16px system-ui;background:#f4f6fa;color:#172436;margin:0}main{max-width:1100px;margin:40px auto;padding:28px;background:white;border-radius:16px}a{color:#194bd1}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:12px;border-bottom:1px solid #ddd}#wrap{overflow:auto}p{line-height:1.6}</style><main><a href="/">← Към справките</a><h1>Администраторски панел</h1><p>Твоят профил има безплатен администраторски достъп. Плащанията на потребителите се управляват отделно.</p><p id="status" role="status">Зареждане…</p><div id="wrap"><table><thead><tr><th>Имейл</th><th>ID</th><th>Регистрация</th><th>Потвърдени плащания</th></tr></thead><tbody id="users"></tbody></table></div><p>Показани са последните 100 профила. Панелът е само за преглед.</p></main><script>
fetch('/api/admin/overview',{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Неуспешна заявка');document.getElementById('status').textContent='Профили: '+d.totalUsers+' · Платени поръчки: '+d.paidOrders;for(const u of d.users){const tr=document.createElement('tr');for(const value of [u.email,u.id,new Date(u.created_at*1000).toLocaleString('bg-BG'),u.paid_orders]){const td=document.createElement('td');td.textContent=String(value);tr.appendChild(td)}document.getElementById('users').appendChild(tr)}}).catch(()=>{document.getElementById('status').textContent='Панелът не може да зареди данните. Провери миграцията за плащанията.'});
</script></html>`;
/** Only invoked after the existing session has been validated server-side. */
export async function adminAccess(request:Request,env:AdminEnv,db:D1DatabaseSession,userId:string):Promise<{handled:boolean;response:Response|null}> {
 const path=new URL(request.url).pathname;
 const admin=(env.ADMIN_USER_IDS??'').split(',').map(x=>x.trim()).filter(Boolean).includes(userId);
 const adminRoute=path==='/admin'||path.startsWith('/admin/')||path==='/api/admin'||path.startsWith('/api/admin/');
 if(adminRoute){
  if(!admin)return {handled:true,response:json({error:'Само за администратори.'},403)};
  if(request.method!=='GET'&&request.method!=='HEAD')return {handled:true,response:json({error:'Методът не е позволен.'},405)};
  if(path==='/admin')return {handled:true,response:new Response(request.method==='HEAD'?null:html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"}})};
  if(path==='/api/admin/overview'){
   const totals=await db.prepare("SELECT (SELECT COUNT(*) FROM auth_users) AS totalUsers,(SELECT COUNT(*) FROM billing_orders WHERE status='paid') AS paidOrders").first();
   const rows=await db.prepare("SELECT u.id,u.email,u.created_at,(SELECT COUNT(*) FROM billing_orders b WHERE b.user_id=u.id AND b.status='paid') AS paid_orders FROM auth_users u ORDER BY u.created_at DESC LIMIT 100").all();
   return {handled:true,response:json({...totals,users:rows.results})};
  }
  return {handled:true,response:json({error:'Няма такъв адрес.'},404)};
 }
 if(!admin)return {handled:false,response:null};
 if(path==='/api/billing/status')return {handled:true,response:json({paid:false,admin:true,access:true})};
 if(path==='/api/billing/checkout')return {handled:true,response:json({error:'Администраторският ти достъп е безплатен.'},409)};
 if(path==='/billing')return {handled:true,response:new Response(null,{status:303,headers:{Location:'/admin','Cache-Control':'no-store'}})};
 // A real session and explicit server configuration are required. No fake payment records.
 return {handled:true,response:null};
}
