'use client';
import {useCallback,useEffect,useState} from 'react';
type Usage={plan:string;used:number;remaining:number|null};
export default function UsageBanner(){
 const [usage,setUsage]=useState<Usage|null>(null);
 const refresh=useCallback(()=>{fetch('/api/usage',{cache:'no-store'}).then(r=>r.ok?r.json():null).then((data:unknown)=>{if(data&&typeof data==='object'&&'plan' in data&&typeof data.plan==='string'&&'used' in data&&typeof data.used==='number'&&'remaining' in data&&(typeof data.remaining==='number'||data.remaining===null))setUsage({plan:data.plan,used:data.used,remaining:data.remaining});else setUsage(null)}).catch(()=>setUsage(null))},[]);
 useEffect(()=>{
  refresh();const timer=setInterval(refresh,15000);window.addEventListener('focus',refresh);
  return()=>{clearInterval(timer);window.removeEventListener('focus',refresh)};
 },[refresh]);
 return <div style={{background:'#eaf4ed',borderBottom:'1px solid #c4d8ca',padding:'12px 20px',color:'#18332a',fontSize:15,lineHeight:1.6}}>
  <strong>{usage?.plan==='admin'?'Администратор · безплатен достъп без месечен лимит':usage?.plan==='paid'?'Платен достъп':'Безплатен план · 25 заявки на месец'}</strong>
  {usage?.plan==='free'&&<span role="status"> · Използвани: {usage.used}/25 · Остават: {usage.remaining}</span>}
  <span> · <a href="/refund-policy">Политика за възстановяване</a></span>
  {(!usage||usage.plan==='free')&&<small style={{display:'block'}}>Лимитът е за профил и се подновява на 1-во число по българско време. Всяка изпратена справка, търсене, страница с резултати или пълен документ е 1 заявка, включително при неуспешен отговор. Прегледът на страниците не изразходва заявки.</small>}
 </div>;
}
