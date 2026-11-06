import * as SQLite from 'expo-sqlite';

export type RoutineCategory = 'sleep' | 'work' | 'study' | 'leisure' | 'health' | 'other';
export type RoutineBlock = {
  id: string;
  title: string;
  category: RoutineCategory;
  startMinute: number;
  endMinute: number;
  color: string;
};

type Row = {
  id: string;
  title: string;
  category: RoutineCategory;
  start_minute: number;
  end_minute: number;
  color: string;
};

let connection: Promise<SQLite.SQLiteDatabase> | null = null;
async function database(): Promise<SQLite.SQLiteDatabase> {
  if (!connection) {
    connection = SQLite.openDatabaseAsync('dot-journal.db').then(async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS routine_blocks (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          category TEXT NOT NULL,
          start_minute INTEGER NOT NULL CHECK(start_minute >= 0 AND start_minute < 1440),
          end_minute INTEGER NOT NULL CHECK(end_minute >= 0 AND end_minute <= 1440),
          color TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_routine_blocks_start ON routine_blocks(start_minute);
      `);
      return db;
    }).catch((error) => {
      connection = null;
      throw error;
    });
  }
  return connection;
}

function mapRow(row: Row): RoutineBlock {
  return {
    id: row.id, title: row.title, category: row.category,
    startMinute: row.start_minute, endMinute: row.end_minute, color: row.color,
  };
}

export function routineSegments(block: Pick<RoutineBlock, 'startMinute' | 'endMinute'>): [number, number][] {
  const { startMinute: start, endMinute: end } = block;
  if (end > start) return [[start, end]];
  if (end < start) return [[start, 1440], [0, end]].filter(([a, b]) => b > a) as [number, number][];
  return [];
}

export function routineDuration(block: Pick<RoutineBlock, 'startMinute' | 'endMinute'>): number {
  return (block.endMinute - block.startMinute + 1440) % 1440 ||
    (block.startMinute === 0 && block.endMinute === 1440 ? 1440 : 0);
}

export function formatRoutineTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function parseRoutineTime(input: string, isEnd = false): number {
  const digits = input.replace(/\D/g, '');
  if (!digits || digits.length > 4) throw new Error('Informe um horário válido.');
  let hours: number;
  let minutes = 0;
  if (digits.length <= 2) hours = Number(digits);
  else if (digits.length === 3) {
    hours = Number(digits.slice(0, 1));
    minutes = Number(digits.slice(1));
  } else {
    hours = Number(digits.slice(0, 2));
    minutes = Number(digits.slice(2));
  }
  if (hours > 24 || minutes > 59 || (hours === 24 && (minutes !== 0 || !isEnd))) {
    throw new Error('Use horários entre 00:00 e 23:59 (fim pode ser 24:00).');
  }
  return hours * 60 + minutes;
}

export function validateRoutineBlock(
  proposed: Omit<RoutineBlock, 'id'>,
  existing: RoutineBlock[],
  editingId?: string,
): void {
  if (!proposed.title.trim()) throw new Error('Informe o nome da atividade.');
  if (!/^#[0-9a-fA-F]{6}$/.test(proposed.color)) throw new Error('Cor inválida.');
  if (!Number.isInteger(proposed.startMinute) || proposed.startMinute < 0 || proposed.startMinute >= 1440 ||
      !Number.isInteger(proposed.endMinute) || proposed.endMinute < 0 || proposed.endMinute > 1440) {
    throw new Error('Horário fora do intervalo permitido.');
  }
  if (routineDuration(proposed) === 0) throw new Error('Início e fim não podem ser iguais.');
  const segments = routineSegments(proposed);
  for (const block of existing) {
    if (block.id === editingId) continue;
    for (const [start, end] of segments) {
      if (routineSegments(block).some(([otherStart, otherEnd]) => start < otherEnd && otherStart < end)) {
        throw new Error(`Horário sobreposto à atividade “${block.title}”.`);
      }
    }
  }
}

export async function listRoutineBlocks(): Promise<RoutineBlock[]> {
  const db = await database();
  const rows = await db.getAllAsync<Row>(
    `SELECT id, title, category, start_minute, end_minute, color
     FROM routine_blocks ORDER BY start_minute ASC, id ASC`
  );
  return rows.map(mapRow);
}

export async function saveRoutineBlock(
  proposed: Omit<RoutineBlock, 'id'>,
  editingId?: string,
): Promise<void> {
  const current = await listRoutineBlocks();
  validateRoutineBlock(proposed, current, editingId);
  const db = await database();
  if (editingId) {
    const result = await db.runAsync(
      `UPDATE routine_blocks SET title = ?, category = ?, start_minute = ?, end_minute = ?, color = ? WHERE id = ?`,
      proposed.title.trim(), proposed.category, proposed.startMinute, proposed.endMinute, proposed.color, editingId,
    );
    if (result.changes === 0) throw new Error('Atividade não encontrada.');
  } else {
    await db.runAsync(
      `INSERT INTO routine_blocks (id, title, category, start_minute, end_minute, color) VALUES (?, ?, ?, ?, ?, ?)`,
      `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      proposed.title.trim(), proposed.category, proposed.startMinute, proposed.endMinute, proposed.color,
    );
  }
}

export async function deleteRoutineBlock(id: string): Promise<void> {
  const db = await database();
  const result = await db.runAsync('DELETE FROM routine_blocks WHERE id = ?', id);
  if (result.changes === 0) throw new Error('Atividade não encontrada.');
}
