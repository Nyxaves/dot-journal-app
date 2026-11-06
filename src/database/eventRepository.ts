
import * as SQLite from 'expo-sqlite';

export type EventType =
  | 'birthday'
  | 'meeting'
  | 'appointment'
  | 'holiday'
  | 'other';

export type JournalEvent = {
  id: string;
  title: string;
  date: string;
  time: string | null;
  endTime: string | null;
  type: EventType;
  description: string;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDatabase() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync('dot-journal.db')
      .then(async (db) => {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS journal_events (
            id TEXT PRIMARY KEY NOT NULL,
            title TEXT NOT NULL,
            date TEXT NOT NULL,
            time TEXT,
            type TEXT NOT NULL DEFAULT 'other',
            description TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          );

          CREATE INDEX IF NOT EXISTS idx_events_date
          ON journal_events(date);
        `);
        const columns = await db.getAllAsync<{
          name: string;
        }>('PRAGMA table_info(journal_events)');

        if (!columns.some((column) => column.name === 'end_time')) {
          await db.execAsync(
            'ALTER TABLE journal_events ADD COLUMN end_time TEXT'
          );
        }

        return db;
      })
      .catch((error) => {
        databasePromise = null;
        throw error;
      });
  }

  return databasePromise;
}

function validateDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Data inválida.');
  }

  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() + 1 !== month ||
    parsed.getDate() !== day
  ) {
    throw new Error('Data inválida.');
  }
}

function validateTime(time: string | null) {
  if (time !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error('Horário inválido. Use HH:MM.');
  }
}
function validateInterval(
  start: string | null,
  end: string | null
): void {
  validateTime(start);
  validateTime(end);

  if (end !== null && start === null) {
    throw new Error('Informe o horário inicial.');
  }

  if (
    start !== null &&
    end !== null &&
    end <= start
  ) {
    throw new Error(
      'O horário final deve ser posterior ao inicial.'
    );
  }
}

export async function listEventsByDate(
  date: string
): Promise<JournalEvent[]> {
  validateDate(date);
  const db = await getDatabase();

  return db.getAllAsync<JournalEvent>(
    `SELECT id, title, date, time, end_time, type, description
     FROM journal_events
     WHERE date = ?
     ORDER BY time IS NULL, time ASC, title ASC`,
    date
  );
}

export async function listEventsByMonth(
  year: number,
  month: number
): Promise<JournalEvent[]> {
  if (
    !Number.isInteger(year) ||
    year < 1 || year > 9998 ||
    !Number.isInteger(month) ||
    month < 1 || month > 12
  ) {
    throw new Error('Período inválido.');
  }

  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const next = new Date(year, month, 1);
  const end =
    `${next.getFullYear()}-` +
    `${String(next.getMonth() + 1).padStart(2, '0')}-01`;

  const db = await getDatabase();

  return db.getAllAsync<JournalEvent>(
    `SELECT id, title, date, time,
       end_time AS endTime,
       type, description
     FROM journal_events
     WHERE date >= ? AND date < ?
     ORDER BY date, time IS NULL, time`,
    start,
    end
  );
}

export async function createEvent(
  event: Omit<JournalEvent, 'id'>
): Promise<void> {
  validateDate(event.date);
  validateInterval(event.time, event.endTime);

  if (!event.title.trim()) {
    throw new Error('Informe o título do evento.');
  }

  const db = await getDatabase();

  const id = `${Date.now()}-${Math.random()
    .toString(36).slice(2, 10)}`;

  await db.runAsync(
    `INSERT INTO journal_events
       (id, title, date, time, end_time, type, description)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    event.title.trim(),
    event.date,
    event.time,
    event.endTime,
    event.type,
    event.description.trim()
  );
}

export async function updateEvent(
  event: JournalEvent
): Promise<void> {
  validateDate(event.date);
  validateInterval(event.time, event.endTime);

  if (!event.title.trim()) {
    throw new Error('Informe o título do evento.');
  }

  const db = await getDatabase();

  const result = await db.runAsync(
    `UPDATE journal_events
    SET title = ?,
        date = ?,
        time = ?,
        end_time = ?,
        type = ?,
        description = ?
    WHERE id = ?`,
    event.title.trim(),
    event.date,
    event.time,
    event.endTime,
    event.type,
    event.description.trim(),
    event.id
  );

  if (result.changes === 0) {
    throw new Error('Evento não encontrado.');
  }
}
export async function deleteEvent(id: string): Promise<void> {
  const db = await getDatabase();

  const result = await db.runAsync(
    'DELETE FROM journal_events WHERE id = ?',
    id
  );

  if (result.changes === 0) {
    throw new Error('Evento não encontrado.');
  }
}

export async function listEventsByYear(
  year: number
): Promise<JournalEvent[]> {
  if (
    !Number.isInteger(year) ||
    year < 1 ||
    year > 9999
  ) {
    throw new Error('Ano inválido.');
  }

  const start = `${String(year).padStart(4, '0')}-01-01`;
  const end = `${String(year).padStart(4, '0')}-12-31`;

  const db = await getDatabase();

  return db.getAllAsync<JournalEvent>(
    `SELECT
       id,
       title,
       date,
       time,
       end_time AS endTime,
       type,
       description
     FROM journal_events
     WHERE date >= ? AND date <= ?
     ORDER BY date ASC, time ASC`,
    start,
    end
  );
}
