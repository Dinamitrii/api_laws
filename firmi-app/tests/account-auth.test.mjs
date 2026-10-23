import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
const bundle = await build({ entryPoints: ['lib/account-auth.ts'], bundle: true, format: 'esm', platform: 'neutral', write: false });
const { accountGate, passwordHash, passwordMatches } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(fs.readFileSync('migrations/0001_accounts.sql', 'utf8'));
  const db = {
    withSession() { return db; },
    prepare(sql) {
      let values = [];
      const query = {
        bind(...args) { values = args; return query; },
        async first() { return sqlite.prepare(sql).get(...values) ?? null; },
        async run() { return { meta: { changes: sqlite.prepare(sql).run(...values).changes } }; },
      };
      return query;
    },
    async batch(statements) { const results = []; for (const statement of statements) results.push(await statement.run()); return results; },
  };
  return { db, sqlite };
}
test('passwords are salted, peppered and verified', async () => {
  const hash = await passwordHash('correct-password-123', 'server-secret');
  assert.equal(await passwordMatches('correct-password-123', 'server-secret', hash), true);
  assert.equal(await passwordMatches('incorrect-password', 'server-secret', hash), false);
  assert.equal(await passwordMatches('correct-password-123', 'other-secret', hash), false);
  assert.notEqual(hash, await passwordHash('correct-password-123', 'server-secret'));
});
test('registration, bot checks, session protection, logout and rate limits', async () => {
  const { db, sqlite } = database();
  const env = { AUTH_DB: db, AUTH_PEPPER: 'test-pepper-only', TURNSTILE_SITE_KEY: 'test-site-key', TURNSTILE_SECRET_KEY: 'test-secret' };
  const pending = [];
  const ctx = { waitUntil(p) { pending.push(p); } };
  const originalFetch = globalThis.fetch;
  let verification = { success: true, hostname: 'predictorian.test', action: 'register' };
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json(verification); };
  const req = (path, body, headers = {}) => new Request('https://predictorian.test' + path, body === undefined ? { headers } : { method: 'POST', headers: { Origin: 'https://predictorian.test', 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const form = { email: 'USER@example.com', password: 'long-password-12345', turnstile: 'valid-token' };
  try {
    assert.equal(await accountGate(req('/'), env, ctx), null);
    assert.equal((await accountGate(req('/api/companybook'), env, ctx)).status, 401);
    assert.equal(await accountGate(req('/_next/static/app.js'), {}, ctx), null);
    assert.equal((await accountGate(req('/api/auth/register', form, { Origin: 'https://evil.test' }), env, ctx)).status, 403);
    assert.equal((await accountGate(req('/api/auth/register', { ...form, turnstile: '' }), env, ctx)).status, 400);
    assert.equal(calls, 0);
    verification = { ...verification, success: false };
    assert.equal((await accountGate(req('/api/auth/register', form), env, ctx)).status, 400);
    assert.equal(sqlite.prepare('SELECT count(*) AS n FROM auth_users').get().n, 0);
    verification = { success: true, hostname: 'evil.test', action: 'register' };
    assert.equal((await accountGate(req('/api/auth/register', form), env, ctx)).status, 400);
    verification.hostname = 'predictorian.test';
    const registered = await accountGate(req('/api/auth/register', form), env, ctx);
    assert.equal(registered.status, 200);
    const cookie = registered.headers.get('Set-Cookie');
    assert.match(cookie, /HttpOnly; Secure; SameSite=Lax/);
    const headers = { Cookie: cookie.split(';')[0] };
    assert.equal(await accountGate(req('/api/companybook', undefined, headers), env, ctx), null);
    const stored = sqlite.prepare('SELECT * FROM auth_users').get();
    assert.equal(stored.email, 'user@example.com');
    assert.notEqual(stored.password_hash, form.password);
    const rawToken = headers.Cookie.split('=')[1];
    assert.notEqual(sqlite.prepare('SELECT token_hash FROM auth_sessions').get().token_hash, rawToken);
    assert.equal((await accountGate(req('/api/auth/logout', {}, headers), env, ctx)).status, 200);
    assert.equal((await accountGate(req('/api/companybook', undefined, headers), env, ctx)).status, 401);
    verification.action = 'login';
    assert.equal((await accountGate(req('/api/auth/login', { ...form, password: 'wrong-password-123' }), env, ctx)).status, 401);
    const loggedIn = await accountGate(req('/api/auth/login', form), env, ctx);
    assert.equal(loggedIn.status, 200);
    const loginCookie = { Cookie: loggedIn.headers.get('Set-Cookie').split(';')[0] };
    sqlite.exec('UPDATE auth_sessions SET expires_at=0');
    assert.equal((await accountGate(req('/api/companybook', undefined, loginCookie), env, ctx)).status, 401);
    for (let i = 0; i < 12; i++) await accountGate(req('/api/auth/login', form), env, ctx);
    assert.equal((await accountGate(req('/api/auth/login', form), env, ctx)).status, 429);
    assert.equal((await accountGate(req('/api/auth/register', form), {}, ctx)).status, 503);
    await Promise.all(pending);
  } finally { globalThis.fetch = originalFetch; sqlite.close(); }
});
