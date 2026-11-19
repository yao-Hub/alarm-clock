import {
  SOUNDS,
  ensureAudioContext,
  getSoundName,
  isUploadedSound,
  playCustomAudio,
  playSound
} from '../core/audio.js';
import {
  configureNotificationActions,
  sendRingNotification
} from '../core/notifications.js';
import { qs } from '../utils/dom.js';
import { formatClockTime, formatCountdown } from '../utils/time.js';
import { showToast } from './toast.js';

const APP_TITLE = '时刻 · 闹钟与倒计时';
const SNOOZE_DELAY = 5 * 60000;

export function createRingOverlay({ getRingDuration }) {
  const overlay = qs('#ringOverlay');
  const stopButton = qs('#ringStop');
  const snoozeButton = qs('#ringSnooze');
  const repeatButton = qs('#ringRepeat');
  const pendingReminder = qs('#pendingReminder');
  let active = false;
  let soundInterval = null;
  let autoStopTimer = null;
  let titleInterval = null;
  let playingAudio = null;
  let snoozeTimer = null;
  let pendingSnooze = null;
  let currentInfo = {};

  stopButton.addEventListener('click', () => {
    stop();
    showToast('已停止响铃');
  });

  function snooze() {
    if (currentInfo.kind === 'timer') return;

    const label = currentInfo.label || '闹钟';
    const timeText = currentInfo.timeText || '00:00';
    const soundId = currentInfo.sound || 'bell';
    const alarmId = currentInfo.alarmId;
    stop();
    clearPendingSnooze();
    pendingSnooze = {
      alarmId,
      label,
      timeText,
      sound: soundId,
      deadline: Date.now() + SNOOZE_DELAY
    };
    snoozeTimer = window.setTimeout(() => {
      const pending = pendingSnooze;
      snoozeTimer = null;
      pendingSnooze = null;
      renderSnoozeNotice();
      start(pending.sound, {
        timeText: pending.timeText,
        label: pending.label,
        sound: pending.sound,
        alarmId: pending.alarmId,
        snoozed: true
      });
    }, SNOOZE_DELAY);
    renderSnoozeNotice();
    showToast('5 分钟后再次响铃');
  }

  function cancelSnooze(alarmId) {
    if (!pendingSnooze || pendingSnooze.alarmId !== alarmId) return;
    clearPendingSnooze();
  }

  function clearPendingSnooze() {
    clearTimeout(snoozeTimer);
    snoozeTimer = null;
    pendingSnooze = null;
    renderSnoozeNotice();
  }

  function renderSnoozeNotice() {
    if (!pendingSnooze) {
      pendingReminder.hidden = true;
      return;
    }

    pendingReminder.hidden = false;
    const label = qs('#pendingReminderLabel');
    const metaElement = qs('#pendingReminderMeta');
    const meta = `原定 ${pendingSnooze.timeText} · ${formatClockTime(pendingSnooze.deadline)} 再响`;
    if (label.textContent !== pendingSnooze.label) {
      label.textContent = pendingSnooze.label;
    }
    if (metaElement.textContent !== meta) {
      metaElement.textContent = meta;
    }
    qs('#pendingReminderCountdown').textContent =
      formatCountdown(Math.max(0, pendingSnooze.deadline - Date.now()) / 1000);
  }

  function repeat() {
    const onRepeat = currentInfo.onRepeat;
    stop();
    onRepeat?.();
  }

  snoozeButton.addEventListener('click', snooze);
  repeatButton.addEventListener('click', repeat);
  qs('#pendingReminderCancel').addEventListener('click', () => {
    if (!pendingSnooze) return;
    clearPendingSnooze();
    showToast('已取消稍后提醒');
  });
  void configureNotificationActions((actionId) => {
    if (!active) return;
    if (actionId === 'stop') {
      stop();
    } else if (actionId === 'repeat' && currentInfo.kind === 'timer') {
      repeat();
    } else if (currentInfo.kind !== 'timer') {
      snooze();
    }
  });

  function start(requestedSoundId, info = {}) {
    stop({ keepTitle: true });
    clearPendingSnooze();
    ensureAudioContext();

    let soundId = SOUNDS[requestedSoundId] || isUploadedSound(requestedSoundId)
      ? requestedSoundId
      : 'bell';

    if (isUploadedSound(soundId)) {
      playingAudio = playCustomAudio(soundId, { loop: true });
      if (!playingAudio) {
        soundId = 'bell';
        showToast('上传音频不可用，已改用经典铜铃');
      }
    }
    if (!isUploadedSound(soundId)) {
      playSound(soundId);
      soundInterval = window.setInterval(
        () => playSound(soundId),
        SOUNDS[soundId].period * 1000
      );
    }

    active = true;
    currentInfo = { ...info, sound: soundId };
    const label = info.label || '时间到';
    qs('#ringTime').textContent = info.timeText || '00:00';
    qs('#ringLabel').textContent = info.snoozed ? `${label} · 稍后提醒` : label;
    const isTimer = info.kind === 'timer';
    snoozeButton.hidden = isTimer;
    repeatButton.hidden = !isTimer;
    qs('#ringSub').textContent =
      `提示音 · ${getSoundName(soundId)}`;
    overlay.classList.add('is-open');
    document.title = APP_TITLE;

    const ringDuration = getRingDuration(info.kind);
    if (ringDuration > 0) {
      autoStopTimer = window.setTimeout(() => {
        stop();
        showToast('响铃已达到设置时长，自动停止');
      }, ringDuration * 1000);
    }

    let alternate = false;
    titleInterval = window.setInterval(() => {
      alternate = !alternate;
      document.title = alternate ? '时间到 — 时刻' : APP_TITLE;
    }, 900);

    showSystemNotification(info);
  }

  function stop({ keepTitle = false } = {}) {
    clearInterval(soundInterval);
    clearTimeout(autoStopTimer);
    clearInterval(titleInterval);
    soundInterval = null;
    autoStopTimer = null;
    titleInterval = null;

    if (playingAudio) {
      try {
        playingAudio.pause();
      } catch {
        // The media element may already be detached by the browser.
      }
      playingAudio = null;
    }

    active = false;
    overlay.classList.remove('is-open');
    if (!keepTitle) document.title = APP_TITLE;
  }

  return {
    start,
    stop,
    cancelSnooze,
    renderSnoozeNotice,
    isOpen: () => active
  };
}

function showSystemNotification(info) {
  void sendRingNotification({
    title: info.kind === 'timer' ? '时刻 · 倒计时' : '时刻 · 闹钟',
    body: `${info.snoozed ? '稍后提醒 · ' : ''}${info.label || '时间到'} ${info.timeText || ''}`.trim(),
    kind: info.kind
  });
}
