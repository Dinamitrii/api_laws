const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../lib/template.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', source)(mod, mod.exports);
const { fillTemplate, unknownTokens } = mod.exports;
const fields = { name: 'Фирма ООД', uic: '', date: '1.1.2026' };
const labels = { name: 'Наименование', uic: 'ЕИК', date: 'Дата' };

test('fills known fields and marks empty ones as missing', () => {
  assert.equal(fillTemplate('{{name}} / {{ uic }}', fields, labels), 'Фирма ООД / [липсва: ЕИК]');
});
test('unknown placeholders stay untouched and are reported', () => {
  assert.equal(fillTemplate('{{nope}}', fields, labels), '{{nope}}');
  assert.deepEqual(unknownTokens('{{name}} {{nope}}', fields), ['nope']);
});
test('prototype keys are treated as unknown, not as fields', () => {
  for (const key of ['constructor', 'toString', 'hasOwnProperty', '__proto__']) {
    assert.equal(fillTemplate(`{{${key}}}`, fields, labels), `{{${key}}}`);
    assert.deepEqual(unknownTokens(`{{${key}}}`, fields), [key]);
  }
});
