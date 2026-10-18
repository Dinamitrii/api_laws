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
config.name = 'predictorian';
delete config.legacy_env;
config.assets = { ...config.assets, run_worker_first: true };
config.vars = { ...config.vars, TURNSTILE_SITE_KEY: settings.siteKey };
config.d1_databases = (config.d1_databases ?? []).filter(item => item.binding !== 'AUTH_DB');
config.d1_databases.push({ binding: 'AUTH_DB', database_name: 'predictorian-users', database_id: settings.databaseId, migrations_dir: '../../migrations' });
// Keep the cache binding name expected by Vinext, with the user's existing KV.
for (const binding of config.kv_namespaces ?? []) {
  if (binding.binding === 'VINEXT_KV_CACHE' || binding.id === '<your-kv-namespace-id>') binding.id = '2ef4c2601101466e9734713e309aaf6b';
}
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log('Predictorian: D1, Turnstile, KV и защитата на страниците са настроени за деплой.');
