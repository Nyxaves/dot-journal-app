
import * as SQLite from 'expo-sqlite';

export type WeeklyGoal = {
  id: string;
  weekStart: string;
  title: string;
  completed: boolean;
};

type WeeklyGoalRow = {
  id: string;
  week_start: string;
  title: string;
  completed: number;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDatabase() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync('dot-journal.db')
      .then(async (db) => {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS weekly_goals (
            id TEXT PRIMARY KEY NOT NULL,
            week_start TEXT NOT NULL,
            title TEXT NOT NULL,
            completed INTEGER NOT NULL DEFAULT 0
              CHECK (completed IN (0, 1)),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          );

          CREATE INDEX IF NOT EXISTS idx_weekly_goals_week
          ON weekly_goals(week_start);
        `);

        return db;
      })
      .catch((error) => {
        databasePromise = null;
        throw error;
      });
  }

  return databasePromise;
}

function mapGoal(row: WeeklyGoalRow): WeeklyGoal {
  return {
    id: row.id,
    weekStart: row.week_start,
    title: row.title,
    completed: row.completed === 1,
  };
}

export async function listWeeklyGoals(
  weekStart: string
): Promise<WeeklyGoal[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<WeeklyGoalRow>(
    `SELECT id, week_start, title, completed
     FROM weekly_goals
     WHERE week_start = ?
     ORDER BY created_at ASC, id ASC`,
    weekStart
  );

  return rows.map(mapGoal);
}

export async function createWeeklyGoal(
  weekStart: string,
  title: string
): Promise<WeeklyGoal> {
  const name = title.trim();

  if (!name) {
    throw new Error('Informe o objetivo da semana.');
  }

  const db = await getDatabase();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  await db.runAsync(
    `INSERT INTO weekly_goals (id, week_start, title)
     VALUES (?, ?, ?)`,
    id,
    weekStart,
    name
  );

  return {
    id,
    weekStart,
    title: name,
    completed: false,
  };
}

export async function toggleWeeklyGoal(
  id: string,
  completed: boolean
): Promise<void> {
  const db = await getDatabase();

  const result = await db.runAsync(
    `UPDATE weekly_goals
     SET completed = ?
     WHERE id = ?`,
    completed ? 1 : 0,
    id
  );

  if (result.changes === 0) {
    throw new Error('Objetivo não encontrado.');
  }
}

export async function deleteWeeklyGoal(
  id: string
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    'DELETE FROM weekly_goals WHERE id = ?',
    id
  );
}
