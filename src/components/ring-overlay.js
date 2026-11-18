import {
  CUSTOM_SOUND,
  SOUNDS,
  ensureAudioContext,
  getCustomAudio,
  getSoundName,
  playCustomAudio,
  playSound
} from '../core/audio.js';
import { qs } from '../utils/dom.js';
import { showToast } from './toast.js';

const APP_TITLE = '时刻 · 闹钟与倒计时';
const SNOOZE_DELAY = 5 * 60000;

export function createRingOverlay() {
  const overlay = qs('#ringOverlay');
  let active = false;
  let soundInterval = null;
  let autoStopTimer = null;
  let titleInterval = null;
  let playingAudio = null;
  let snoozeTimer = null;
  let currentInfo = {};

  qs('#ringStop').addEventListener('click', () => {
    stop();
    showToast('已停止响铃');
  });

  qs('#ringSnooze').addEventListener('click', () => {
    const label = currentInfo.label || '闹钟';
    const soundId = currentInfo.sound || 'bell';
    stop();
    clearTimeout(snoozeTimer);
    snoozeTimer = window.setTimeout(() => {
      start(soundId, {
        timeText: '5 分钟后',
        label: `${label} · 稍后提醒`,
        sound: soundId
      });
    }, SNOOZE_DELAY);
    showToast('5 分钟后再次响铃');
  });

  function start(requestedSoundId, info = {}) {
    stop({ keepTitle: true });
    ensureAudioContext();

    const custom = getCustomAudio();
    let soundId = SOUNDS[requestedSoundId] || requestedSoundId === 'custom'
      ? requestedSoundId
      : 'bell';
    if (soundId === 'custom' && !custom.url) {
      soundId = 'bell';
      showToast('本机音频尚未选择，已改用经典铜铃');
    }

    active = true;
    currentInfo = { ...info, sound: soundId };

    if (soundId === 'custom') {
      playingAudio = playCustomAudio({ loop: true });
      if (!playingAudio) soundId = 'bell';
    }
    if (soundId !== 'custom') {
      playSound(soundId);
      currentInfo.sound = soundId;
      soundInterval = window.setInterval(
        () => playSound(soundId),
        SOUNDS[soundId].period * 1000
      );
    }

    qs('#ringTime').textContent = info.timeText || '00:00';
    qs('#ringLabel').textContent = info.label || '时间到';
    qs('#ringSub').textContent =
      `提示音 · ${soundId === 'custom' ? custom.name || CUSTOM_SOUND.name : getSoundName(soundId)}`;
    overlay.classList.add('is-open');
    document.title = APP_TITLE;

    autoStopTimer = window.setTimeout(() => {
      stop();
      showToast('响铃已持续 2 分钟，自动停止');
    }, 120000);

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
    isOpen: () => active
  };
}

function showSystemNotification(info) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    new Notification('时刻 · 闹钟', {
      body: `${info.label || '时间到'} ${info.timeText || ''}`.trim()
    });
  } catch {
    // Some browsers require a service worker before allowing notifications.
  }
}
