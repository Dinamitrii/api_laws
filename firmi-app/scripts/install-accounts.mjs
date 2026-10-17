import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const workerPath = root + 'build/sites-worker.ts';
let worker = fs.readFileSync(workerPath, 'utf8');
if (!worker.includes('accountGate')) {
  const signature = 'fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {';
  const returnLine = 'return runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));';
  if (!worker.includes(signature) || !worker.includes(returnLine)) throw Error('Worker файлът е различен. Не е променен; необходима е ръчна интеграция на accountGate.');
  worker = 'import { accountGate } from "../lib/account-auth";\n' + worker;
  worker = worker.replace(signature, 'async ' + signature + '\n    const denied = await accountGate(request, env, ctx);\n    if (denied) return denied;');
  worker = worker.replace(returnLine, `const response = await runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
    const headers = new Headers(response.headers);
    if (!new URL(request.url).pathname.startsWith('/_next/static/')) {
      headers.set('Cache-Control', 'private, no-store');
      headers.set('CDN-Cache-Control', 'no-store');
    }
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });`);
  fs.writeFileSync(workerPath, worker);
}
const typesPath = root + 'cloudflare-env.d.ts';
let types = fs.readFileSync(typesPath, 'utf8');
if (!types.includes('AUTH_DB')) {
  types += '\ndeclare namespace Cloudflare { interface Env { AUTH_DB?: D1Database; TURNSTILE_SITE_KEY?: string; TURNSTILE_SECRET_KEY?: string; AUTH_PEPPER?: string; } }\n';
  fs.writeFileSync(typesPath, types);
}
const layoutPath = root + 'app/layout.tsx';
let layout = fs.readFileSync(layoutPath, 'utf8');
if (!layout.includes('href="/auth"')) {
  if (!layout.includes('</body>')) throw Error('Не е намерен </body> в app/layout.tsx.');
  layout = layout.replace('</body>', '<a href="/auth" style={{ position: "fixed", right: 18, bottom: 18, zIndex: 50, background: "#176b51", color: "white", padding: "10px 16px", borderRadius: 10 }}>Профил / Изход</a></body>');
  fs.writeFileSync(layoutPath, layout);
}
const packagePath = root + 'package.json';
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.scripts ??= {};
if (!pkg.scripts.postbuild?.includes('prepare-account-deploy.mjs')) pkg.scripts.postbuild = [pkg.scripts.postbuild, 'node scripts/prepare-account-deploy.mjs'].filter(Boolean).join(' && ');
pkg.scripts['deploy:predictorian'] = 'npm run build && wrangler deploy --config dist/server/wrangler.json --name predictorian';
fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
console.log('Регистрацията е добавена. Следвай REGISTRATION-SETUP.md за D1 и Turnstile.');
