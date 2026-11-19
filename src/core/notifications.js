const isTauri = '__TAURI_INTERNALS__' in window;
const nativeApi = isTauri
  ? import('@tauri-apps/plugin-notification')
  : null;
const ALARM_ACTION_TYPE_ID = 'alarm-actions';
const TIMER_ACTION_TYPE_ID = 'timer-actions';
const NOTIFICATION_ACTION_IDS = new Set(['stop', 'snooze', 'repeat']);
let notificationActionHandler = null;
let notificationActionsReady = null;

export function configureNotificationActions(handler) {
  notificationActionHandler = handler;
  if (!nativeApi) return Promise.resolve();

  notificationActionsReady ??= nativeApi.then(async ({
    onAction,
    registerActionTypes
  }) => {
    await registerActionTypes([
      {
        id: ALARM_ACTION_TYPE_ID,
        actions: [
          { id: 'stop', title: '停止' },
          { id: 'snooze', title: '5 分钟后再响' }
        ]
      },
      {
        id: TIMER_ACTION_TYPE_ID,
        actions: [
          { id: 'stop', title: '停止' },
          { id: 'repeat', title: '再来一次' }
        ]
      }
    ]);
    await onAction(({ actionId }) => {
      if (NOTIFICATION_ACTION_IDS.has(actionId)) {
        notificationActionHandler?.(actionId);
      }
    });
  });
  return notificationActionsReady;
}

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

export async function sendRingNotification({ title, body, kind = 'alarm' }) {
  try {
    if (!(await requestNotificationPermission())) return false;

    if (nativeApi) {
      await notificationActionsReady;
      const { sendNotification } = await nativeApi;
      await sendNotification({
        title,
        body,
        actionTypeId: kind === 'timer' ? TIMER_ACTION_TYPE_ID : ALARM_ACTION_TYPE_ID
      });
      return true;
    }

    const notification = new Notification(title, { body });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    return true;
  } catch {
    return false;
  }
}
