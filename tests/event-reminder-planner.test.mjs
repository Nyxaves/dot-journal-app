import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = fs.readFileSync('src/services/eventReminderPlanner.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleExports = {};
vm.runInNewContext(compiled, { exports: moduleExports, Date, Math });
const { buildUpcomingEventReminderPlan } = moduleExports;

const event = (overrides = {}) => ({
  id: 'event-1',
  title: 'Compromisso',
  date: '2026-11-10',
  time: '10:00',
  type: 'appointment',
  recurrence: 'none',
  reminderMinutes: 15,
  ...overrides,
});

test('lembrete personalizado atravessa a meia-noite corretamente', () => {
  const now = new Date(2026, 10, 8, 8, 0);
  const [item] = buildUpcomingEventReminderPlan([
    event({ time: '00:30', reminderMinutes: 60 }),
  ], now, 10, 10);

  assert.equal(item.occurrenceDate, '2026-11-10');
  assert.equal(item.triggerAt.getFullYear(), 2026);
  assert.equal(item.triggerAt.getMonth(), 10);
  assert.equal(item.triggerAt.getDate(), 9);
  assert.equal(item.triggerAt.getHours(), 23);
  assert.equal(item.triggerAt.getMinutes(), 30);
});

test('evento diário cria ocorrências futuras com antecedência', () => {
  const now = new Date(2026, 10, 8, 8, 0);
  const plan = buildUpcomingEventReminderPlan([
    event({ date: '2026-11-07', time: '20:00', recurrence: 'daily', reminderMinutes: 15 }),
  ], now, 2, 10);

  assert.equal(plan.length, 3);
  assert.equal(plan[0].occurrenceDate, '2026-11-08');
  assert.equal(plan[0].triggerAt.getHours(), 19);
  assert.equal(plan[0].triggerAt.getMinutes(), 45);
});

test('aniversário anual agenda a antecedência antes da próxima ocorrência', () => {
  const now = new Date(2026, 10, 8, 8, 0);
  const plan = buildUpcomingEventReminderPlan([
    event({
      id: 'birthday-1',
      title: 'Aniversário',
      type: 'birthday',
      date: '2025-11-10',
      time: '09:00',
      recurrence: 'yearly',
      reminderMinutes: 1440,
    }),
  ], now, 400, 10);

  assert.equal(plan[0].occurrenceDate, '2026-11-10');
  assert.equal(plan[0].triggerAt.getDate(), 9);
  assert.equal(plan[0].triggerAt.getHours(), 9);
});

test('fila respeita o limite máximo e ordena por horário de disparo', () => {
  const now = new Date(2026, 10, 8, 8, 0);
  const plan = buildUpcomingEventReminderPlan([
    event({ id: 'later', date: '2026-11-12', time: '10:00' }),
    event({ id: 'sooner', date: '2026-11-09', time: '10:00' }),
  ], now, 10, 1);

  assert.equal(plan.length, 1);
  assert.equal(plan[0].eventId, 'sooner');
});
