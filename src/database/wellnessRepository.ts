import * as SQLite from 'expo-sqlite';

export type WellnessEntry = {
  date: string;
  sleepMinutes: number | null;
  screenMinutes: number | null;
};

type WellnessRow = {
  date: string;
  sleep_minutes: number | null;
  screen_minutes: number | null;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function database() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('dot-journal.db')
      .then(async (db) => {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS wellness_entries (
            date TEXT PRIMARY KEY NOT NULL,
            sleep_minutes INTEGER CHECK (sleep_minutes IS NULL OR (sleep_minutes >= 0 AND sleep_minutes <= 1440)),
            screen_minutes INTEGER CHECK (screen_minutes IS NULL OR (screen_minutes >= 0 AND screen_minutes <= 1440)),
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
        return db;
      })
      .catch((error) => {
        dbPromise = null;
        throw error;
      });
  }
  return dbPromise;
}

function validateDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Data inválida');
  const [year, month, day] = value.split('-').map(Number);
  const check = new Date(year, month - 1, day);
  if (check.getFullYear() !== year || check.getMonth() + 1 !== month || check.getDate() !== day) {
    throw new Error('Data inválida');
  }
}

function validateMinutes(minutes: number | null) {
  if (minutes !== null && (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440)) {
    throw new Error('Informe um valor entre 0 e 24 horas');
  }
}

function fromRow(row: WellnessRow): WellnessEntry {
  return { date: row.date, sleepMinutes: row.sleep_minutes, screenMinutes: row.screen_minutes };
}

export async function getWellnessEntry(date: string): Promise<WellnessEntry> {
  validateDate(date);
  const db = await database();
  const row = await db.getFirstAsync<WellnessRow>(
    'SELECT date, sleep_minutes, screen_minutes FROM wellness_entries WHERE date = ?', date
  );
  return row ? fromRow(row) : { date, sleepMinutes: null, screenMinutes: null };
}

export async function saveWellnessEntry(entry: WellnessEntry): Promise<void> {
  validateDate(entry.date);
  validateMinutes(entry.sleepMinutes);
  validateMinutes(entry.screenMinutes);
  const db = await database();
  await db.runAsync(
    `INSERT INTO wellness_entries (date, sleep_minutes, screen_minutes)
     VALUES (?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       sleep_minutes = excluded.sleep_minutes,
       screen_minutes = excluded.screen_minutes,
       updated_at = CURRENT_TIMESTAMP`,
    entry.date, entry.sleepMinutes, entry.screenMinutes
  );
}

export async function listWellnessRange(startDate: string, endDate: string): Promise<WellnessEntry[]> {
  validateDate(startDate);
  validateDate(endDate);
  if (startDate > endDate) throw new Error('Intervalo inválido');
  const db = await database();
  const rows = await db.getAllAsync<WellnessRow>(
    `SELECT date, sleep_minutes, screen_minutes FROM wellness_entries
     WHERE date >= ? AND date <= ? ORDER BY date ASC`, startDate, endDate
  );
  return rows.map(fromRow);
}
