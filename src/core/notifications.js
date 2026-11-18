const isTauri = '__TAURI_INTERNALS__' in window;
const nativeApi = isTauri
  ? import('@tauri-apps/plugin-notification')
  : null;

export async function requestNotificationPermission() {
  try {
    if (nativeApi) {
      const { isPermissionGranted, requestPermission } = await nativeApi;
      if (await isPermissionGranted()) return true;
      return (await requestPermission()) === 'granted';
    }

    if (!('Notification' in window) || Notification.permission === 'denied') {
      return false;
    }
    if (Notification.permission === 'granted') return true;
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

export async function sendAlarmNotification({ title, body }) {
  try {
    if (!(await requestNotificationPermission())) return false;

    if (nativeApi) {
      const { sendNotification } = await nativeApi;
      await sendNotification({ title, body });
      return true;
    }

    new Notification(title, { body });
    return true;
  } catch {
    return false;
  }
}
