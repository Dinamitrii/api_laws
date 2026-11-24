import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = async p => { const b = await build({ entryPoints: [p], bundle: true, write: false, format: 'esm' }); return import('data:text/javascript;base64,' + Buffer.from(b.outputFiles[0].text).toString('base64')); };
const { searchCompanies, getCompany } = await bundle('lib/eik.ts');

const profileHtml = `<html><body>
<h1>ТЕХНОСТРОЙ ООД</h1>
<div class="key-value-row"><dt>Статус</dt><dd class="">Активна</dd></div>
<div class="key-value-row"><dt>Правна форма</dt><dd class="">ООД</dd></div>
<div class="key-value-row"><dt>Седалище и адрес на управление</dt><dd class="">гр. София, ул. Пример 1</dd></div>
<div class="key-value-row"><dt>Управител / МОЛ</dt><dd class="">Иван Иванов</dd></div>
<div class="key-value-row"><dt>Капитал</dt><dd class="">5 000 лв.</dd></div>
</body></html>`;

test('searchCompanies maps suggestions JSON', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ suggestions: [{ type: 'company', name: 'ТЕХНОСТРОЙ ООД', eik: '200523141', legal_form: 'ООД', settlement: 'гр. София', status: 'active', url: 'https://eik.bg/eik/200523141' }] });
  try {
    const rows = await searchCompanies('Технострой');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].eik, '200523141');
    assert.equal(rows[0].legalForm, 'ООД');
    assert.equal(rows[0].settlement, 'гр. София');
  } finally { globalThis.fetch = original; }
});

test('getCompany parses name and key-value rows from HTML', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(profileHtml, { headers: { 'Content-Type': 'text/html' } });
  try {
    const company = await getCompany('200523141');
    assert.equal(company.name, 'ТЕХНОСТРОЙ ООД');
    assert.equal(company.status, 'Активна');
    assert.equal(company.legalForm, 'ООД');
    assert.equal(company.address, 'гр. София, ул. Пример 1');
    assert.equal(company.managers, 'Иван Иванов');
    assert.equal(company.capital, '5 000 лв.');
    assert.equal(company.url, 'https://eik.bg/eik/200523141');
  } finally { globalThis.fetch = original; }
});

test('getCompany reports missing company on 404', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('not found', { status: 404 });
  try {
    await assert.rejects(() => getCompany('000000000'), /не е намерена/);
  } finally { globalThis.fetch = original; }
});