const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
function load(file, overrides = {}, globals = {}) {
  const source = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const mod = { exports: {} };
  const localRequire = name => name in overrides ? overrides[name] : name.startsWith('.') ? load(path.relative(root, path.resolve(root, path.dirname(file), name + (name.includes('components') ? '.tsx' : '.ts'))), overrides, globals) : require(name);
  new Function('require', 'module', 'exports', ...Object.keys(globals), source)(localRequire, mod, mod.exports, ...Object.values(globals));
  return mod.exports;
}
const { magistratPath } = load('lib/magistrat-request.ts');
test('documented routes, encoded query, paging and registry filters', () => {
  assert.equal(magistratPath({ uic: 'BG123456789' }), '/api/tr/companies/123456789');
  for (const action of ['history', 'acts']) assert.equal(magistratPath({ action, uic: '123456789' }), `/api/tr/companies/123456789/${action}`);
  assert.equal(magistratPath({ action: 'cases', uic: '123456789', page: 2 }), '/api/court/companies/123456789/cases?page=2');
  const url = new URL(magistratPath({ action: 'search', slug: 'tr', query: 'Име & друго', page: 3, pageSize: 100, from: '2026-10-01', filters: { legalForm: 'ООД' } }), 'https://magistrat.bg');
  assert.equal(url.searchParams.get('q'), 'Име & друго');
  assert.equal(url.searchParams.get('legalForm'), 'ООД');
  assert.equal(url.searchParams.get('page'), '3');
  assert.equal(magistratPath({ action: 'act', uic: '123456789', id: 'a b' }), '/api/tr/companies/123456789/acts/a%20b');
  assert.equal(magistratPath({ action: 'document', slug: 'kzk', id: '42' }), '/api/kzk/documents/42');
  assert.equal(magistratPath({ action: 'courtAct', caseId: 'c1', id: 'a1' }), '/api/court/cases/c1/acts/a1');
});
test('invalid paths, reserved filters, dates and paging are rejected', () => {
  for (const input of [{ action: 'delete' }, { uic: '123' }, { action: 'document', slug: 'tr', id: '..' }, { action: 'search', slug: '../tr' }, { action: 'search', slug: 'tr', pageSize: 101 }, { action: 'search', slug: 'tr', page: 0 }, { action: 'search', slug: 'tr', from: '2026-02-30' }, { action: 'search', slug: 'tr', from: '2026-10-02', to: '2026-10-01' }, { action: 'search', slug: 'tr', filters: { q: 'override' } }, { action: 'cases', uic: '123456789', page: 501 }]) assert.throws(() => magistratPath(input));
});
function route(fetch, key = 'test-secret') {
  return load('app/api/magistrat/route.ts', { 'cloudflare:workers': { env: { MAGISTRAT_API_KEY: key } }, '../../../lib/magistrat-request': { magistratPath } }, { fetch });
}
const request = body => new Request('https://local/api/magistrat', { method: 'POST', body: JSON.stringify(body) });
test('company response preserves extra fields and keeps key on server', async () => {
  const company = { uic: '123456789', capital: '500', capitalPaidIn: '250', subjectOfActivity: 'Търговия', custom: { nested: true } };
  const handler = route(async (url, options) => { assert.equal(url, 'https://magistrat.bg/api/tr/companies/123456789'); assert.equal(options.headers['X-Api-Key'], 'test-secret'); assert.equal(options.redirect, 'manual'); return Response.json(company); });
  const response = await handler.POST(request({ uic: company.uic }));
  assert.deepEqual(await response.json(), { company });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
test('validation and missing keys make no upstream requests', async () => {
  const noFetch = () => { throw Error('Unexpected fetch'); };
  assert.equal((await route(noFetch).POST(request({ action: 'search', slug: '../tr' }))).status, 400);
  assert.equal((await route(noFetch, '').POST(request({ action: 'registries' }))).status, 400);
});
test('rate limits, mismatched UIC, upstream JSON faults and redirects', async () => {
  const limited = await route(async () => Response.json({ code: 'rate_limited', detail: 'test-secret' }, { status: 429, headers: { 'Retry-After': '60' } })).POST(request({ action: 'registries' }));
  assert.equal(limited.status, 429); assert.equal(limited.headers.get('Retry-After'), '60'); assert.equal((await limited.text()).includes('test-secret'), false);
  assert.equal((await route(async () => Response.json({ uic: '987654321' })).POST(request({ uic: '123456789' }))).status, 502);
  assert.equal((await route(async () => new Response('invalid')).POST(request({ action: 'registries' }))).status, 502);
  assert.equal((await route(async () => new Response(null, { status: 302 })).POST(request({ action: 'registries' }))).status, 502);
});
test('structured data shows nulls, escapes source text, and rejects script links', () => {
  const { DataValue } = load('components/magistrat-data.tsx');
  const html = renderToStaticMarkup(React.createElement(DataValue, { value: { capital: null, partners: [{ name: '<script>alert(1)</script>' }], url: 'javascript:alert(1)' } }));
  assert.match(html, /Няма публикувани данни/); assert.match(html, /Съдружници/); assert.ok(html.includes('&lt;script&gt;')); assert.ok(!html.includes('<script>')); assert.ok(!html.includes('href="javascript:'));
});
