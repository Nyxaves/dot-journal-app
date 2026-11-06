import * as SQLite from 'expo-sqlite';

export type RoutineCategory = string;
export type RoutineCategoryItem = { id: string; name: string; color: string };
const INITIAL_CATEGORIES: RoutineCategoryItem[] = [
  { id: 'sleep', name: 'Sono', color: '#A9A3D7' },
  { id: 'work', name: 'Trabalho', color: '#90AE98' },
  { id: 'study', name: 'Estudos', color: '#E4B0C2' },
  { id: 'leisure', name: 'Lazer', color: '#EECF9D' },
  { id: 'health', name: 'Saúde', color: '#A8CADB' },
  { id: 'other', name: 'Outros', color: '#B9B7AE' },
];
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
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS routine_categories (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL COLLATE NOCASE UNIQUE,
          color TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await db.execAsync(`CREATE TABLE IF NOT EXISTS routine_settings (key TEXT PRIMARY KEY NOT NULL);`);
      const initialized = await db.getFirstAsync<{ key: string }>("SELECT key FROM routine_settings WHERE key = 'categories_initialized'");
      if (!initialized) {
        for (const cat of INITIAL_CATEGORIES) {
          await db.runAsync('INSERT OR IGNORE INTO routine_categories (id, name, color) VALUES (?, ?, ?)', cat.id, cat.name, cat.color);
        }
        await db.runAsync("INSERT OR IGNORE INTO routine_settings (key) VALUES ('categories_initialized')");
      }
      // Migração não destrutiva: para cada título antigo, cria uma categoria
      // própria, preservando tanto o nome quanto os blocos e suas horas.
      const legacy = await db.getAllAsync<{ id: string; title: string; category: string; color: string }>(
        'SELECT id, title, category, color FROM routine_blocks'
      );
      for (const block of legacy) {
        const alreadyLinked = await db.getFirstAsync<{ id: string }>('SELECT id FROM routine_categories WHERE id = ?', block.category);
        if (alreadyLinked) {
          const current = await db.getFirstAsync<{ name: string }>('SELECT name FROM routine_categories WHERE id = ?', block.category);
          // Preserva os títulos personalizados que antes eram separados das categorias.
          if (current?.name.toLocaleLowerCase() === block.title.trim().toLocaleLowerCase()) continue;
        }
        const existing = await db.getFirstAsync<{ id: string }>('SELECT id FROM routine_categories WHERE name = ? COLLATE NOCASE', block.title.trim());
        if (existing) {
          await db.runAsync('UPDATE routine_blocks SET category = ? WHERE id = ?', existing.id, block.id);
        } else {
          const id = `legacy-${block.id}`;
          await db.runAsync('INSERT OR IGNORE INTO routine_categories (id, name, color) VALUES (?, ?, ?)', id, block.title.trim() || 'Atividade', block.color);
          await db.runAsync('UPDATE routine_blocks SET category = ? WHERE id = ?', id, block.id);
        }
      }
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

/** Categorias personalizadas são persistidas e usadas por todos os blocos. */
export async function listRoutineCategories(): Promise<RoutineCategoryItem[]> {
  const db = await database();
  return db.getAllAsync<RoutineCategoryItem>('SELECT id, name, color FROM routine_categories ORDER BY name COLLATE NOCASE ASC');
}
export async function saveRoutineCategory(name: string, color: string, editingId?: string): Promise<void> {
  const value = name.trim();
  if (!value || value.length > 60) throw new Error('Informe um nome de até 60 caracteres.');
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error('Cor inválida.');
  const db = await database();
  const duplicate = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM routine_categories WHERE name = ? COLLATE NOCASE AND id != ?', value, editingId ?? ''
  );
  if (duplicate) throw new Error('Já existe uma categoria com esse nome.');
  if (!editingId) {
    await db.runAsync('INSERT INTO routine_categories (id, name, color) VALUES (?, ?, ?)',
      `cat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, value, color);
  } else {
    const result = await db.runAsync('UPDATE routine_categories SET name = ?, color = ? WHERE id = ?', value, color, editingId);
    if (!result.changes) throw new Error('Categoria não encontrada.');
    // Atualiza também o desenho do relógio e os rótulos legados.
    await db.runAsync('UPDATE routine_blocks SET title = ?, color = ? WHERE category = ?', value, color, editingId);
  }
}
export async function deleteRoutineCategory(id: string): Promise<void> {
  const db = await database();
  const inUse = await db.getFirstAsync<{ total: number }>('SELECT COUNT(*) AS total FROM routine_blocks WHERE category = ?', id);
  if (inUse && inUse.total > 0) throw new Error('Esta categoria tem atividades. Exclua ou altere os blocos antes.');
  const result = await db.runAsync('DELETE FROM routine_categories WHERE id = ?', id);
  if (!result.changes) throw new Error('Categoria não encontrada.');
}
