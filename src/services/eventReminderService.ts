import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { listStoredEvents } from '../database/eventRepository';
import {
  buildUpcomingEventReminderPlan,
  type PlannedEventReminder,
} from './eventReminderPlanner';
import { prepareReminders } from './reminderService';

const CHANNEL_ID = 'dot-journal-events';
const MARKER = 'dot-journal-event';
const MAX_SCHEDULED_EVENT_REMINDERS = 24;

export type UpcomingEventReminder = PlannedEventReminder;

function formatDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

export async function getUpcomingEventReminders(): Promise<UpcomingEventReminder[]> {
  const events = await listStoredEvents();
  return buildUpcomingEventReminderPlan(
    events,
    new Date(),
    400,
    MAX_SCHEDULED_EVENT_REMINDERS,
  );
}

/**
 * Rebuilds only event notifications. Daily journal reminders use a different
 * marker and are never cancelled here.
 *
 * A rolling queue of up to 100 one-shot notifications is created. The agenda
 * and reminders screens refresh it whenever they are opened, and CRUD actions
 * refresh it immediately after saving/deleting an event.
 */
export async function syncEventReminders(): Promise<{
  scheduled: number;
  permissions: boolean;
}> {
  if (Platform.OS === 'web') return { scheduled: 0, permissions: true };

  const events = await listStoredEvents();
  const plan = buildUpcomingEventReminderPlan(
    events,
    new Date(),
    400,
    MAX_SCHEDULED_EVENT_REMINDERS,
  );

  const existing = await Notifications.getAllScheduledNotificationsAsync();
  const old = existing.filter(
    (notification) => notification.content.data?.dotJournalTag === MARKER,
  );

  if (plan.length > 0) {
    await prepareReminders();
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Agenda e compromissos',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) {
      permission = await Notifications.requestPermissionsAsync();
    }
    if (!permission.granted) {
      return { scheduled: old.length, permissions: false };
    }
  }

  // Schedule the new queue first. If any request fails, remove only the new
  // partial queue and preserve the previous valid reminders.
  const newlyScheduled: string[] = [];
  try {
    for (const item of plan) {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: item.type === 'birthday' ? `🎂 ${item.title}` : `✿ ${item.title}`,
          body: item.reminderMinutes === 0
            ? `Seu evento acontece agora (${item.eventTime}).`
            : `Seu evento será em ${formatDate(item.occurrenceDate)} às ${item.eventTime}.`,
          data: {
            dotJournalTag: MARKER,
            eventId: item.eventId,
            occurrenceDate: item.occurrenceDate,
          },
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: item.triggerAt,
          ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
        },
      });
      newlyScheduled.push(identifier);
    }
  } catch (error) {
    for (const identifier of newlyScheduled) {
      try {
        await Notifications.cancelScheduledNotificationAsync(identifier);
      } catch {
        // Best-effort cleanup of the partial new queue.
      }
    }
    throw error;
  }

  for (const notification of old) {
    await Notifications.cancelScheduledNotificationAsync(notification.identifier);
  }

  return { scheduled: newlyScheduled.length, permissions: true };
}
