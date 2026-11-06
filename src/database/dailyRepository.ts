
import * as SQLite from 'expo-sqlite';

export type CheckType = 'goal' | 'habit';

export type DailyData = {
  notes: string;
  gratitude: string;
  goals: Record<string, boolean>;
  habits: Record<string, boolean>;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function initializeDatabase() {
  const db = await SQLite.openDatabaseAsync('dot-journal.db');

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS daily_entries (
      date TEXT PRIMARY KEY NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      gratitude TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS daily_checks (
      date TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('goal', 'habit')),
      item_id TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (date, type, item_id)
    );

    CREATE INDEX IF NOT EXISTS idx_daily_checks_date
    ON daily_checks(date);

    CREATE TABLE IF NOT EXISTS habits (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#90AE98',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO habits (id, title)
    VALUES
        ('1', 'Tomar remédio'),
        ('2', 'Ler'),
        ('3', 'Exercitar-se'),
        ('4', 'Estudar');
    `);

  return db;
}

function getDatabase() {
  if (!databasePromise) {
    databasePromise = initializeDatabase().catch((error) => {
      databasePromise = null;
      throw error;
    });
  }

  return databasePromise;
}

export async function getDailyData(date: string): Promise<DailyData> {
  const db = await getDatabase();

  const entry = await db.getFirstAsync<{
    notes: string;
    gratitude: string;
  }>(
    'SELECT notes, gratitude FROM daily_entries WHERE date = ?',
    date
  );

  const checks = await db.getAllAsync<{
    type: CheckType;
    item_id: string;
    completed: number;
  }>(
    'SELECT type, item_id, completed FROM daily_checks WHERE date = ?',
    date
  );

  const data: DailyData = {
    notes: entry?.notes ?? '',
    gratitude: entry?.gratitude ?? '',
    goals: {},
    habits: {},
  };

  for (const check of checks) {
    const target = check.type === 'goal' ? data.goals : data.habits;
    target[check.item_id] = check.completed === 1;
  }

  return data;
}

export async function saveDailyField(
  date: string,
  field: 'notes' | 'gratitude',
  value: string
) {
  const db = await getDatabase();

  // A lista de campos é restrita pelo tipo acima.
  if (field === 'notes') {
    await db.runAsync(
      `INSERT INTO daily_entries(date, notes)
       VALUES (?, ?)
       ON CONFLICT(date) DO UPDATE SET notes = excluded.notes`,
      date,
      value
    );
  } else {
    await db.runAsync(
      `INSERT INTO daily_entries(date, gratitude)
       VALUES (?, ?)
       ON CONFLICT(date) DO UPDATE SET gratitude = excluded.gratitude`,
      date,
      value
    );
  }
}

export async function saveDailyCheck(
  date: string,
  type: CheckType,
  itemId: string,
  completed: boolean
) {
  const db = await getDatabase();

  await db.runAsync(
    `INSERT INTO daily_checks(date, type, item_id, completed)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(date, type, item_id)
     DO UPDATE SET completed = excluded.completed`,
    date,
    type,
    itemId,
    completed ? 1 : 0
  );
}
export async function debugDatabase() {
  const db = await getDatabase();

  const entries = await db.getAllAsync(
    'SELECT * FROM daily_entries'
  );

  const checks = await db.getAllAsync(
    'SELECT * FROM daily_checks'
  );

  console.log('=== SQLITE DEBUG ===');
  console.log('ENTRIES:', JSON.stringify(entries));
  console.log('CHECKS:', JSON.stringify(checks));
  console.log('====================');

  return { entries, checks };
}