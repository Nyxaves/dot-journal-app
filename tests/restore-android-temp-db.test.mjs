import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const restore = readFileSync('src/database/restoreRepository.ts', 'utf8');

test('inspeção SQLite usa arquivo temporário isolado do banco real', () => {
  assert.ok(restore.includes('new File(Paths.cache, name)'));
  assert.ok(restore.includes('openDatabaseAsync(name, { useNewConnection: true }, directory)'));
  assert.ok(!restore.includes('deserializeDatabaseAsync'));
});

test('aplicação e rollback preservam a cópia anterior', () => {
  assert.ok(restore.includes('await recoveryFile.write(safety)'));
  assert.ok(restore.includes('withTemporaryDatabase(prepared.bytes'));
  assert.ok(restore.includes('withTemporaryDatabase(safety'));
  assert.ok(restore.includes('backupDatabaseAsync'));
});

test('arquivos temporários são removidos após fechar SQLite', () => {
  assert.ok(restore.includes('temporaryDb.closeAsync()'));
  assert.ok(restore.includes("['', '-wal', '-shm', '-journal']"));
});
