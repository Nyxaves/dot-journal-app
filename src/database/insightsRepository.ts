import * as SQLite from 'expo-sqlite';

export type MonthInsights = {
  month: string;
  notesDays: number;
  habitsCompleted: number;
  goalsCompleted: number;
  events: number;
  mood: Record<'great' | 'good' | 'neutral' | 'bad', number>;
  periodDays: number;
  averageSleep: number | null;
  averageScreen: number | null;
  sleepDays: number;
  screenDays: number;
};

type TotalRow = { value: number | null };

export async function getMonthInsights(year: number, month: number): Promise<MonthInsights> {
  if (!Number.isInteger(year) || !Number.isInteger(month) || year < 1 || year > 9999 || month < 1 || month > 12) {
    throw new Error('Mês inválido');
  }
  const prefix = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-`;
  const db = await SQLite.openDatabaseAsync('dot-journal.db');
  const exists = await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'");
  const tables = new Set(exists.map(x => x.name));
  async function count(table: string, predicate: string = '1=1') {
    if (!tables.has(table)) return 0;
    // Table names and predicates are fixed in calls, not from user input.
    const r = await db.getFirstAsync<TotalRow>(`SELECT COUNT(*) AS value FROM ${table} WHERE date LIKE ? AND ${predicate}`, `${prefix}%`);
    return r?.value ?? 0;
  }
  async function average(field: string) {
    if (!tables.has('wellness_entries')) return null;
    const r = await db.getFirstAsync<TotalRow>(`SELECT AVG(${field}) AS value FROM wellness_entries WHERE date LIKE ?`, `${prefix}%`);
    return r?.value == null ? null : Math.round(r.value / 6) / 10;
  }
  const [notesDays, habitsCompleted, goalsCompleted, events, great, good, neutral, bad, periodDays, averageSleep, averageScreen, sleepDays, screenDays] = await Promise.all([
    count('daily_entries', "(TRIM(notes) <> '' OR TRIM(gratitude) <> '')"),
    count('daily_checks', "type='habit' AND completed=1"),
    count('daily_checks', "type='goal' AND completed=1"),
    count('journal_events'),
    count('personal_day_tracking', "mood='great'"),
    count('personal_day_tracking', "mood='good'"),
    count('personal_day_tracking', "mood='neutral'"),
    count('personal_day_tracking', "mood='bad'"),
    count('personal_day_tracking', 'menstruating=1'),
    average('sleep_minutes'), average('screen_minutes'),
    count('wellness_entries', 'sleep_minutes IS NOT NULL'),
    count('wellness_entries', 'screen_minutes IS NOT NULL'),
  ]);
  return { month: prefix.slice(0, 7), notesDays, habitsCompleted, goalsCompleted, events,
    mood: { great, good, neutral, bad }, periodDays,
    averageSleep, averageScreen, sleepDays, screenDays };
}
