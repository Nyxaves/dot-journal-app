
import * as SQLite from 'expo-sqlite';

export const ANNUAL_GROUPS = {
  Profissional: ['Material', 'Contribuição', 'Propósito'],
  Social: ['Amizades', 'Relacionamento', 'Família'],
  Pessoal: ['Saúde', 'Mental', 'Espiritual'],
} as const;
export type AnnualGroup = keyof typeof ANNUAL_GROUPS;
export type AnnualSubgroup = (typeof ANNUAL_GROUPS)[AnnualGroup][number];
export function validAnnualClassification(group: string, subgroup: string): boolean {
  return Object.entries(ANNUAL_GROUPS).some(([g, subs]) => g === group && (subs as readonly string[]).includes(subgroup));
}
export type AnnualGoal = {
  id: string;
  year: number;
  title: string;
  description: string;
  group: AnnualGroup;
  subgroup: AnnualSubgroup;
  completed: boolean;
};

type AnnualGoalRow = {
  id: string;
  year: number;
  title: string;
  description: string;
  group_name: AnnualGroup;
  subgroup_name: AnnualSubgroup;
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

        // Migração aditiva: metas existentes permanecem intactas.
        const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(annual_goals)');
        if (!columns.some((col) => col.name === 'group_name')) {
          await db.execAsync("ALTER TABLE annual_goals ADD COLUMN group_name TEXT NOT NULL DEFAULT 'Pessoal'");
        }
        if (!columns.some((col) => col.name === 'subgroup_name')) {
          await db.execAsync("ALTER TABLE annual_goals ADD COLUMN subgroup_name TEXT NOT NULL DEFAULT 'Mental'");
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

function mapGoal(row: AnnualGoalRow): AnnualGoal {
  return {
    id: row.id,
    year: row.year,
    title: row.title,
    description: row.description,
    group: row.group_name,
    subgroup: row.subgroup_name,
    completed: row.completed === 1,
  };
}

export async function listAnnualGoals(
  year: number
): Promise<AnnualGoal[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<AnnualGoalRow>(
    `SELECT id, year, title, description, completed, group_name, subgroup_name
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
  description = '',
  group: AnnualGroup = 'Pessoal',
  subgroup: AnnualSubgroup = 'Mental'
): Promise<AnnualGoal> {
  const name = title.trim();

  if (!name) {
    throw new Error('Informe o título da meta.');
  }

  if (!Number.isInteger(year) || year < 1 || year > 9999) {
    throw new Error('Ano inválido.');
  }

  if (!validAnnualClassification(group, subgroup)) throw new Error('Classificação inválida.');

  const db = await getDatabase();

  const id = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;

  await db.runAsync(
    `INSERT INTO annual_goals
       (id, year, title, description, group_name, subgroup_name)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    year,
    name,
    description.trim(),
    group,
    subgroup
  );

  return {
    id,
    year,
    title: name,
    description: description.trim(),
    group,
    subgroup,
    completed: false,
  };
}

export async function updateAnnualGoal(
  id: string,
  title: string,
  description: string,
  group: AnnualGroup = 'Pessoal',
  subgroup: AnnualSubgroup = 'Mental'
): Promise<void> {
  const name = title.trim();

  if (!name) {
    throw new Error('O título da meta é obrigatório.');
  }

  if (!validAnnualClassification(group, subgroup)) throw new Error('Classificação inválida.');
  const db = await getDatabase();

  const result = await db.runAsync(
    `UPDATE annual_goals
     SET title = ?, description = ?, group_name = ?, subgroup_name = ?
     WHERE id = ?`,
    name,
    description.trim(),
    group, subgroup,
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

