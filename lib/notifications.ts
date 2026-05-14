import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const registerForPushNotifications = async (
  userId: string,
): Promise<string | null> => {
  if (!Device.isDevice) {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;

  await supabase
    .from('push_tokens')
    .upsert(
      { user_id: userId, token, platform: Platform.OS },
      { onConflict: 'user_id' },
    )
    .throwOnError();

  return token;
};

export const scheduleLocalNotification = async (
  title: string,
  body: string,
  trigger: Notifications.NotificationTriggerInput,
): Promise<string> => {
  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: false },
    trigger,
  });
};

export const cancelNotification = async (id: string): Promise<void> => {
  await Notifications.cancelScheduledNotificationAsync(id);
};

export const sendTestNotification = async (): Promise<void> => {
  await scheduleLocalNotification(
    'Notifications are working!',
    'You will receive reminders from BluCal.',
    {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3,
    },
  );
};

export const cancelAllNotifications = async (): Promise<void> => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};

// Schedule daily log reminder
export const scheduleDailyLogReminder = async (
  hour: number,
  minute: number,
): Promise<string> => {
  await Notifications.cancelAllScheduledNotificationsAsync();
  return scheduleLocalNotification(
    'Time to log your meals',
    'Stay on track with BluCal. Tap to log your food.',
    {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  );
};

// Schedule daily weigh-in reminder
export const scheduleWeighInReminder = async (
  hour: number,
  minute: number,
): Promise<string> => {
  return scheduleLocalNotification(
    'Good morning! Time to weigh in',
    'Log your weight to keep your trends accurate.',
    {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  );
};

// Send weekly coach summary notification (local) — Monday 8pm
export const scheduleWeeklySummary = async (): Promise<string> => {
  return scheduleLocalNotification(
    'Your weekly BluCal summary is ready',
    'Tap to see how your week went.',
    {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 2, // 1=Sunday, 2=Monday in expo-notifications WEEKLY trigger
      hour: 20,
      minute: 0,
    },
  );
};
