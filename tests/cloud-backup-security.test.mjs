import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const service = readFileSync('src/services/cloudBackupService.ts', 'utf8');
const client = readFileSync('src/services/supabaseClient.ts', 'utf8');
const sql = readFileSync('supabase/setup.sql', 'utf8');
const screen = readFileSync('src/app/cloud-backup.tsx', 'utf8');

test('backup usa AES-GCM e não envia a chave ao serviço', () => {
  assert.ok(service.includes('aesEncryptAsync'));
  assert.ok(service.includes('AESEncryptionKey.generate(256)'));
  assert.ok(service.includes('SecureStore.setItemAsync(ENCRYPTION_KEY_STORAGE'));
  assert.ok(!service.includes('service_role'));
});

test('snapshot verifica integridade SQLite antes do upload', () => {
  assert.ok(service.includes('PRAGMA integrity_check'));
  assert.ok(service.includes('serializeAsync'));
  assert.ok(service.includes("upsert: false"));
});

test('bucket é privado e limitado ao usuário autenticado', () => {
  assert.ok(sql.includes("'dot-journal-private-backups'"));
  assert.ok(sql.includes('public,'));
  assert.ok(sql.includes('false,'));
  assert.ok(sql.includes('(select auth.uid()::text)'));
  assert.ok(sql.includes('for select'));
  assert.ok(sql.includes('for insert'));
  assert.ok(sql.includes('for delete'));
});

test('cliente não contém chave administrativa', () => {
  assert.ok(client.includes('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'));
  assert.ok(!client.includes('SUPABASE_SERVICE_ROLE'));
  assert.ok(!client.includes('service_role'));
});

test('central de backup e instruções existem', () => {
  assert.ok(existsSync('src/app/cloud-backup.tsx'));
  assert.ok(existsSync('docs/FASE-16-BACKUP-PRIVADO.md'));
  assert.ok(existsSync('.env.example'));
  assert.ok(screen.includes('Chave de recuperação'));
  assert.ok(screen.includes('Enviar backup agora'));
});


test('restauração da nuvem baixa e descriptografa antes de validar o SQLite', () => {
  assert.ok(service.includes('createSignedUrl(objectPath, 60)'));
  assert.ok(service.includes('expoFetch(signedData.signedUrl)'));
  assert.ok(service.includes('response.arrayBuffer()'));
  assert.ok(service.includes('AESSealedData.fromCombined'));
  assert.ok(service.includes('aesDecryptAsync'));
  assert.ok(service.includes('prepareRestoreBytes(backupName, sqliteBytes, CLOUD_REQUIRED_TABLES)'));
});

test('restauração exige tabelas de todas as áreas do diário', () => {
  for (const table of [
    'daily_entries', 'daily_checks', 'habits', 'journal_events',
    'annual_goals', 'personal_day_tracking', 'wellness_entries',
    'routine_blocks', 'routine_categories', 'routine_settings',
    'weekly_goals', 'micro_goals',
  ]) {
    assert.ok(service.includes(`'${table}'`), `tabela obrigatória ausente: ${table}`);
  }
});

test('restauração cria cópia de segurança e aplica rollback', () => {
  const restore = readFileSync('src/database/restoreRepository.ts', 'utf8');
  assert.ok(restore.includes('serializeAsync()'));
  assert.ok(restore.includes('recoveryFile.write(safety)'));
  assert.ok(restore.includes('SQLite.backupDatabaseAsync'));
  assert.ok(restore.includes('rollbackError'));
  assert.ok(service.includes('applyRestore(prepared)'));
});

test('novo aparelho não envia banco vazio automaticamente antes de restaurar', () => {
  assert.ok(service.includes("if (!lastBackupAt) return 'not-due';"));
  assert.ok(service.includes("SecureStore.setItemAsync(LAST_BACKUP_STORAGE, new Date().toISOString())"));
});

test('tela oferece preview e confirmação explícita antes de substituir dados', () => {
  assert.ok(screen.includes('Baixar e verificar para restaurar'));
  assert.ok(screen.includes('Digite RESTAURAR para confirmar'));
  assert.ok(screen.includes("restorePhrase !== 'RESTAURAR'"));
  assert.ok(screen.includes('Cancelar restauração'));
});
