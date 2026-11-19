import { PICKABLE_SOUNDS, SOUNDS, isUploadedSound } from './audio.js';
import { createId } from '../utils/dom.js';
import { nextOccurrence } from '../utils/time.js';

const STORE_KEY = 'shike.clock.v1';

export const state = {
  alarms: [],
  sound: 'bell',
  volume: 0.65,
  alarmRingDuration: 120,
  timerRingDuration: 120,
  history: [],
  notifyAsked: false
};

export function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;

    const stored = JSON.parse(raw);
    if (Array.isArray(stored.alarms)) {
      state.alarms = stored.alarms
        .filter((alarm) => alarm && typeof alarm.time === 'string')
        .map(normalizeAlarm);
    }

    if (typeof stored.sound === 'string' && SOUNDS[stored.sound]) {
      state.sound = stored.sound;
    }
    if (typeof stored.volume === 'number') state.volume = Math.min(1, Math.max(0, stored.volume));
    state.alarmRingDuration = normalizeDuration(stored.alarmRingDuration);
    state.timerRingDuration = normalizeDuration(stored.timerRingDuration);
    state.notifyAsked = Boolean(stored.notifyAsked);

    if (Array.isArray(stored.history)) {
      state.history = stored.history
        .filter((entry) => entry && typeof entry.sec === 'number' && typeof entry.endAt === 'number')
        .slice(0, 5);
    }
  } catch {
    // Corrupt or unavailable storage falls back to the default state.
  }
}

export function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      alarms: state.alarms,
      sound: isUploadedSound(state.sound) ? 'bell' : state.sound,
      volume: state.volume,
      alarmRingDuration: state.alarmRingDuration,
      timerRingDuration: state.timerRingDuration,
      history: state.history,
      notifyAsked: state.notifyAsked
    }));
  } catch {
    // Browsers can disable persistent storage without breaking the current session.
  }
}

export function findAlarm(id) {
  return state.alarms.find((alarm) => alarm.id === id);
}

export function createAlarm({ time, label = '', days, sound }) {
  const alarm = {
    id: createId(),
    time,
    label,
    days: [...days],
    sound: SOUNDS[sound] || isUploadedSound(sound) ? sound : 'bell',
    on: true
  };
  state.alarms.push(alarm);
  return alarm;
}

export function replaceAlarm(id, values) {
  const alarm = findAlarm(id);
  if (!alarm) return null;
  Object.assign(alarm, values);
  if (Array.isArray(values.days)) alarm.days = [...values.days];
  return alarm;
}

export function removeAlarm(id) {
  const alarm = findAlarm(id);
  state.alarms = state.alarms.filter((alarm) => alarm.id !== id);
  return alarm;
}

export function toggleAlarm(id) {
  const alarm = findAlarm(id);
  if (!alarm) return null;
  alarm.on = !alarm.on;
  return alarm;
}

export function setSound(soundId) {
  state.sound = soundId;
}

export function setVolume(nextVolume) {
  state.volume = Math.min(1, Math.max(0, nextVolume));
}

export function setRingDuration(kind, seconds) {
  const key = kind === 'timer' ? 'timerRingDuration' : 'alarmRingDuration';
  state[key] = normalizeDuration(seconds);
}

export function addHistory(seconds) {
  state.history.unshift({ sec: seconds, endAt: Date.now() });
  state.history = state.history.slice(0, 5);
}

export function removeHistory(index) {
  if (index < 0 || index >= state.history.length) return false;
  state.history.splice(index, 1);
  return true;
}

export function markNotificationAsked() {
  state.notifyAsked = true;
}

export function getSelectedAlarmSound() {
  return PICKABLE_SOUNDS.includes(state.sound) || isUploadedSound(state.sound)
    ? state.sound
    : 'bell';
}

export function nextEnabledAlarm(fromMs = Date.now()) {
  let nearest = null;

  state.alarms.forEach((alarm) => {
    if (!alarm.on) return;
    const date = nextOccurrence(alarm, fromMs);
    if (date && (!nearest || date.getTime() < nearest.date.getTime())) {
      nearest = { alarm, date };
    }
  });

  return nearest;
}

function normalizeAlarm(alarm) {
  return {
    id: alarm.id || createId(),
    time: alarm.time,
    label: alarm.label || '',
    days: Array.isArray(alarm.days) ? alarm.days : [],
    sound: SOUNDS[alarm.sound] || isUploadedSound(alarm.sound) ? alarm.sound : 'bell',
    on: Boolean(alarm.on)
  };
}

function normalizeDuration(seconds) {
  return Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 120;
}
