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
