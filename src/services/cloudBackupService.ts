import * as SQLite from 'expo-sqlite';
import { File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import {
  AESEncryptionKey,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
} from 'expo-crypto';

import { getSupabaseClient } from './supabaseClient';
import {
  applyRestore,
  prepareRestoreBytes,
  type PreparedRestore,
} from '../database/restoreRepository';
import { getDailyData } from '../database/dailyRepository';
import { listHabits } from '../database/habitRepository';
import { listMicroGoals } from '../database/microGoalRepository';
import { listStoredEvents } from '../database/eventRepository';
import { listAnnualGoals } from '../database/annualRepository';
import { getMonthlyTracker } from '../database/monthlyRepository';
import { getPersonalDay } from '../database/personalTrackingRepository';
import { getWellnessEntry } from '../database/wellnessRepository';
import { listRoutineBlocks, listRoutineCategories } from '../database/routineRepository';
import { listWeeklyGoals } from '../database/weeklyRepository';

const DATABASE_NAME = 'dot-journal.db';
export const CLOUD_BACKUP_BUCKET = 'dot-journal-private-backups';
const ENCRYPTION_KEY_STORAGE = 'dot-journal-cloud-backup-key-v1';
const KEY_CONFIRMED_STORAGE = 'dot-journal-cloud-backup-key-confirmed-v1';
const LAST_BACKUP_STORAGE = 'dot-journal-cloud-backup-last-success-v1';
const MAX_BACKUP_BYTES = 25 * 1024 * 1024;
const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

// "DJBK" + format version 1. AES-GCM payload follows this header.
const ENCRYPTED_BACKUP_HEADER = new Uint8Array([68, 74, 66, 75, 1, 0, 0, 0]);
const CLOUD_REQUIRED_TABLES = [
  'daily_entries',
  'daily_checks',
  'habits',
  'journal_events',
  'annual_goals',
  'personal_day_tracking',
  'wellness_entries',
  'routine_blocks',
  'routine_categories',
  'routine_settings',
  'weekly_goals',
  'micro_goals',
] as const;

const SQLITE_HEADER = new Uint8Array([
  83, 81, 76, 105, 116, 101, 32, 102, 111, 114, 109, 97, 116, 32, 51, 0,
]);

export type CloudBackupItem = {
  name: string;
  createdAt: string | null;
  bytes: number | null;
};

export type CloudBackupStatus = {
  keyExists: boolean;
  keyConfirmed: boolean;
  lastBackupAt: string | null;
};

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function weekStartKey(date: Date): string {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return dateKey(monday);
}

/**
 * Initializes the existing repositories before taking the snapshot.
 * This prevents the first cloud backup from omitting tables whose lazy
 * migrations have not yet run in this installation.
 */
async function prepareJournalDatabase(): Promise<void> {
  const now = new Date();
  const today = dateKey(now);

  await getDailyData(today);
  await listHabits(true);
  await listMicroGoals(today);
  await listStoredEvents();
  await listAnnualGoals(now.getFullYear());
  await getMonthlyTracker(now.getFullYear(), now.getMonth() + 1);
  await getPersonalDay(today);
  await getWellnessEntry(today);
  await listRoutineBlocks();
  await listRoutineCategories();
  await listWeeklyGoals(weekStartKey(now));
}

function getClientAndUser() {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Configure o Supabase em .env.local e reinicie o Expo.');
  }
  return client;
}

async function requireSignedInUser() {
  const client = getClientAndUser();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Entre na sua conta para acessar os backups.');
  return { client, user: data.user };
}

export async function getCloudBackupStatus(): Promise<CloudBackupStatus> {
  const [key, confirmed, lastBackupAt] = await Promise.all([
    SecureStore.getItemAsync(ENCRYPTION_KEY_STORAGE),
    SecureStore.getItemAsync(KEY_CONFIRMED_STORAGE),
    SecureStore.getItemAsync(LAST_BACKUP_STORAGE),
  ]);
  return {
    keyExists: Boolean(key),
    keyConfirmed: confirmed === 'true',
    lastBackupAt,
  };
}

/** Creates a random AES-256 key and stores it only in Android SecureStore. */
export async function generateRecoveryKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORAGE);
  if (existing) {
    throw new Error('Já existe uma chave neste aparelho. Revele a chave atual antes de continuar.');
  }

  const key = await AESEncryptionKey.generate(256);
  const recoveryKey = await key.encoded('hex');
  await SecureStore.setItemAsync(ENCRYPTION_KEY_STORAGE, recoveryKey);
  await SecureStore.setItemAsync(KEY_CONFIRMED_STORAGE, 'false');
  return recoveryKey;
}

/** Imports the user's 64-character recovery key on a replacement device. */
export async function importRecoveryKey(recoveryKey: string): Promise<void> {
  const normalized = recoveryKey.trim().replace(/\s+/g, '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new Error('A chave precisa ter exatamente 64 caracteres hexadecimais.');
  }
  await AESEncryptionKey.import(normalized, 'hex');
  await SecureStore.setItemAsync(ENCRYPTION_KEY_STORAGE, normalized);
  await SecureStore.setItemAsync(KEY_CONFIRMED_STORAGE, 'false');
}

export async function revealRecoveryKey(): Promise<string | null> {
  return SecureStore.getItemAsync(ENCRYPTION_KEY_STORAGE);
}

export async function confirmRecoveryKeySaved(): Promise<void> {
  const key = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORAGE);
  if (!key) throw new Error('Gere ou importe uma chave antes de confirmar.');
  await SecureStore.setItemAsync(KEY_CONFIRMED_STORAGE, 'true');
}

async function createEncryptedSnapshot(): Promise<Uint8Array> {
  await prepareJournalDatabase();

  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  const integrity = await db.getFirstAsync<{ integrity_check: string }>(
    'PRAGMA integrity_check'
  );
  if (integrity?.integrity_check !== 'ok') {
    throw new Error('O banco SQLite não passou na verificação de integridade.');
  }

  const tables = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
  );
  const tableNames = new Set(tables.map((table) => table.name));
  const required = ['daily_entries', 'daily_checks', 'habits', 'journal_events'];
  const missing = required.filter((table) => !tableNames.has(table));
  if (missing.length > 0) {
    throw new Error(`O banco ainda não está completo. Tabelas ausentes: ${missing.join(', ')}.`);
  }

  // SQLite.backupDatabaseAsync é a API adequada para uma cópia consistente
  // de banco em WAL; serialização direta da conexão ativa não é suficiente
  // para assumir que as tabelas estão presentes nos bytes exportados.
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  const name = `dot-journal-cloud-snapshot-${stamp}.sqlite`;
  const directory = decodeURIComponent(Paths.cache.uri.replace(/^file:\/\//, ''));
  let temp: SQLite.SQLiteDatabase | null = null;
  try {
    temp = await SQLite.openDatabaseAsync(name, { useNewConnection: true }, directory);

    await SQLite.backupDatabaseAsync({
      sourceDatabase: db,
      destDatabase: temp,
      sourceDatabaseName: 'main',
      destDatabaseName: 'main',
    });

    // Uma cópia em journaling DELETE não depende de arquivos WAL/SHM.
    await temp.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');
    await temp.execAsync('PRAGMA journal_mode = DELETE;');

    const copiedTables = await temp.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    const copiedNames = new Set(copiedTables.map((row) => row.name));
    const lostTables = required.filter((table) => !copiedNames.has(table));
    if (lostTables.length > 0) {
      throw new Error(`Snapshot incompleto: tabelas ausentes após copiar o SQLite (${lostTables.join(', ')}). Envio cancelado.`);
    }

    const snapshot = await temp.serializeAsync();
    if (
      snapshot.byteLength < 100 ||
      SQLITE_HEADER.some((byte, index) => snapshot[index] !== byte)
    ) {
      throw new Error('O snapshot não possui um cabeçalho SQLite válido.');
    }

    // Abre OS BYTES finais com o mesmo inspetor usado na restauração.
    // Não enviar backups que o próprio app é incapaz de restaurar.
    await prepareRestoreBytes(name, snapshot, CLOUD_REQUIRED_TABLES);
    return snapshot;
  } finally {
    if (temp) await temp.closeAsync();
    for (const suffix of ['', '-wal', '-shm', '-journal']) {
      const file = new File(Paths.cache, name + suffix);
      if (file.exists) {
        try { file.delete(); } catch (cleanupError) {
          console.warn('Falha ao remover o snapshot temporário', suffix, cleanupError);
        }
      }
    }
  }
}

export async function uploadCloudBackup(): Promise<{
  name: string;
  bytes: number;
  createdAt: string;
}> {
  const { client, user } = await requireSignedInUser();
  const keyHex = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORAGE);
  const confirmed = await SecureStore.getItemAsync(KEY_CONFIRMED_STORAGE);

  if (!keyHex || confirmed !== 'true') {
    throw new Error('Antes do backup, salve e confirme sua chave de recuperação.');
  }

  const encryptionKey = await AESEncryptionKey.import(keyHex, 'hex');
  const snapshot = await createEncryptedSnapshot();
  const sealed = await aesEncryptAsync(snapshot, encryptionKey);
  const encryptedPayload = await sealed.combined('bytes');

  if (typeof encryptedPayload === 'string') {
    throw new Error('Não foi possível obter os bytes criptografados.');
  }

  const payload = new Uint8Array(
    ENCRYPTED_BACKUP_HEADER.length + encryptedPayload.length
  );
  payload.set(ENCRYPTED_BACKUP_HEADER, 0);
  payload.set(encryptedPayload, ENCRYPTED_BACKUP_HEADER.length);

  if (payload.byteLength > MAX_BACKUP_BYTES) {
    throw new Error('O backup ultrapassa o limite de 25 MB desta versão.');
  }

  // Create a standalone ArrayBuffer for the Supabase Storage upload.
  const uploadBuffer = new ArrayBuffer(payload.byteLength);
  new Uint8Array(uploadBuffer).set(payload);

  const createdAt = new Date().toISOString();
  const stamp = createdAt.replace(/[:.]/g, '-');
  const name = `dot-journal-${stamp}.djbackup`;
  const objectPath = `${user.id}/${name}`;

  const { error } = await client.storage
    .from(CLOUD_BACKUP_BUCKET)
    .upload(objectPath, uploadBuffer, {
      contentType: 'application/octet-stream',
      cacheControl: '0',
      upsert: false,
    });

  if (error) throw error;

  await SecureStore.setItemAsync(LAST_BACKUP_STORAGE, createdAt);
  return { name, bytes: payload.byteLength, createdAt };
}

export async function listCloudBackups(): Promise<CloudBackupItem[]> {
  const { client, user } = await requireSignedInUser();
  const { data, error } = await client.storage
    .from(CLOUD_BACKUP_BUCKET)
    .list(user.id, {
      limit: 30,
      sortBy: { column: 'name', order: 'desc' },
    });

  if (error) throw error;

  return data
    .filter((file) => file.name.endsWith('.djbackup'))
    .map((file) => ({
      name: file.name,
      createdAt: file.created_at ?? file.updated_at ?? null,
      bytes:
        typeof file.metadata?.size === 'number'
          ? file.metadata.size
          : null,
    }));
}


/**
 * Baixa um objeto privado, valida o envelope DJBK, descriptografa localmente
 * com AES-256-GCM e valida todas as tabelas esperadas sem tocar no banco ativo.
 */
export async function prepareCloudBackupRestore(
  backupName: string
): Promise<PreparedRestore> {
  const { client, user } = await requireSignedInUser();
  const keyHex = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORAGE);
  const confirmed = await SecureStore.getItemAsync(KEY_CONFIRMED_STORAGE);

  if (!keyHex || confirmed !== 'true') {
    throw new Error('Importe sua chave de recuperação, guarde-a em local seguro e confirme antes de restaurar.');
  }

  // O nome vem da listagem do bucket, mas é validado novamente antes de formar o caminho.
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,180}\.djbackup$/.test(backupName) ||
    backupName.includes('..') ||
    backupName.includes('/')
  ) {
    throw new Error('Nome de backup inválido.');
  }

  const objectPath = `${user.id}/${backupName}`;
  const { data, error } = await client.storage
    .from(CLOUD_BACKUP_BUCKET)
    .download(objectPath);

  if (error) throw error;
  if (!data) throw new Error('O Supabase não retornou o arquivo de backup.');
  if (data.size < ENCRYPTED_BACKUP_HEADER.length + 32 || data.size > MAX_BACKUP_BYTES) {
    throw new Error('O arquivo criptografado está vazio ou ultrapassa o limite de 25 MB.');
  }

  
const encryptedFile = await new Promise<Uint8Array>((resolve, reject) => {
  const reader = new FileReader();

  reader.onload = () => {
    if (!(reader.result instanceof ArrayBuffer)) {
      reject(new Error('O arquivo não foi convertido para ArrayBuffer.'));
      return;
    }

    resolve(new Uint8Array(reader.result));
  };

  reader.onerror = () => {
    reject(new Error('Falha ao ler o arquivo baixado do Supabase.'));
  };

  reader.readAsArrayBuffer(data);
});


  const headerMatches = ENCRYPTED_BACKUP_HEADER.every(
    (byte, index) => encryptedFile[index] === byte
  );
  if (!headerMatches) {
    throw new Error('Formato de backup desconhecido ou versão não suportada.');
  }

  let sqliteBytes: Uint8Array;
  try {
    const sealedData = AESSealedData.fromCombined(
      encryptedFile.subarray(ENCRYPTED_BACKUP_HEADER.length)
    );
    const key = await AESEncryptionKey.import(keyHex, 'hex');
    const decrypted = await aesDecryptAsync(sealedData, key, { output: 'bytes' });
    if (typeof decrypted === 'string') {
      throw new Error('A descriptografia não retornou bytes.');
    }
    sqliteBytes = new Uint8Array(decrypted);
  } catch {
    throw new Error('Não foi possível descriptografar este backup. Confira se a chave de recuperação é a mesma usada no envio.');
  }

  if (
    sqliteBytes.length < 100 ||
    sqliteBytes.length > MAX_BACKUP_BYTES ||
    SQLITE_HEADER.some((byte, index) => sqliteBytes[index] !== byte)
  ) {
    throw new Error('O conteúdo descriptografado não é um banco SQLite válido.');
  }

  return prepareRestoreBytes(backupName, sqliteBytes, CLOUD_REQUIRED_TABLES);
}

/**
 * Aplica um backup previamente validado. applyRestore salva um snapshot do
 * banco atual em Documents antes da troca e tenta rollback em caso de falha.
 */
export async function applyCloudBackupRestore(
  prepared: PreparedRestore
): Promise<string> {
  const recoveryName = await applyRestore(prepared);
  // Evita que a instalação restaurada envie automaticamente um backup vazio
  // ou desatualizado imediatamente após a recuperação.
  await SecureStore.setItemAsync(LAST_BACKUP_STORAGE, new Date().toISOString());
  return recoveryName;
}

export async function maybeCreateDailyCloudBackup(): Promise<
  'uploaded' | 'not-due' | 'not-ready'
> {
  const [key, confirmed, lastBackupAt] = await Promise.all([
    SecureStore.getItemAsync(ENCRYPTION_KEY_STORAGE),
    SecureStore.getItemAsync(KEY_CONFIRMED_STORAGE),
    SecureStore.getItemAsync(LAST_BACKUP_STORAGE),
  ]);

  if (!key || confirmed !== 'true') return 'not-ready';

  // Primeiro backup sempre é manual. Em um aparelho novo, não envia um
  // banco vazio por cima do histórico remoto antes de o usuário restaurá-lo.
  if (!lastBackupAt) return 'not-due';

  const lastTimestamp = Date.parse(lastBackupAt);
  if (
    !Number.isFinite(lastTimestamp) ||
    Date.now() - lastTimestamp < AUTO_BACKUP_INTERVAL_MS
  ) {
    return 'not-due';
  }

  await uploadCloudBackup();
  return 'uploaded';
}
