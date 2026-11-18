import { PICKABLE_SOUNDS, SOUNDS, playSound } from '../core/audio.js';
import {
  createAlarm,
  findAlarm,
  getSelectedAlarmSound,
  markNotificationAsked,
  replaceAlarm,
  saveState,
  state
} from '../core/store.js';
import { qs, qsa } from '../utils/dom.js';
import { DAY_NAMES, pad } from '../utils/time.js';
import { showToast } from './toast.js';

export function createAlarmDialog({ onSaved }) {
  const scrim = qs('#alarmScrim');
  let draft = { id: null, days: [1, 2, 3, 4, 5], sound: 'bell' };

  buildDayChips();
  buildSoundPicker();
  bindEvents();

  function buildDayChips() {
    qs('#dlgDays').innerHTML = [1, 2, 3, 4, 5, 6, 0]
      .map((day) => (
        `<button class="day" data-day="${day}" aria-pressed="false">${DAY_NAMES[day]}</button>`
      ))
      .join('');
  }

  function buildSoundPicker() {
    qs('#dlgSounds').innerHTML = PICKABLE_SOUNDS
      .map((soundId) => (
        `<button class="snd" data-sound="${soundId}" aria-pressed="false">` +
          `<strong>${SOUNDS[soundId].name}</strong><span>${SOUNDS[soundId].hint}</span>` +
        '</button>'
      ))
      .join('');
  }

  function syncDraftUi() {
    qsa('#dlgDays .day').forEach((button) => {
      button.setAttribute(
        'aria-pressed',
        String(draft.days.includes(Number(button.dataset.day)))
      );
    });
    qsa('#dlgSounds .snd').forEach((button) => {
      button.setAttribute('aria-pressed', String(draft.sound === button.dataset.sound));
    });
    qs('#dlgTitle').textContent = draft.id ? '编辑闹钟' : '新建闹钟';
  }

  function open(id = null) {
    const alarm = id ? findAlarm(id) : null;

    if (alarm) {
      draft = { id: alarm.id, days: [...alarm.days], sound: alarm.sound };
      qs('#dlgTime').value = alarm.time;
      qs('#dlgLabel').value = alarm.label;
    } else {
      const suggested = new Date(Date.now() + 10 * 60000);
      draft = {
        id: null,
        days: [1, 2, 3, 4, 5],
        sound: getSelectedAlarmSound()
      };
      qs('#dlgTime').value = `${pad(suggested.getHours())}:${pad(suggested.getMinutes())}`;
      qs('#dlgLabel').value = '';
    }

    syncDraftUi();
    scrim.classList.add('is-open');
    window.setTimeout(() => qs('#dlgTime').focus(), 60);
  }

  function close() {
    scrim.classList.remove('is-open');
  }

  function save() {
    const time = qs('#dlgTime').value;
    if (!/^\d{2}:\d{2}$/.test(time)) {
      showToast('请选择有效的时间');
      return;
    }

    const alarmValues = {
      time,
      label: qs('#dlgLabel').value.trim().slice(0, 18),
      days: [...draft.days],
      sound: draft.sound
    };
    const editing = Boolean(draft.id);

    if (editing) {
      replaceAlarm(draft.id, { ...alarmValues, on: true });
    } else {
      createAlarm(alarmValues);
    }

    saveState();
    close();
    onSaved();
    showToast(editing ? '闹钟已更新' : `闹钟已创建 · ${time}`);
    maybeAskNotificationPermission();
  }

  function maybeAskNotificationPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'default') return;
    if (state.notifyAsked) return;

    markNotificationAsked();
    saveState();
    try {
      const request = Notification.requestPermission();
      if (request?.then) request.then(() => {}, () => {});
    } catch {
      // Embedded browsers can expose Notification while rejecting the permission request.
    }
  }

  function bindEvents() {
    qs('#addAlarmBtn').addEventListener('click', () => open());
    qs('#dlgClose').addEventListener('click', close);
    qs('#dlgCancel').addEventListener('click', close);
    qs('#dlgSave').addEventListener('click', save);
    scrim.addEventListener('click', (event) => {
      if (event.target === scrim) close();
    });

    qs('#dlgDays').addEventListener('click', (event) => {
      const button = event.target.closest('.day');
      if (!button) return;

      const day = Number(button.dataset.day);
      const index = draft.days.indexOf(day);
      if (index >= 0) draft.days.splice(index, 1);
      else draft.days.push(day);
      syncDraftUi();
    });

    qsa('.quick-days button').forEach((button) => {
      button.addEventListener('click', () => {
        draft.days = {
          weekday: [1, 2, 3, 4, 5],
          all: [0, 1, 2, 3, 4, 5, 6],
          weekend: [0, 6],
          once: []
        }[button.dataset.days];
        syncDraftUi();
      });
    });

    qs('#dlgSounds').addEventListener('click', (event) => {
      const button = event.target.closest('.snd');
      if (!button) return;
      draft.sound = button.dataset.sound;
      syncDraftUi();
      playSound(draft.sound);
    });
  }

  return {
    open,
    close,
    isOpen: () => scrim.classList.contains('is-open')
  };
}
