
import * as SQLite from 'expo-sqlite';

export type AnnualGoal = {
  id: string;
  year: number;
  title: string;
  description: string;
  completed: boolean;
};

type AnnualGoalRow = {
  id: string;
  year: number;
  title: string;
  description: string;
  completed: number;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDatabase() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync('dot-journal.db')
      .then(async (db) => {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS annual_goals (
            id TEXT PRIMARY KEY NOT NULL,
            year INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            completed INTEGER NOT NULL DEFAULT 0
              CHECK (completed IN (0, 1)),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          );

          CREATE INDEX IF NOT EXISTS idx_annual_goals_year
          ON annual_goals(year);
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

function mapGoal(row: AnnualGoalRow): AnnualGoal {
  return {
    id: row.id,
    year: row.year,
    title: row.title,
    description: row.description,
    completed: row.completed === 1,
  };
}

export async function listAnnualGoals(
  year: number
): Promise<AnnualGoal[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<AnnualGoalRow>(
    `SELECT id, year, title, description, completed
     FROM annual_goals
     WHERE year = ?
     ORDER BY created_at ASC, id ASC`,
    year
  );

  return rows.map(mapGoal);
}

export async function createAnnualGoal(
  year: number,
  title: string,
  description = ''
): Promise<AnnualGoal> {
  const name = title.trim();

  if (!name) {
    throw new Error('Informe o título da meta.');
  }

  if (!Number.isInteger(year) || year < 1 || year > 9999) {
    throw new Error('Ano inválido.');
  }

  const db = await getDatabase();

  const id = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;

  await db.runAsync(
    `INSERT INTO annual_goals
       (id, year, title, description)
     VALUES (?, ?, ?, ?)`,
    id,
    year,
    name,
    description.trim()
  );

  return {
    id,
    year,
    title: name,
    description: description.trim(),
    completed: false,
  };
}

export async function updateAnnualGoal(
  id: string,
  title: string,
  description: string
): Promise<void> {
  const name = title.trim();

  if (!name) {
    throw new Error('O título da meta é obrigatório.');
  }

  const db = await getDatabase();

  const result = await db.runAsync(
    `UPDATE annual_goals
     SET title = ?, description = ?
     WHERE id = ?`,
    name,
    description.trim(),
    id
  );

  if (result.changes === 0) {
    throw new Error('Meta anual não encontrada.');
  }
}

export async function setAnnualGoalCompleted(
  id: string,
  completed: boolean
): Promise<void> {
  const db = await getDatabase();

  const result = await db.runAsync(
    `UPDATE annual_goals
     SET completed = ?
     WHERE id = ?`,
    completed ? 1 : 0,
    id
  );

  if (result.changes === 0) {
    throw new Error('Meta anual não encontrada.');
  }
}

export async function deleteAnnualGoal(
  id: string
): Promise<void> {
  const db = await getDatabase();

  const result = await db.runAsync(
    'DELETE FROM annual_goals WHERE id = ?',
    id
  );

  if (result.changes === 0) {
    throw new Error('Meta anual não encontrada.');
  }
}

