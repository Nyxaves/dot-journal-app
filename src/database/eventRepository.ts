
import * as SQLite from 'expo-sqlite';

export type EventType =
  | 'birthday'
  | 'meeting'
  | 'appointment'
  | 'holiday'
  | 'other';

export type EventRecurrence = 'none' | 'weekly' | 'monthly' | 'yearly';

export type JournalEvent = {
  id: string;
  title: string;
  date: string;
  time: string | null;
  endTime: string | null;
  type: EventType;
  description: string;
  recurrence: EventRecurrence;
  reminderMinutes: number | null;
  /** Data original da série, quando a ocorrência é projetada. */
  seriesDate?: string;
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

        const existing = await db.getAllAsync<{name: string}>('PRAGMA table_info(journal_events)');
        if (!existing.some(c => c.name === 'recurrence')) {
          await db.execAsync("ALTER TABLE journal_events ADD COLUMN recurrence TEXT NOT NULL DEFAULT 'none'");
        }
        if (!existing.some(c => c.name === 'reminder_minutes')) {
          await db.execAsync('ALTER TABLE journal_events ADD COLUMN reminder_minutes INTEGER');
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

function validatePreferences(event: Omit<JournalEvent, 'id'>) {
  if (!['none', 'weekly', 'monthly', 'yearly'].includes(event.recurrence)) {
    throw new Error('Recorrência inválida.');
  }
  if (event.reminderMinutes !== null && ![0, 10, 60].includes(event.reminderMinutes)) {
    throw new Error('Lembrete inválido.');
  }
  if (event.recurrence !== 'none' && event.reminderMinutes !== null && event.reminderMinutes !== 0) {
    throw new Error('Eventos recorrentes aceitam lembrete apenas no horário.');
  }
}

const EVENT_COLUMNS = `id, title, date, time, end_time AS endTime, type, description,
  recurrence, reminder_minutes AS reminderMinutes`;

function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function toKey(date: Date): string { return date.toISOString().slice(0, 10); }

/** Uma instância é exibida na data de ocorrência, sem gerar cópias no banco. */
export function eventOccursOn(event: JournalEvent, key: string): boolean {
  if (key < event.date) return false;
  if (event.recurrence === 'none') return key === event.date;
  const anchor = fromKey(event.date);
  const target = fromKey(key);
  if (event.recurrence === 'weekly') {
    return (target.getTime() - anchor.getTime()) % (7 * 86400000) === 0;
  }
  if (event.recurrence === 'monthly') return anchor.getUTCDate() === target.getUTCDate();
  return anchor.getUTCMonth() === target.getUTCMonth() && anchor.getUTCDate() === target.getUTCDate();
}

async function eventsInRange(start: string, endExclusive: string): Promise<JournalEvent[]> {
  const db = await getDatabase();
  const originals = await db.getAllAsync<JournalEvent>(
    `SELECT ${EVENT_COLUMNS} FROM journal_events
     WHERE (date >= ? AND date < ?) OR (recurrence != 'none' AND date < ?)
     ORDER BY date, time IS NULL, time`, start, endExclusive, endExclusive
  );
  const result: JournalEvent[] = [];
  for (const event of originals) {
    if (event.recurrence === 'none') {
      result.push(event);
      continue;
    }
    for (let day = fromKey(start); toKey(day) < endExclusive; day.setUTCDate(day.getUTCDate() + 1)) {
      const occurrenceDate = toKey(day);
      if (eventOccursOn(event, occurrenceDate)) {
        result.push({ ...event, seriesDate: event.date, date: occurrenceDate });
      }
    }
  }
  return result.sort((a,b) => a.date.localeCompare(b.date) ||
    (a.time === null ? 1 : b.time === null ? -1 : a.time.localeCompare(b.time)) ||
    a.title.localeCompare(b.title));
}

export async function listStoredEvents(): Promise<JournalEvent[]> {
  const db = await getDatabase();
  return db.getAllAsync<JournalEvent>(`SELECT ${EVENT_COLUMNS} FROM journal_events ORDER BY date, time`);
}

export async function listEventsByDate(date: string): Promise<JournalEvent[]> {
  validateDate(date);
  return eventsInRange(date, toKey(new Date(fromKey(date).getTime() + 86400000)));
}

export async function listEventsByMonth(year: number, month: number): Promise<JournalEvent[]> {
  if (!Number.isInteger(year) || year < 1 || year > 9998 ||
      !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('Período inválido.');
  }
  const start = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
  const next = new Date(Date.UTC(year, month, 1));
  return eventsInRange(start, toKey(next));
}

export async function createEvent(
  event: Omit<JournalEvent, 'id'>
): Promise<void> {
  validateDate(event.date);
  validateInterval(event.time, event.endTime);
  validatePreferences(event);

  if (!event.title.trim()) {
    throw new Error('Informe o título do evento.');
  }

  const db = await getDatabase();

  const id = `${Date.now()}-${Math.random()
    .toString(36).slice(2, 10)}`;

  await db.runAsync(
    `INSERT INTO journal_events
       (id, title, date, time, end_time, type, description, recurrence, reminder_minutes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    event.title.trim(),
    event.date,
    event.time,
    event.endTime,
    event.type,
    event.description.trim(),
    event.recurrence,
    event.reminderMinutes
  );
}

export async function updateEvent(
  event: JournalEvent
): Promise<void> {
  validateDate(event.date);
  validateInterval(event.time, event.endTime);
  validatePreferences(event);

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
        description = ?,
        recurrence = ?,
        reminder_minutes = ?
    WHERE id = ?`,
    event.title.trim(),
    event.date,
    event.time,
    event.endTime,
    event.type,
    event.description.trim(),
    event.recurrence,
    event.reminderMinutes,
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

export async function listEventsByYear(year: number): Promise<JournalEvent[]> {
  if (!Number.isInteger(year) || year < 1 || year > 9998) {
    throw new Error('Ano inválido.');
  }
  const start = `${String(year).padStart(4, '0')}-01-01`;
  const end = `${String(year + 1).padStart(4, '0')}-01-01`;
  return eventsInRange(start, end);
}
