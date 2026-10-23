import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const configPath = path.join(root, 'seo-public-pages.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

function fail(message) {
  throw new Error(`[firmi-seo] ${message}`);
}

function normalizeSiteUrl(value) {
  if (typeof value !== 'string' || !value.trim()) fail('siteUrl is required.');
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`Invalid siteUrl: ${value}`);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    fail('siteUrl must be an HTTPS origin without credentials, path, query, or fragment.');
  }
  return url.origin;
}

function validatePath(value, label) {
  if (typeof value !== 'string' || !/^\/(?:[\p{L}\p{N}_~-]+(?:\/[\p{L}\p{N}_~-]+)*)?$/u.test(value)) {
    fail(`${label} must be a normalized absolute path without a trailing slash (except /): ${String(value)}`);
  }
  return value;
}

const changefreqValues = new Set(['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']);

function validateChangefreq(value, label) {
  if (typeof value !== 'string' || !changefreqValues.has(value)) {
    fail(`${label} must be one of: ${[...changefreqValues].join(', ')}.`);
  }
  return value;
}

function validatePriority(value, label) {
  const priority = Number(value);
  if (!Number.isFinite(priority) || priority < 0 || priority > 1) {
    fail(`${label} must be a number between 0.0 and 1.0.`);
  }
  return priority.toFixed(1);
}

function isBlockedPublicPath(route, blockedPaths) {
  return blockedPaths.some((blocked) => {
    const prefix = blocked.endsWith('/') ? blocked.slice(0, -1) : blocked;
    return route === prefix || route.startsWith(blocked.endsWith('/') ? blocked : `${blocked}/`);
  });
}

function pageExists(appDir, route) {
  const segments = route === '/' ? [] : route.slice(1).split('/');
  const pageFile = path.join(appDir, 'page.tsx');
  const visited = new Set();

  function visit(directory, index) {
    const key = `${directory}\0${index}`;
    if (visited.has(key)) return false;
    visited.add(key);

    if (index === segments.length && fs.existsSync(path.join(directory, 'page.tsx'))) return true;
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return false;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name.startsWith('@')) continue;
      const child = path.join(directory, entry.name);
      if (/^\([^/]+\)$/.test(entry.name) && visit(child, index)) return true;
      if (index < segments.length && (entry.name === segments[index] || /^\[\.{0,3}[^\]]+\]$/.test(entry.name) || /^\[\[\.{3}[^\]]+\]\]$/.test(entry.name))) {
        if (visit(child, index + 1)) return true;
      }
    }
    return false;
  }

  return fs.existsSync(pageFile) || visit(appDir, 0);
}

function xmlEscape(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

if (!Array.isArray(config.paths) || !config.paths.includes('/')) fail('paths must be an array including /.');
if (!Array.isArray(config.disallowPaths) || config.disallowPaths.length === 0) fail('disallowPaths must be a non-empty array.');
const siteUrl = normalizeSiteUrl(config.siteUrl);
const appDir = ['app', 'src/app'].map((candidate) => path.join(root, candidate)).find((candidate) => fs.existsSync(candidate));
if (!appDir) fail('Could not find app/ or src/app/.');

const blockedPaths = config.disallowPaths.map((route) => validatePath(route, 'disallowPaths entry'));
const routes = config.paths.map((route) => validatePath(route, 'paths entry'));
if (new Set(routes).size !== routes.length) fail('paths contains duplicates.');
const pathMetadata = config.pathMetadata ?? {};
if (!pathMetadata || typeof pathMetadata !== 'object' || Array.isArray(pathMetadata)) {
  fail('pathMetadata must be an object keyed by public path.');
}
for (const route of Object.keys(pathMetadata)) {
  validatePath(route, 'pathMetadata key');
  if (!routes.includes(route)) fail(`pathMetadata contains a route not listed in paths: ${route}`);
}
for (const route of routes) {
  if (isBlockedPublicPath(route, blockedPaths)) fail(`Private or blocked route cannot be in the sitemap: ${route}`);
  if (!pageExists(appDir, route)) fail(`No App Router page found for public route ${route}.`);
}

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...routes.slice().sort().map((route) => {
    const metadata = pathMetadata[route] ?? {};
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      fail(`pathMetadata entry must be an object: ${route}`);
    }
    const changefreq = validateChangefreq(metadata.changefreq ?? 'weekly', `pathMetadata.${route}.changefreq`);
    const priority = validatePriority(metadata.priority ?? 0.5, `pathMetadata.${route}.priority`);
    return `  <url><loc>${xmlEscape(`${siteUrl}${route === '/' ? '/' : route}`)}</loc><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
  }),
  '</urlset>',
  '',
].join('\n');
const robots = [
  'User-agent: *',
  'Allow: /',
  ...blockedPaths.slice().sort().map((route) => `Disallow: ${route}`),
  '',
  `Sitemap: ${siteUrl}/sitemap.xml`,
  '',
].join('\n');

const manifest = [
  '// Generated by scripts/generate-firmi-sitemap.mjs. Do not edit by hand.',
  `export const SITE_URL = ${JSON.stringify(siteUrl)};`,
  `export const PUBLIC_PATHS: readonly string[] = ${JSON.stringify(routes.slice().sort())};`,
  `export const SITEMAP_XML = ${JSON.stringify(sitemap)};`,
  `export const ROBOTS_TXT = ${JSON.stringify(robots)};`,
  '',
].join('\n');
const outputPath = path.join(root, 'lib/firmi-seo-manifest.ts');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
const temporaryPath = `${outputPath}.tmp`;
fs.writeFileSync(temporaryPath, manifest, 'utf8');
fs.renameSync(temporaryPath, outputPath);
console.log(`SEO manifest: ${routes.length} public page(s), ${siteUrl}/sitemap.xml`);
