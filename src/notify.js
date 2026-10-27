import { Platform } from 'react-native';

// expo-notifications is loaded safely: Expo Go may not include its native module.
// If it is missing, every function below silently does nothing (the app keeps working).
let N = null;
try { N = require('expo-notifications'); } catch (e) { N = null; }

let ready = false;
export async function initNotify() {
  if (!N) return;
  try {
    N.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });
    if (Platform.OS === 'android') await N.setNotificationChannelAsync('default', { name: 'QR-ATT', importance: N.AndroidImportance.DEFAULT });
    const cur = await N.getPermissionsAsync();
    ready = cur.granted || (await N.requestPermissionsAsync()).granted;
  } catch (e) { ready = false; }
}
export async function notify(title, body) {          // instant local notification (never crashes the app)
  if (!N) return;
  try { if (!ready) await initNotify(); if (ready) await N.scheduleNotificationAsync({ content: { title, body }, trigger: null }); } catch (e) {}
}
export async function scheduleReminder(ev) {          // reminder 30 min before an open event starts
  if (!N) return;
  try {
    const id = 'rem-' + ev.id; await N.cancelScheduledNotificationAsync(id).catch(() => {});
    if (ev.status !== 'open') return;
    const when = new Date(new Date(`${ev.event_date}T${String(ev.event_time).slice(0, 5)}:00+08:00`).getTime() - 30 * 60000);
    if (when > new Date() && ready) await N.scheduleNotificationAsync({ identifier: id, content: { title: 'Upcoming event', body: `${ev.name} starts in 30 minutes at ${ev.venue}.` },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: when } });
  } catch (e) {}
}
