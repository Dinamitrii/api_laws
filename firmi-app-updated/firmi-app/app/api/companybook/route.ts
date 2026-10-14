import { env } from "cloudflare:workers";

export async function GET(){
 return Response.json({configured: Boolean(env.COMPANYBOOK_API_KEY?.trim())},{headers:{"Cache-Control":"no-store"}});
}

export async function POST(request:Request){
 const json=(data:object,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
 try{const parsed=await request.json();if(!parsed||typeof parsed!=='object')return json({error:'Невалидна заявка.'},400);const b=parsed as Record<string,unknown>;const key=(typeof b.key==='string'?b.key.trim():'')||env.COMPANYBOOK_API_KEY?.trim();if(!key)return json({error:'Липсва API ключ.'},400);let path:string;
 if(b.action==='search'){if(typeof b.query!=='string'||b.query.trim().length<3||b.query.length>200)return json({error:'Въведи между 3 и 200 символа.'},400);const q=b.query.trim();const p=new URLSearchParams({limit:'20',offset:'0'});p.set(/^(BG)?\d{9,13}$/i.test(q)?'uic':'name',q.replace(/^BG(?=\d)/i,''));path='/api/v2/companies/search?'+p}
 else if(b.action==='detail'&&typeof b.uic==='string'&&/^(BG)?\d{9,13}$/i.test(b.uic))path='/api/companies/'+encodeURIComponent(b.uic)+'?with_data=true';else return json({error:'Невалидна заявка.'},400);
 const r=await fetch('https://api.companybook.bg'+path,{headers:{'X-API-Key':key,Accept:'application/json'},signal:AbortSignal.timeout(15000),redirect:'manual'});
 if(r.status>=300&&r.status<400)return json({error:'TheCompanyBook върна неочаквано пренасочване.'},502);
 if(!r.ok){const messages:Record<number,string>={400:'Невалидни параметри.',401:'API ключът е невалиден.',403:'Ключът няма достъп до тази справка.',404:'Фирмата не е намерена.',429:'Достигнат е лимитът за заявки. Опитай по-късно.'};return json({error:messages[r.status]||'TheCompanyBook временно не отговаря.'},r.status)}return json(await r.json());
 }catch(e){
 const err=e as {name?:string;cause?:{code?:string}};
 if(err.name==='SyntaxError')return json({error:'Невалиден JSON в заявката или отговора.'},400);
 if(err.name==='TimeoutError'||err.name==='AbortError')return json({error:'TheCompanyBook не отговори в рамките на 15 секунди. Опитай отново.'},504);
 if(err.cause?.code==='ENOTFOUND'||err.cause?.code==='EAI_AGAIN')return json({error:'Сървърът на приложението няма мрежов достъп до TheCompanyBook. Провери интернет връзката при стартиране.'},502);
 return json({error:'Сървърът не успя да се свърже с TheCompanyBook. Опитай отново.'},502)
 }
}
