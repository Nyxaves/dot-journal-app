import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import {
  AESEncryptionKey,
  aesEncryptAsync,
} from 'expo-crypto';

import { getSupabaseClient } from './supabaseClient';
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

  const snapshot = await db.serializeAsync();
  if (
    snapshot.byteLength < 100 ||
    SQLITE_HEADER.some((byte, index) => snapshot[index] !== byte)
  ) {
    throw new Error('O snapshot não possui um cabeçalho SQLite válido.');
  }
  return snapshot;
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

export async function maybeCreateDailyCloudBackup(): Promise<
  'uploaded' | 'not-due' | 'not-ready'
> {
  const [key, confirmed, lastBackupAt] = await Promise.all([
    SecureStore.getItemAsync(ENCRYPTION_KEY_STORAGE),
    SecureStore.getItemAsync(KEY_CONFIRMED_STORAGE),
    SecureStore.getItemAsync(LAST_BACKUP_STORAGE),
  ]);

  if (!key || confirmed !== 'true') return 'not-ready';

  const lastTimestamp = lastBackupAt ? Date.parse(lastBackupAt) : Number.NaN;
  if (
    Number.isFinite(lastTimestamp) &&
    Date.now() - lastTimestamp < AUTO_BACKUP_INTERVAL_MS
  ) {
    return 'not-due';
  }

  await uploadCloudBackup();
  return 'uploaded';
}
