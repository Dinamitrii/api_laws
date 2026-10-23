export interface BillingEnv {
  AUTH_DB?: D1Database;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_ID?: string;
  STRIPE_REQUIRE_PAYMENT?: string;
  STRIPE_APP_URL?: string;
}
const json = (body: object, status = 200) => Response.json(body, {status, headers: {'Cache-Control':'no-store'}});
const encoder = new TextEncoder();

export async function validStripeSignature(raw: string, header: string, secret: string, now = Date.now()) {
  const parts = header.split(',').map(p => p.trim().split('='));
  const timestamp = parts.find(p => p[0] === 't')?.[1] ?? '';
  if (!/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['verify']);
  for (const [name, value] of parts) {
    if (name !== 'v1' || !/^[a-f0-9]{64}$/.test(value ?? '')) continue;
    const bytes = Uint8Array.from(value.match(/../g)!, b => parseInt(b, 16));
    if (await crypto.subtle.verify('HMAC', key, bytes, encoder.encode(`${timestamp}.${raw}`))) return true;
  }
  return false;
}
async function stripe(env: BillingEnv, path: string, body: URLSearchParams, idempotency: string) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method:'POST', headers:{Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type':'application/x-www-form-urlencoded', 'Idempotency-Key':idempotency},
    body, signal:AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Error('Stripe request failed');
  return response.json() as Promise<{id:string;url:string}>;
}
export async function stripeWebhook(request: Request, env: BillingEnv): Promise<Response> {
  if (request.method !== 'POST') return json({error:'Методът не е позволен.'},405);
  if (!env.AUTH_DB || !env.STRIPE_WEBHOOK_SECRET) return json({error:'Плащанията още се настройват.'},503);
  try {
    const reader = request.body?.getReader();
    if (!reader) return json({error:'Липсва заявка.'},400);
    const chunks: Uint8Array[] = []; let size = 0;
    for (;;) {
      const {value,done} = await reader.read(); if (done) break;
      size += value.length;
      if (size > 262144) { await reader.cancel(); return json({error:'Твърде голяма заявка.'},413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length; }
    const raw = new TextDecoder().decode(bytes);
    if (!await validStripeSignature(raw, request.headers.get('Stripe-Signature') ?? '', env.STRIPE_WEBHOOK_SECRET)) return json({error:'Невалиден подпис.'},400);
    let event;
    try { event = JSON.parse(raw); } catch { return json({error:'Невалиден JSON.'},400); }
    if (!['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)) return json({received:true});
    const session = event.data?.object;
    if (session?.mode !== 'payment' || session.payment_status !== 'paid') return json({received:true});
    const orderId = session.metadata?.order_id;
    if (typeof orderId !== 'string' || typeof session.id !== 'string') return json({received:true});
    const db = env.AUTH_DB.withSession('first-primary');
    const order = await db.prepare('SELECT id,user_id,price_id,session_id FROM billing_orders WHERE id=?').bind(orderId)
      .first<{id:string;user_id:string;price_id:string;session_id:string|null}>();
    // Ignore unrelated Checkout sessions. The order exists before the Stripe request.
    if (!order || session.client_reference_id !== order.user_id || session.metadata?.price_id !== order.price_id || (order.session_id && order.session_id !== session.id)) return json({received:true});
    // Atomic and repeatable: duplicate deliveries never grant additional access.
    await db.prepare("UPDATE billing_orders SET status='paid',session_id=?,paid_at=COALESCE(paid_at,?) WHERE id=?")
      .bind(session.id, Math.floor(Date.now()/1000), order.id).run();
    return json({received:true});
  } catch { return json({error:'Временно неуспешна обработка.'},503); }
}
const page = `<!doctype html><html lang="bg"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Плащания</title><style>body{font:17px system-ui;background:#f5f7fb;color:#172436;margin:0}main{max-width:560px;margin:8vh auto;background:white;padding:32px;border-radius:20px}button,a{font:inherit}button{background:#183dce;color:white;padding:14px 22px;border:0;border-radius:8px;cursor:pointer}button:disabled{opacity:.5}p{line-height:1.6}a{color:#183dce}</style><main><a href="/">← Към справките</a><h1>Плащания и достъп</h1><p>Еднократно плащане за достъп до фирмените справки. Точната цена и валутата ще видиш в Stripe преди потвърждение.</p><p id="status" role="status">Проверяваме достъпа…</p><button id="pay" disabled>Продължи към Stripe</button><p>След плащане достъпът се активира при потвърждение от Stripe.</p><button id="check">Провери плащането</button></main><script>
const statusText=document.getElementById('status'),pay=document.getElementById('pay');
async function check(){try{const r=await fetch('/api/billing/status');const d=await r.json();if(!r.ok)throw Error(d.error||'Неуспешна проверка.');statusText.textContent=d.paid?'Плащането е потвърдено. Достъпът е активен.':d.configured?'Няма потвърдено плащане. Ако току-що плати, провери отново след няколко секунди.':'Плащанията още се настройват.';pay.disabled=d.paid||!d.configured;}catch(e){statusText.textContent=e.message;}}
pay.onclick=async()=>{pay.disabled=true;try{const r=await fetch('/api/billing/checkout',{method:'POST'});const d=await r.json();if(!r.ok)throw Error(d.error||'Неуспешно плащане.');location.assign(d.url);}catch(e){statusText.textContent=e.message;pay.disabled=false;}};
document.getElementById('check').onclick=check;check();
</script></html>`;
export async function billingGate(request: Request, env: BillingEnv, db: D1DatabaseSession, userId: string): Promise<Response|null> {
  const url = new URL(request.url);
  const configured = Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET && env.STRIPE_PRICE_ID && env.STRIPE_APP_URL);
  if (url.pathname === '/billing') return new Response(page, {headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"}});
  const billing = url.pathname.startsWith('/api/billing/');
  if (!billing && env.STRIPE_REQUIRE_PAYMENT !== 'true') return null;
  const paid = Boolean(await db.prepare("SELECT id FROM billing_orders WHERE user_id=? AND status='paid' LIMIT 1").bind(userId).first());
  if (url.pathname === '/api/billing/status' && request.method === 'GET') return json({paid,configured});
  if (url.pathname === '/api/billing/checkout') {
    if (request.method !== 'POST') return json({error:'Методът не е позволен.'},405);
    if (request.headers.get('Origin') !== url.origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') return json({error:'Непозволена заявка.'},403);
    if (paid) return json({error:'Вече имаш платен достъп.'},409);
    if (!configured) return json({error:'Плащанията още се настройват.'},503);
    try {
      const origin = new URL(env.STRIPE_APP_URL!).origin;
      if (origin !== url.origin || !origin.startsWith('https://')) return json({error:'Невалиден адрес за плащания.'},503);
      const id = crypto.randomUUID();
      await db.prepare('INSERT INTO billing_orders(id,user_id,price_id,created_at) VALUES(?,?,?,?)').bind(id,userId,env.STRIPE_PRICE_ID!,Math.floor(Date.now()/1000)).run();
      const session = await stripe(env,'checkout/sessions',new URLSearchParams({mode:'payment','payment_method_types[0]':'card','line_items[0][price]':env.STRIPE_PRICE_ID!,'line_items[0][quantity]':'1',client_reference_id:userId,'metadata[order_id]':id,'metadata[price_id]':env.STRIPE_PRICE_ID!,success_url:`${origin}/billing?payment=success`,cancel_url:`${origin}/billing?payment=cancelled`}),id);
      if (!session.id || !session.url || new URL(session.url).origin !== 'https://checkout.stripe.com') throw Error('Invalid Checkout session');
      await db.prepare('UPDATE billing_orders SET session_id=? WHERE id=?').bind(session.id,id).run();
      return json({url:session.url});
    } catch { return json({error:'Плащането не може да се отвори. Опитай отново.'},503); }
  }
  if (billing) return json({error:'Няма такъв адрес или метод.'},404);
  if (paid) return null;
  return url.pathname.startsWith('/api/') ? json({error:'Необходимо е плащане за достъп.',billingUrl:'/billing'},402)
    : new Response(null,{status:303,headers:{Location:'/billing','Cache-Control':'no-store'}});
}
