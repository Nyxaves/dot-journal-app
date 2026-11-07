import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL_ID = 'dot-journal-daily';
const TAG = 'dot-journal-daily-reminder';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function prepareReminders(): Promise<void> {
  if (Platform.OS === 'web') throw new Error('Lembretes disponíveis no Android e iOS.');
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Meu diário',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export async function requestReminderPermission(): Promise<boolean> {
  await prepareReminders();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const response = await Notifications.requestPermissionsAsync();
  return response.granted;
}

export async function listDailyReminders() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.filter(n => n.content.data?.dotJournalTag === TAG);
}

export async function disableDailyReminder() {
  const reminders = await listDailyReminders();
  for (const reminder of reminders) {
    await Notifications.cancelScheduledNotificationAsync(reminder.identifier);
  }
}

export async function saveDailyReminder(hour: number, minute: number): Promise<void> {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 ||
      !Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new Error('Horário inválido. Informe HH:MM.');
  }
  if (!(await requestReminderPermission())) {
    throw new Error('Ative as notificações nas configurações do celular.');
  }
  await disableDailyReminder();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '✿ Um momento para o seu Dot Journal',
      body: 'Que tal registrar seu dia e conferir suas metas?',
      data: { dotJournalTag: TAG },
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    },
  });
}

export async function sendTestReminder() {
  if (!(await requestReminderPermission())) {
    throw new Error('Permissão para notificações não concedida.');
  }
  await Notifications.scheduleNotificationAsync({
    content: { title: '✿ Teste de lembrete', body: 'As notificações do Dot Journal estão configuradas!', sound: 'default' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 10,
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    },
  });
}
