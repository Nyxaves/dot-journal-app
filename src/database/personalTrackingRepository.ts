import * as SQLite from 'expo-sqlite';

export type Mood = 'great' | 'good' | 'neutral' | 'bad';

export type PersonalDay = {
  date: string;
  mood: Mood | null;
  menstruating: boolean;
};

const MOODS: ReadonlyArray<Mood> = ['great', 'good', 'neutral', 'bad'];
const EMPTY: Omit<PersonalDay, 'date'> = { mood: null, menstruating: false };
let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync('dot-journal.db').then(async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS personal_day_tracking (
          date TEXT PRIMARY KEY NOT NULL,
          mood TEXT CHECK(mood IN ('great', 'good', 'neutral', 'bad') OR mood IS NULL),
          menstruating INTEGER NOT NULL DEFAULT 0 CHECK(menstruating IN (0, 1))
        );
      `);
      return db;
    }).catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

function checkDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Data inválida');
  const [y, m, d] = date.split('-').map(Number);
  const parsed = new Date(y, m - 1, d);
  if (parsed.getFullYear() !== y || parsed.getMonth() !== m - 1 || parsed.getDate() !== d) {
    throw new Error('Data inválida');
  }
}

function rowToPersonalDay(row: { date: string; mood: string | null; menstruating: number }): PersonalDay {
  return {
    date: row.date,
    mood: MOODS.includes(row.mood as Mood) ? (row.mood as Mood) : null,
    menstruating: row.menstruating === 1,
  };
}

export async function getPersonalDay(date: string): Promise<PersonalDay> {
  checkDate(date);
  const db = await getDb();
  const row = await db.getFirstAsync<{ date: string; mood: string | null; menstruating: number }>(
    'SELECT date, mood, menstruating FROM personal_day_tracking WHERE date = ?', date
  );
  return row ? rowToPersonalDay(row) : { date, ...EMPTY };
}

export async function listPersonalDaysByMonth(year: number, month: number): Promise<PersonalDay[]> {
  if (!Number.isInteger(year) || year < 1 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('Período inválido');
  }
  const db = await getDb();
  const prefix = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-`;
  const rows = await db.getAllAsync<{ date: string; mood: string | null; menstruating: number }>(
    'SELECT date, mood, menstruating FROM personal_day_tracking WHERE date LIKE ? ORDER BY date', `${prefix}%`
  );
  return rows.map(rowToPersonalDay);
}

export async function savePersonalDay(day: PersonalDay): Promise<void> {
  checkDate(day.date);
  if (day.mood !== null && !MOODS.includes(day.mood)) throw new Error('Humor inválido');
  const db = await getDb();
  if (day.mood === null && !day.menstruating) {
    await db.runAsync('DELETE FROM personal_day_tracking WHERE date = ?', day.date);
    return;
  }
  await db.runAsync(
    `INSERT INTO personal_day_tracking (date, mood, menstruating) VALUES (?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET mood = excluded.mood, menstruating = excluded.menstruating`,
    day.date, day.mood, day.menstruating ? 1 : 0
  );
}
