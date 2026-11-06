
import * as SQLite from 'expo-sqlite';

export type Habit = {
  id: string;
  title: string;
  color: string;
  isActive: boolean;
  createdAt: string;
};

type HabitRow = {
  id: string;
  title: string;
  color: string;
  is_active: number;
  created_at: string;
};

const DATABASE_NAME = 'dot-journal.db';

async function getDatabase() {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#90AE98',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

function mapHabit(row: HabitRow): Habit {
  return {
    id: row.id,
    title: row.title,
    color: row.color,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

export async function listHabits(
  includeInactive = false
): Promise<Habit[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<HabitRow>(
    `SELECT id, title, color, is_active, created_at
     FROM habits
     WHERE (? = 1 OR is_active = 1)
     ORDER BY created_at ASC, id ASC`,
    includeInactive ? 1 : 0
  );

  return rows.map(mapHabit);
}

export async function createHabit(
  title: string,
  color = '#90AE98'
): Promise<Habit> {
  const name = title.trim();

  if (!name) {
    throw new Error('O nome do hábito é obrigatório.');
  }

  const db = await getDatabase();

  const id = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;

  await db.runAsync(
    `INSERT INTO habits (id, title, color)
     VALUES (?, ?, ?)`,
    id,
    name,
    color
  );

  const row = await db.getFirstAsync<HabitRow>(
    `SELECT id, title, color, is_active, created_at
     FROM habits WHERE id = ?`,
    id
  );

  if (!row) {
    throw new Error('Não foi possível recuperar o hábito criado.');
  }

  return mapHabit(row);
}

export async function updateHabit(
  id: string,
  title: string,
  color: string
): Promise<void> {
  const name = title.trim();

  if (!name) {
    throw new Error('O nome do hábito é obrigatório.');
  }

  const db = await getDatabase();

  const result = await db.runAsync(
    `UPDATE habits
     SET title = ?, color = ?
     WHERE id = ?`,
    name,
    color,
    id
  );

  if (result.changes === 0) {
    throw new Error('Hábito não encontrado.');
  }
}

export async function setHabitActive(
  id: string,
  active: boolean
): Promise<void> {
  const db = await getDatabase();

  const result = await db.runAsync(
    `UPDATE habits
     SET is_active = ?
     WHERE id = ?`,
    active ? 1 : 0,
    id
  );

  if (result.changes === 0) {
    throw new Error('Hábito não encontrado.');
  }
}
