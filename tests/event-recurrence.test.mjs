import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');

// Testa a lógica real de datas sem abrir o módulo SQLite nativo no Node.
const source = fs.readFileSync('src/database/eventRepository.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleExports = {};
vm.runInNewContext(compiled, { exports: moduleExports, require: () => ({}), Date, Error });
const { eventOccursOn } = moduleExports;

const recurring = (date, recurrence) => ({ date, recurrence });
test('semanal: mesma data da semana, sem ocorrências anteriores', () => {
  const evt = recurring('2026-11-06', 'weekly');
  assert.equal(eventOccursOn(evt, '2026-11-06'), true);
  assert.equal(eventOccursOn(evt, '2026-11-13'), true);
  assert.equal(eventOccursOn(evt, '2026-11-12'), false);
  assert.equal(eventOccursOn(evt, '2026-10-30'), false);
});
test('mensal: não inventa dia 31 em meses curtos', () => {
  const evt = recurring('2026-01-31', 'monthly');
  assert.equal(eventOccursOn(evt, '2026-02-28'), false);
  assert.equal(eventOccursOn(evt, '2026-03-31'), true);
});
test('anual: 29 de fevereiro somente em ano bissexto', () => {
  const evt = recurring('2024-02-29', 'yearly');
  assert.equal(eventOccursOn(evt, '2025-02-28'), false);
  assert.equal(eventOccursOn(evt, '2028-02-29'), true);
});
test('sem repetição: somente na data original', () => {
  const evt = recurring('2026-11-06', 'none');
  assert.equal(eventOccursOn(evt, '2026-11-06'), true);
  assert.equal(eventOccursOn(evt, '2027-11-06'), false);
});
