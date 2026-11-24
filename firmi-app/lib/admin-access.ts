import { addAdmin, isAdmin, isOwner, listAdmins, removeAdmin, type AdminEnv } from './admin';
import { SECRET_KEYS, setSetting } from './settings';
import { passwordHash } from './password';

export type { AdminEnv } from './admin';

const json = (body: object, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const html = `<!doctype html><html lang="bg"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Администратор</title><style>body{font:16px system-ui;background:#f4f6fa;color:#172436;margin:0}main{max-width:1100px;margin:40px auto;padding:28px;background:white;border-radius:16px}a{color:#194bd1}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:12px;border-bottom:1px solid #ddd}#wrap{overflow:auto}p{line-height:1.6}</style><main><a href="/">← Към справките</a><h1>Администраторски панел</h1><p><a href="/admin/refunds">Искания за възстановяване</a> · <a href="/disclosure">Условия и лимити</a></p><p>Твоят профил има безплатен администраторски достъп. Плащанията на потребителите се управляват отделно.</p><p id="status" role="status">Зареждане…</p><div id="wrap"><table><thead><tr><th>Имейл</th><th>ID</th><th>Регистрация</th><th>Потвърдени плащания</th></tr></thead><tbody id="users"></tbody></table></div><p>Показани са последните 100 профила. Панелът е само за преглед.</p></main><script>
fetch('/api/admin/overview',{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Неуспешна заявка');document.getElementById('status').textContent='Профили: '+d.totalUsers+' · Платени поръчки: '+d.paidOrders;for(const u of d.users){const tr=document.createElement('tr');for(const value of [u.email,u.id,new Date(u.created_at*1000).toLocaleString('bg-BG'),u.paid_orders]){const td=document.createElement('td');td.textContent=String(value);tr.appendChild(td)}document.getElementById('users').appendChild(tr)}}).catch(()=>{document.getElementById('status').textContent='Панелът не може да зареди данните. Провери миграцията за плащанията.'});
</script><footer style="text-align:center;padding:20px 16px;font-size:13px;color:#4b6254">© 2026 Vesteros BG Ltd. · <a href="mailto:office@vesterosbg.online">office@vesterosbg.online</a></footer></html>`;

async function sourceOf(env: object, db: D1DatabaseSession, key: string): Promise<string> {
  try {
    const row = await db.prepare('SELECT value FROM admin_settings WHERE key=?').bind(key).first<{ value: string }>();
    if (row && row.value) return 'd1';
  } catch { /* ignore */ }
  const value = (env as Record<string, unknown>)[key];
  return typeof value === 'string' && value ? 'env' : 'none';
}

/** Only invoked after the existing session has been validated server-side. */
export async function adminAccess(request: Request, env: AdminEnv, db: D1DatabaseSession, userId: string): Promise<{ handled: boolean; response: Response | null }> {
  const url = new URL(request.url);
  const path = url.pathname;
  const admin = await isAdmin(env, db, userId);
  const owner = isOwner(env, userId);
  const adminRoute = path === '/admin' || path.startsWith('/admin/') || path === '/api/admin' || path.startsWith('/api/admin/');

  if (adminRoute) {
    if (!admin) return { handled: true, response: json({ error: 'Само за администратори.' }, 403) };
    if (path === '/api/admin/session') return { handled: true, response: json({ admin: true, owner }) };

    if (path === '/api/admin/settings') {
      if (request.method === 'GET') {
        const settings: Record<string, { configured: boolean; source: string }> = {};
        for (const key of SECRET_KEYS) {
          const source = await sourceOf(env, db, key);
          settings[key] = { configured: source !== 'none', source };
        }
        let eik = false;
        try { eik = Boolean(await db.prepare('SELECT 1 FROM eik_mcp_config WHERE id=1').first()); } catch { eik = false; }
        return { handled: true, response: json({ settings, eikConfigured: eik }) };
      }
      if (request.method === 'POST') {
        if (request.headers.get('Origin') !== url.origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') return { handled: true, response: json({ error: 'Непозволена заявка.' }, 403) };
        let body: Record<string, unknown>;
        try { body = await request.json() as Record<string, unknown>; } catch { return { handled: true, response: json({ error: 'Невалидни данни.' }, 400) }; }
        if (!body || typeof body !== 'object') return { handled: true, response: json({ error: 'Невалидни данни.' }, 400) };
        for (const key of SECRET_KEYS) {
          const value = body[key];
          if (typeof value === 'string' && value.trim()) await setSetting(db, key, value.trim());
        }
        return { handled: true, response: json({ ok: true }) };
      }
      return { handled: true, response: json({ error: 'Методът не е позволен.' }, 405) };
    }

    if (path === '/api/admin/admins') {
      if (!owner) return { handled: true, response: json({ error: 'Само собственикът може да управлява администратори.' }, 403) };
      if (request.method === 'GET') {
        return { handled: true, response: json({ admins: await listAdmins(db) }) };
      }
      if (request.method === 'POST' || request.method === 'DELETE') {
        if (request.headers.get('Origin') !== url.origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') return { handled: true, response: json({ error: 'Непозволена заявка.' }, 403) };
        let body: Record<string, unknown>;
        try { body = await request.json() as Record<string, unknown>; } catch { return { handled: true, response: json({ error: 'Невалидни данни.' }, 400) }; }
        if (request.method === 'POST') {
          const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { handled: true, response: json({ error: 'Въведи валиден имейл.' }, 400) };
          const added = await addAdmin(db, email, userId);
          return { handled: true, response: added ? json({ ok: true }) : json({ error: 'Няма регистриран потребител с този имейл.' }, 404) };
        }
        const target = typeof body.userId === 'string' ? body.userId : '';
        if (target) await removeAdmin(db, target);
        return { handled: true, response: json({ ok: true }) };
      }
      return { handled: true, response: json({ error: 'Методът не е позволен.' }, 405) };
    }

    if (path === '/api/admin/users') {
      if (!owner) return { handled: true, response: json({ error: 'Само собственикът може да управлява потребители.' }, 403) };
      if (request.method !== 'GET') return { handled: true, response: json({ error: 'Методът не е позволен.' }, 405) };
      const rows = await db.prepare("SELECT u.id,u.email,u.created_at,(SELECT 1 FROM admin_users a WHERE a.user_id=u.id) AS is_admin FROM auth_users u ORDER BY u.created_at DESC LIMIT 200").all();
      return { handled: true, response: json({ users: rows.results }) };
    }

    if (path === '/api/admin/users/reset-password') {
      if (!owner) return { handled: true, response: json({ error: 'Само собственикът може да променя пароли.' }, 403) };
      if (request.method !== 'POST') return { handled: true, response: json({ error: 'Методът не е позволен.' }, 405) };
      if (request.headers.get('Origin') !== url.origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') return { handled: true, response: json({ error: 'Непозволена заявка.' }, 403) };
      let body: Record<string, unknown>;
      try { body = await request.json() as Record<string, unknown>; } catch { return { handled: true, response: json({ error: 'Невалидни данни.' }, 400) }; }
      const target = typeof body.userId === 'string' ? body.userId : '';
      const password = typeof body.password === 'string' ? body.password : '';
      if (!target) return { handled: true, response: json({ error: 'Липсва потребител.' }, 400) };
      if (password.length < 8 || password.length > 128) return { handled: true, response: json({ error: 'Паролата трябва да е между 8 и 128 символа.' }, 400) };
      const pepper = env.AUTH_PEPPER;
      if (!pepper) return { handled: true, response: json({ error: 'Сървърът не е конфигуриран.' }, 500) };
      const hash = await passwordHash(password, pepper);
      const updated = await db.prepare('UPDATE auth_users SET password_hash=? WHERE id=?').bind(hash, target).run();
      if (!updated.meta.changes) return { handled: true, response: json({ error: 'Няма такъв потребител.' }, 404) };
      await db.prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(target).run();
      return { handled: true, response: json({ ok: true }) };
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') return { handled: true, response: json({ error: 'Методът не е позволен.' }, 405) };
    if (path === '/admin') return { handled: true, response: new Response(request.method === 'HEAD' ? null : html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'" } }) };
    if (path === '/api/admin/overview') {
      const totals = await db.prepare("SELECT (SELECT COUNT(*) FROM auth_users) AS totalUsers,(SELECT COUNT(*) FROM billing_orders WHERE status='paid') AS paidOrders").first();
      const rows = await db.prepare("SELECT u.id,u.email,u.created_at,(SELECT COUNT(*) FROM billing_orders b WHERE b.user_id=u.id AND b.status='paid') AS paid_orders FROM auth_users u ORDER BY u.created_at DESC LIMIT 100").all();
      return { handled: true, response: json({ ...totals, users: rows.results }) };
    }
    return { handled: true, response: json({ error: 'Няма такъв адрес.' }, 404) };
  }

  if (!admin) return { handled: false, response: null };
  if (path === '/api/billing/status') return { handled: true, response: json({ paid: false, admin: true, access: true }) };
  if (path === '/api/billing/checkout') return { handled: true, response: json({ error: 'Администраторският ти достъп е безплатен.' }, 409) };
  if (path === '/billing') return { handled: true, response: new Response(null, { status: 303, headers: { Location: '/admin', 'Cache-Control': 'no-store' } }) };
  // A real session and explicit server configuration are required. No fake payment records.
  return { handled: true, response: null };
}