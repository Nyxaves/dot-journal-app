import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { listStoredEvents, type JournalEvent } from '../database/eventRepository';
import { prepareReminders } from './reminderService';

const CHANNEL_ID = 'dot-journal-daily';
const MARKER = 'dot-journal-event';

function localDate(date: string, time: string | null): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = (time ?? '09:00').split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
}

function buildTrigger(event: JournalEvent): Notifications.SchedulableNotificationTriggerInput | null {
  if (event.reminderMinutes === null) return null;
  const when = localDate(event.date, event.time);
  const h = when.getHours();
  const m = when.getMinutes();
  const channel = Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {};

  // Enquanto a primeira ocorrência ainda não chegou, não dispara lembretes antes da data inicial.
  // A recorrência será ativada após a próxima sincronização com a agenda aberta.
  if (event.recurrence !== 'none' && when.getTime() > Date.now()) {
    return { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, ...channel };
  }
  if (event.recurrence === 'weekly') {
    return { type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: when.getDay() + 1, hour: h, minute: m, ...channel };
  }
  if (event.recurrence === 'monthly') {
    return { type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
      day: when.getDate(), hour: h, minute: m, ...channel };
  }
  if (event.recurrence === 'yearly') {
    return { type: Notifications.SchedulableTriggerInputTypes.YEARLY,
      month: when.getMonth(), day: when.getDate(), hour: h, minute: m, ...channel };
  }
  when.setMinutes(when.getMinutes() - event.reminderMinutes);
  if (when.getTime() <= Date.now()) return null;
  return { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, ...channel };
}

/** Sincroniza só notificações de eventos; o lembrete diário permanece intocado. */
export async function syncEventReminders(): Promise<{scheduled: number; permissions: boolean}> {
  if (Platform.OS === 'web') return { scheduled: 0, permissions: true };
  const events = await listStoredEvents();
  const candidates = events.filter(e => e.reminderMinutes !== null);
  const old = (await Notifications.getAllScheduledNotificationsAsync())
    .filter(n => n.content.data?.dotJournalTag === MARKER);

  if (candidates.length) {
    await prepareReminders();
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) {
      const requested = await Notifications.requestPermissionsAsync();
      if (!requested.granted) return { scheduled: old.length, permissions: false };
    }
  }

  // Reagendamento após alterações. Falhas são propagadas à interface.
  for (const request of old) {
    await Notifications.cancelScheduledNotificationAsync(request.identifier);
  }
  let scheduled = 0;
  for (const event of candidates) {
    const trigger = buildTrigger(event);
    if (!trigger) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: event.type === 'birthday' ? `🎂 ${event.title}` : `✿ ${event.title}`,
        body: event.type === 'birthday' ? 'Uma data especial no seu Dot Journal!' : 'Você tem um compromisso na agenda.',
        data: { dotJournalTag: MARKER, eventId: event.id },
        sound: 'default',
      },
      trigger,
    });
    scheduled++;
  }
  return { scheduled, permissions: true };
}
