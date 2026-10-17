import { accountPage } from './account-page';

export interface AccountEnv {
  AUTH_DB?: D1Database;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  AUTH_PEPPER?: string;
}
const COOKIE = '__Host-predictorian-session';
const TTL = 7 * 24 * 60 * 60;
const encoder = new TextEncoder();
const hex = (bytes: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(bytes instanceof Uint8Array ? bytes.buffer as ArrayBuffer : bytes), b => b.toString(16).padStart(2, '0')).join('');
const random = (length: number) => hex(crypto.getRandomValues(new Uint8Array(length)));
const digest = async (value: string) => hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
const reply = (body: object, status = 200, headers: Record<string, string> = {}) => Response.json(body, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers },
});
const cookie = (token: string, age = TTL) => `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
function sessionToken(request: Request) {
  return request.headers.get('Cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1) ?? '';
}
export async function passwordHash(password: string, pepper: string, salt = random(32)) {
  const pepperKey = await crypto.subtle.importKey('raw', encoder.encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const material = await crypto.subtle.sign('HMAC', pepperKey, encoder.encode(password));
  const key = await crypto.subtle.importKey('raw', material, 'PBKDF2', false, ['deriveBits']);
  // Workers supports at most 100,000 PBKDF2 iterations. A separately stored
  // server pepper also protects passwords if only the database is disclosed.
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-512', iterations: 100000, salt: encoder.encode(salt) }, key, 512);
  return `pbkdf2-sha512-v1$${salt}$${hex(bits)}`;
}
export async function passwordMatches(password: string, pepper: string, stored: string) {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'pbkdf2-sha512-v1' || !/^[a-f0-9]{64}$/.test(parts[1]) || !/^[a-f0-9]{128}$/.test(parts[2])) return false;
  const candidate = await passwordHash(password, pepper, parts[1]);
  let difference = candidate.length ^ stored.length;
  for (let i = 0; i < candidate.length; i++) difference |= candidate.charCodeAt(i) ^ stored.charCodeAt(i);
  return difference === 0;
}
async function limited(db: D1DatabaseSession, key: string, limit: number) {
  const now = Math.floor(Date.now() / 1000);
  const row = await db.prepare(`INSERT INTO auth_attempts (key,count,expires_at) VALUES (?,1,?)
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END,
    expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING count`)
    .bind(key, now + 900, now, now).first<{count: number}>();
  return !row || row.count > limit;
}

/** Runs before Vinext, so API calls and prerendered pages cannot bypass auth. */
export async function accountGate(request: Request, env: AccountEnv, ctx: { waitUntil(promise: Promise<unknown>): void }): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/_next/static/') || ['/favicon.svg', '/favicon.ico'].includes(url.pathname)) return null;
  const auth = url.pathname.startsWith('/api/auth/');
  if (!env.AUTH_DB || !env.AUTH_PEPPER || !env.TURNSTILE_SECRET_KEY || !env.TURNSTILE_SITE_KEY) {
    return auth ? reply({ error: 'Регистрацията още се настройва. Опитай по-късно.' }, 503)
      : new Response('Регистрацията още се настройва. Опитай по-късно.', { status: 503, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  const db = env.AUTH_DB.withSession('first-primary');
  try {
    if (auth) {
      if (request.method !== 'POST') return reply({ error: 'Методът не е позволен.' }, 405, { Allow: 'POST' });
      if (request.headers.get('Origin') !== url.origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') return reply({ error: 'Непозволена заявка.' }, 403);
      if (url.pathname === '/api/auth/logout') {
        await db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(await digest(sessionToken(request))).run();
        return reply({ ok: true }, 200, { 'Set-Cookie': cookie('', 0) });
      }
      if (!['/api/auth/register', '/api/auth/login'].includes(url.pathname)) return reply({ error: 'Няма такъв адрес.' }, 404);
      if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return reply({ error: 'Невалиден формат.' }, 415);
      // Stream limit also covers requests without a Content-Length header.
      const reader = request.body?.getReader();
      if (!reader) return reply({ error: 'Липсват данни.' }, 400);
      let size = 0;
      const chunks: Uint8Array[] = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 8192) { await reader.cancel(); return reply({ error: 'Твърде голяма заявка.' }, 413); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      let body: Record<string, unknown>;
      try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { return reply({ error: 'Невалидни данни.' }, 400); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({ error: 'Невалидни данни.' }, 400);
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      const token = typeof body.turnstile === 'string' ? body.turnstile : '';
      const registering = url.pathname.endsWith('/register');
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || password.length > 128) return reply({ error: 'Въведи валиден имейл и парола от 12 до 128 символа.' }, 400);
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      const ipKey = await digest(env.AUTH_PEPPER + ':ip:' + ip);
      const emailKey = await digest(env.AUTH_PEPPER + ':email:' + email);
      if (await limited(db, `${registering ? 'register' : 'login'}:ip:${ipKey}`, registering ? 5 : 20) || await limited(db, `account:${emailKey}`, 10)) {
        return reply({ error: 'Твърде много опити. Опитай след 15 минути.' }, 429, { 'Retry-After': '900' });
      }
      if (!token || token.length > 2048 || body.website) return reply({ error: 'Потвърди проверката срещу ботове.' }, 400);
      const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token, ...(ip !== 'unknown' ? { remoteip: ip } : {}) }),
        signal: AbortSignal.timeout(10000),
      });
      const result = await verification.json() as { success?: boolean; hostname?: string; action?: string };
      if (!verification.ok || result.success !== true || result.hostname !== url.hostname || result.action !== (registering ? 'register' : 'login')) return reply({ error: 'Проверката срещу ботове е неуспешна. Опитай отново.' }, 400);
      const now = Math.floor(Date.now() / 1000);
      let user = await db.prepare('SELECT id,password_hash FROM auth_users WHERE email=?').bind(email).first<{id: string; password_hash: string}>();
      if (registering) {
        const hash = await passwordHash(password, env.AUTH_PEPPER);
        if (user) return reply({ error: 'Регистрацията не е възможна с този имейл. Ако имаш профил, избери Вход.' }, 409);
        const id = crypto.randomUUID();
        const inserted = await db.prepare('INSERT INTO auth_users (id,email,password_hash,created_at) VALUES (?,?,?,?) ON CONFLICT(email) DO NOTHING').bind(id, email, hash, now).run();
        if (!inserted.meta.changes) return reply({ error: 'Регистрацията не е възможна с този имейл.' }, 409);
        user = { id, password_hash: hash };
      } else {
        // Same KDF work for unknown addresses; never reveal which part failed.
        const valid = user ? await passwordMatches(password, env.AUTH_PEPPER, user.password_hash) : (await passwordHash(password, env.AUTH_PEPPER), false);
        if (!valid || !user) return reply({ error: 'Невалиден имейл или парола.' }, 401);
      }
      const session = random(32);
      const statements = [db.prepare('INSERT INTO auth_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await digest(session), user.id, now + TTL)];
      const previous = sessionToken(request);
      if (previous) statements.push(db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(await digest(previous)));
      await db.batch(statements);
      ctx.waitUntil(db.batch([
        db.prepare('DELETE FROM auth_sessions WHERE expires_at<=?').bind(now),
        db.prepare('DELETE FROM auth_attempts WHERE expires_at<=?').bind(now),
      ]));
      return reply({ ok: true }, 200, { 'Set-Cookie': cookie(session) });
    }
    const token = sessionToken(request);
    const session = /^[a-f0-9]{64}$/.test(token) ? await db.prepare('SELECT user_id FROM auth_sessions WHERE token_hash=? AND expires_at>?').bind(await digest(token), Math.floor(Date.now() / 1000)).first() : null;
    if (url.pathname === '/auth') return new Response(accountPage(env.TURNSTILE_SITE_KEY, Boolean(session)), { headers: {
      'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; style-src 'unsafe-inline'; connect-src 'self' https://challenges.cloudflare.com; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    } });
    if (!session) return url.pathname.startsWith('/api/') ? reply({ error: 'Влез в профила си, за да използваш справките.' }, 401)
      : new Response(null, { status: 303, headers: { Location: '/auth', 'Cache-Control': 'no-store' } });
    return null;
  } catch {
    return reply({ error: 'Услугата за вход временно не е достъпна. Опитай по-късно.' }, 503);
  }
}
