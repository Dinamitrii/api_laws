import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const settingsPath = root + 'predictorian-auth.json';
const [databaseId, siteKey] = process.argv.slice(2);
if (databaseId || siteKey) {
  if (!/^[a-f0-9-]{36}$/i.test(databaseId ?? '') || !/^[a-z0-9_-]{10,100}$/i.test(siteKey ?? '')) throw Error('Usage: node scripts/prepare-account-deploy.mjs D1_DATABASE_ID TURNSTILE_SITE_KEY');
  fs.writeFileSync(settingsPath, JSON.stringify({ databaseId, siteKey }, null, 2) + '\n');
}
if (!fs.existsSync(settingsPath)) throw Error('Първо настрой D1 и Turnstile: node scripts/prepare-account-deploy.mjs D1_DATABASE_ID TURNSTILE_SITE_KEY');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
const configPath = root + 'dist/server/wrangler.json';
if (!fs.existsSync(configPath)) {
  console.log('Настройките са запазени. Сега изпълни npm run build.');
  process.exit(0);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
config.name = 'firmi';
delete config.legacy_env;
config.assets = { ...config.assets, run_worker_first: true };
// The custom domain comes from siteUrl in seo-public-pages.json, so the sitemap,
// robots.txt and the Worker route can never point at different domains.
const seoConfig = JSON.parse(fs.readFileSync(root + 'seo-public-pages.json', 'utf8'));
const domain = new URL(seoConfig.siteUrl).hostname;
config.routes = [
  // Drop any earlier custom domain (e.g. from a stale dist/) so only siteUrl's domain remains.
  ...(config.routes ?? []).filter((route) => route?.custom_domain !== true),
  { pattern: domain, custom_domain: true },
];
config.vars = { ...config.vars, TURNSTILE_SITE_KEY: settings.siteKey };
config.d1_databases = (config.d1_databases ?? []).filter(item => item.binding !== 'AUTH_DB');
config.d1_databases.push({ binding: 'AUTH_DB', database_name: 'predictorian-users', database_id: settings.databaseId, migrations_dir: '../../migrations' });
// Keep the cache binding name expected by Vinext, with the user's existing KV.
for (const binding of config.kv_namespaces ?? []) {
  if (binding.binding === 'VINEXT_KV_CACHE' || binding.id === '<your-kv-namespace-id>') binding.id = '2ef4c2601101466e9734713e309aaf6b';
  // `remote: true` forces `dev` to open a remote Cloudflare session and demand `wrangler login`.
  delete binding.remote;
}
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

// The public landing page is static HTML with no interactive client components.
// Keep the /app route hydrated, but omit Vinext's client runtime from `/`.
// Keep the explicitly tagged Google Analytics scripts and any JSON-LD
// structured data (type="application/ld+json"): they are data for crawlers,
// not client runtime, and removing them breaks SEO.
const landingPath = root + 'dist/server/prerendered-routes/index.html';
const keepScript = (attrs) =>
  /\bdata-firmi-google-tag\b/i.test(attrs) || /\btype\s*=\s*["']?application\/ld\+json/i.test(attrs);
if (fs.existsSync(landingPath)) {
  const html = fs.readFileSync(landingPath, 'utf8');
  const staticHtml = html
    .replace(/<script\b([^>]*)>[\s\S]*?<\/script\s*>/gi, (match, attrs) => (keepScript(attrs) ? match : ''))
    .replace(/<link\b(?=[^>]*\b(?:rel=["']modulepreload["']|as=["']script["']))[^>]*>/gi, '');
  if (staticHtml !== html) fs.writeFileSync(landingPath, staticHtml);
} else {
  console.warn('Внимание: не е намерен ' + landingPath + ' — началната страница не е обработена.');
}
console.log('Firmi: D1, Turnstile, KV и защитата на страниците са настроени за деплой.');
