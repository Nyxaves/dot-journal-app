import type { EventRecurrence, EventType } from '../database/eventRepository';

export type ReminderPlannerEvent = {
  id: string;
  title: string;
  date: string;
  time: string | null;
  type: EventType;
  recurrence: EventRecurrence;
  reminderMinutes: number | null;
};

export type PlannedEventReminder = {
  eventId: string;
  title: string;
  type: EventType;
  occurrenceDate: string;
  eventTime: string;
  reminderMinutes: number;
  triggerAt: Date;
};

function dateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function occursOn(event: ReminderPlannerEvent, key: string): boolean {
  if (key < event.date) return false;
  if (event.recurrence === 'none') return key === event.date;
  if (event.recurrence === 'daily') return true;

  const anchor = parseDateKey(event.date);
  const target = parseDateKey(key);
  const dayDifference = Math.round(
    (Date.UTC(target.getFullYear(), target.getMonth(), target.getDate()) -
      Date.UTC(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())) /
      86400000,
  );

  if (event.recurrence === 'weekly') return dayDifference % 7 === 0;
  if (event.recurrence === 'monthly') return anchor.getDate() === target.getDate();
  return anchor.getMonth() === target.getMonth() && anchor.getDate() === target.getDate();
}

/**
 * Builds one-shot reminders for the next 400 days. Scheduling one-shot dates
 * supports advance offsets that cross midnight and works consistently for
 * birthdays and recurring series. The native scheduler is capped to the next
 * 24 reminders; opening the agenda/reminders screen refreshes the rolling queue.
 */
export function buildUpcomingEventReminderPlan(
  events: ReminderPlannerEvent[],
  now: Date = new Date(),
  horizonDays = 400,
  limit = 24,
): PlannedEventReminder[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const horizon = new Date(today.getTime());
  horizon.setDate(horizon.getDate() + horizonDays);
  const nowMs = now.getTime();
  const planned: PlannedEventReminder[] = [];

  for (const event of events) {
    if (event.reminderMinutes === null) continue;
    if (!Number.isInteger(event.reminderMinutes) || event.reminderMinutes < 0 || event.reminderMinutes > 10080) {
      continue;
    }

    const anchor = parseDateKey(event.date);
    const first = anchor > today ? anchor : today;
    const last = event.recurrence === 'none' ? anchor : horizon;
    if (last < first) continue;

    const cursor = new Date(first.getTime());
    while (cursor <= last) {
      const occurrenceDate = dateKey(cursor);
      if (occursOn(event, occurrenceDate)) {
        const eventTime = event.time ?? '09:00';
        const [hour, minute] = eventTime.split(':').map(Number);
        const eventAt = new Date(
          cursor.getFullYear(),
          cursor.getMonth(),
          cursor.getDate(),
          hour,
          minute,
          0,
          0,
        );
        const triggerAt = new Date(eventAt.getTime() - event.reminderMinutes * 60000);
        if (triggerAt.getTime() > nowMs) {
          planned.push({
            eventId: event.id,
            title: event.title,
            type: event.type,
            occurrenceDate,
            eventTime,
            reminderMinutes: event.reminderMinutes,
            triggerAt,
          });
        }
      }

      if (event.recurrence === 'none') break;
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return planned
    .sort((a, b) => a.triggerAt.getTime() - b.triggerAt.getTime())
    .slice(0, Math.max(0, limit));
}
