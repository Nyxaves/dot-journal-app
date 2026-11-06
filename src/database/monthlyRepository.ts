
import * as SQLite from 'expo-sqlite';
import { getDailyData } from './dailyRepository';
import { listHabits } from './habitRepository';

export type MonthlyHabit = {
  id: string;
  title: string;
  color: string;
  isActive: boolean;
  completedDays: number[];
  totalCompleted: number;
};

export type MonthlyTracker = {
  year: number;
  month: number;
  daysInMonth: number;
  habits: MonthlyHabit[];
};

type CheckRow = {
  item_id: string;
  date: string;
};

export async function getMonthlyTracker(
  year: number,
  month: number
): Promise<MonthlyTracker> {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    year < 1 ||
    year > 9999 ||
    month < 1 ||
    month > 12
  ) {
    throw new Error('Mês ou ano inválido.');
  }

  const startDate =
    `${year}-${String(month).padStart(2, '0')}-01`;

  const nextMonthDate = new Date(year, month, 1);
  const endDate =
    `${nextMonthDate.getFullYear()}-` +
    `${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;

  const daysInMonth = new Date(year, month, 0).getDate();

  // Garante que as tabelas existentes estejam inicializadas.
  await getDailyData(startDate);
  const habits = await listHabits(true);

  const db = await SQLite.openDatabaseAsync('dot-journal.db');

  const checks = await db.getAllAsync<CheckRow>(
    `SELECT item_id, date
     FROM daily_checks
     WHERE type = 'habit'
       AND completed = 1
       AND date >= ?
       AND date < ?
     ORDER BY date ASC`,
    startDate,
    endDate
  );

  const completedByHabit = new Map<string, Set<number>>();

  for (const check of checks) {
    const day = Number(check.date.slice(8, 10));

    if (!completedByHabit.has(check.item_id)) {
      completedByHabit.set(check.item_id, new Set());
    }

    completedByHabit.get(check.item_id)!.add(day);
  }

  const monthlyHabits: MonthlyHabit[] = habits
  .filter((habit) => habit.isActive)
  .map((habit) => {
      const completedDays = Array.from(
        completedByHabit.get(habit.id) ?? []
      ).sort((a, b) => a - b);

      return {
        id: habit.id,
        title: habit.title,
        color: habit.color,
        isActive: habit.isActive,
        completedDays,
        totalCompleted: completedDays.length,
      };
    });

  return {
    year,
    month,
    daysInMonth,
    habits: monthlyHabits,
  };
}
