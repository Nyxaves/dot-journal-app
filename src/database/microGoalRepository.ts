
import * as SQLite from 'expo-sqlite';

export type MicroGoal = {
  id: string;
  date: string;
  title: string;
};

const SUGGESTIONS = [
  'Beber um copo de água',
  'Escrever uma frase',
  'Organizar meu espaço',
  'Alongar por cinco minutos',
  'Ler duas páginas',
  'Fazer uma pequena pausa',
  'Anotar uma coisa positiva',
  'Arrumar minha mesa',
  'Respirar fundo por um minuto',
  'Caminhar por cinco minutos',
  'Ouvir uma música relaxante',
  'Organizar uma pequena tarefa',
];

const DEFAULT_GOALS = SUGGESTIONS.slice(0, 3);

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDatabase() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync('dot-journal.db')
      .then(async (db) => {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS micro_goals (
            date TEXT NOT NULL,
            id TEXT NOT NULL,
            title TEXT NOT NULL,
            PRIMARY KEY (date, id)
          );
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

export async function listMicroGoals(
  date: string
): Promise<MicroGoal[]> {
  const db = await getDatabase();

  // Preserva os IDs utilizados nas marcações existentes.
  for (let i = 0; i < 3; i++) {
    await db.runAsync(
      `INSERT OR IGNORE INTO micro_goals (date, id, title)
       VALUES (?, ?, ?)`,
      date,
      String(i + 1),
      DEFAULT_GOALS[i]
    );
  }

  return db.getAllAsync<MicroGoal>(
    `SELECT id, date, title
     FROM micro_goals
     WHERE date = ?
     ORDER BY CAST(id AS INTEGER) ASC`,
    date
  );
}

export async function updateMicroGoal(
  date: string,
  id: string,
  title: string
): Promise<void> {
  const name = title.trim();

  if (!name) {
    throw new Error('O título da micro-meta é obrigatório.');
  }

  if (!['1', '2', '3'].includes(id)) {
    throw new Error('Micro-meta inválida.');
  }

  const db = await getDatabase();

  const result = await db.runAsync(
    `UPDATE micro_goals
     SET title = ?
     WHERE date = ? AND id = ?`,
    name,
    date,
    id
  );

  if (result.changes === 0) {
    throw new Error('Micro-meta não encontrada.');
  }
}

export async function suggestMicroGoal(
  date: string,
  id: string
): Promise<string> {
  const goals = await listMicroGoals(date);
  const current = goals.find((goal) => goal.id === id);

  if (!current) {
    throw new Error('Micro-meta não encontrada.');
  }

  const used = new Set(goals.map((goal) => goal.title));
  const available = SUGGESTIONS.filter(
    (suggestion) => !used.has(suggestion)
  );

  if (available.length === 0) {
    throw new Error('Sem sugestões disponíveis.');
  }

  const randomIndex = Math.floor(Math.random() * available.length);
  const suggestion = available[randomIndex];

  await updateMicroGoal(date, id, suggestion);

  return suggestion;
}
