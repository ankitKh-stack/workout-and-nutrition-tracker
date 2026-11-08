// The rest timer's alert: a local notification scheduled for when the
// countdown ends. The phone holds it, so it goes off even when the app is in
// the background, the screen is locked or the app has been closed. Its Android
// channel supplies the vibration and sound. Notifications are not used on web.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'rest-timer';
const isWeb = Platform.OS === 'web';
let allowed: boolean | null = null;
let channelReady = false;

/** Shows and sounds the alert while the app is open too, so it is the same everywhere. Call once at startup. */
export function configureRestAlerts(): void {
  if (isWeb) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Creates the alert channel and asks for permission if it hasn't been given.
 * The channel must exist before Android 13+ shows the permission prompt, and
 * its sound and vibration can't be changed once created.
 *
 * Creating the channel always fails in Expo Go (it lacks part of the native
 * channel support), so a failure is not fatal: the alert then goes to the
 * library's fallback channel ("Miscellaneous"), which still notifies. The
 * installed app creates the channel normally.
 */
export async function ensureRestAlertsAllowed(): Promise<boolean> {
  if (isWeb) return false;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Rest timer',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 400, 200, 400],
      // No `sound` key: leaving it out gives the phone's default notification sound
      // (a value is read as the name of a custom sound file bundled with the app).
    });
    channelReady = true;
  } catch (e) {
    console.warn('Rest timer channel not created; using the fallback channel.', e);
    channelReady = false;
  }
  try {
    let status = await Notifications.getPermissionsAsync();
    if (!status.granted) status = await Notifications.requestPermissionsAsync();
    allowed = status.granted;
  } catch (e) {
    console.warn(e);
    allowed = false;
  }
  return allowed;
}

/** Schedules "Rest over" `seconds` from now. Returns its id, or null when alerts are off. */
export async function scheduleRestAlert(seconds: number): Promise<string | null> {
  if (isWeb || allowed !== true || seconds < 1) return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { title: 'Rest over', body: 'Time for your next set.' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        // Without our channel (Expo Go), leave it out so the fallback channel is used.
        ...(channelReady ? { channelId: CHANNEL_ID } : {}),
      },
    });
  } catch (e) {
    console.warn(e);
    return null;
  }
}

export async function cancelRestAlert(id: string | null): Promise<void> {
  if (isWeb || id === null) return;
  await Notifications.cancelScheduledNotificationAsync(id).catch((e) => console.warn(e));
}
