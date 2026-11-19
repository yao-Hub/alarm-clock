import {
  PICKABLE_SOUNDS,
  SOUNDS,
  getCustomAudio,
  getUploadedAudios,
  previewSound,
  stopPreviewSound
} from '../core/audio.js';
import {
  createAlarm,
  findAlarm,
  getSelectedAlarmSound,
  markNotificationAsked,
  replaceAlarm,
  saveState,
  state
} from '../core/store.js';
import { requestNotificationPermission } from '../core/notifications.js';
import { escapeHtml, qs, qsa } from '../utils/dom.js';
import { DAY_NAMES, pad } from '../utils/time.js';
import { showToast } from './toast.js';

export function createAlarmDialog({ onSaved }) {
  const scrim = qs('#alarmScrim');
  let draft = { id: null, days: [1, 2, 3, 4, 5], sound: 'bell' };
  let selectedTime = '07:30';
  let pickerTime = '07:30';
  let timePickerOpen = false;
  let previewingSoundId = null;

  buildDayChips();
  buildTimePicker();
  bindEvents();

  function buildDayChips() {
    qs('#dlgDays').innerHTML = [1, 2, 3, 4, 5, 6, 0]
      .map((day) => (
        `<button class="day" data-day="${day}" aria-pressed="false">${DAY_NAMES[day]}</button>`
      ))
      .join('');
  }

  function buildSoundPicker() {
    const soundIds = [
      ...PICKABLE_SOUNDS,
      ...getUploadedAudios().map((track) => track.id)
    ];

    qs('#dlgSounds').innerHTML = soundIds
      .map((soundId) => {
        const sound = SOUNDS[soundId] || {
          name: getCustomAudio(soundId).name,
          hint: '已上传的音频'
        };
        return (
          `<button class="snd" data-sound="${soundId}" aria-pressed="false">` +
            `<strong>${escapeHtml(sound.name)}</strong><span>${escapeHtml(sound.hint)}</span>` +
          '</button>'
        );
      })
      .join('');
  }

  function buildTimePicker() {
    qs('#timeHourWheel').innerHTML = Array.from({ length: 24 }, (_, hour) => (
      `<div class="time-option" role="option" data-unit="hour" data-value="${pad(hour)}" aria-selected="false">${pad(hour)}</div>`
    )).join('');
    qs('#timeMinuteWheel').innerHTML = Array.from({ length: 60 }, (_, minute) => (
      `<div class="time-option" role="option" data-unit="minute" data-value="${pad(minute)}" aria-selected="false">${pad(minute)}</div>`
    )).join('');
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
      button.setAttribute(
        'data-previewing',
        String(previewingSoundId === button.dataset.sound)
      );
    });
    qs('#dlgTitle').textContent = draft.id ? '编辑闹钟' : '新建闹钟';
  }

  function open(id = null) {
    stopPreview();
    const alarm = id ? findAlarm(id) : null;

    if (alarm) {
      draft = { id: alarm.id, days: [...alarm.days], sound: alarm.sound };
      if (!setTime(alarm.time)) setTime('07:30');
      qs('#dlgLabel').value = alarm.label;
    } else {
      const suggested = new Date(Date.now() + 10 * 60000);
      draft = {
        id: null,
        days: [1, 2, 3, 4, 5],
        sound: getSelectedAlarmSound()
      };
      setTime(`${pad(suggested.getHours())}:${pad(suggested.getMinutes())}`);
      qs('#dlgLabel').value = '';
    }

    buildSoundPicker();
    closeTimePicker();
    syncDraftUi();
    scrim.classList.add('is-open');
    window.setTimeout(() => qs('#dlgTimeInput').focus(), 60);
  }

  function close() {
    stopPreview();
    closeTimePicker();
    scrim.classList.remove('is-open');
  }

  function save() {
    if (!setTime(qs('#dlgTimeInput').value)) {
      showToast('请选择有效的时间');
      return;
    }

    const alarmValues = {
      time: selectedTime,
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
    showToast(editing ? '闹钟已更新' : `闹钟已创建 · ${selectedTime}`);
    maybeAskNotificationPermission();
  }

  function setTime(value) {
    const normalized = parseTime(value);
    if (!normalized) return false;

    selectedTime = normalized;
    qs('#dlgTimeInput').value = selectedTime;
    syncTimeSelection();
    return true;
  }

  function parseTime(value) {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return null;

    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) return null;
    return `${pad(hour)}:${pad(minute)}`;
  }

  function syncTimeSelection() {
    const [hour, minute] = (timePickerOpen ? pickerTime : selectedTime).split(':');
    qsa('.time-option').forEach((option) => {
      const selected = option.dataset.value === (
        option.dataset.unit === 'hour' ? hour : minute
      );
      option.setAttribute('aria-selected', String(selected));
    });
  }

  function toggleTimePicker() {
    if (timePickerOpen) {
      closeTimePicker();
      return;
    }

    timePickerOpen = true;
    pickerTime = selectedTime;
    syncTimeSelection();
    qs('#timePicker').hidden = false;
    qs('#dlgTimePickerBtn').setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => {
      centerSelectedTime(qs('#timeHourWheel'));
      centerSelectedTime(qs('#timeMinuteWheel'));
    });
  }

  function closeTimePicker() {
    timePickerOpen = false;
    qs('#timePicker').hidden = true;
    qs('#dlgTimePickerBtn').setAttribute('aria-expanded', 'false');
  }

  function centerSelectedTime(wheel) {
    const selected = wheel.querySelector('[aria-selected="true"]');
    if (!selected) return;
    wheel.scrollTop = selected.offsetTop - (wheel.clientHeight - selected.offsetHeight) / 2;
  }

  function selectTimeOption(option) {
    const [hour, minute] = pickerTime.split(':');
    pickerTime = option.dataset.unit === 'hour'
      ? `${option.dataset.value}:${minute}`
      : `${hour}:${option.dataset.value}`;
    syncTimeSelection();
  }

  function bindTimeWheel(wheel) {
    let scrollFrame = 0;
    let scrollEndTimer = 0;
    let pointerState = null;
    let suppressClick = false;

    function closestOption() {
      const center = wheel.scrollTop + wheel.clientHeight / 2;
      return qsa('.time-option', wheel).reduce((best, option) => {
        const distance = Math.abs(option.offsetTop + option.offsetHeight / 2 - center);
        return !best || distance < best.distance ? { option, distance } : best;
      }, null)?.option;
    }

    function snapToNearestOption() {
      const option = closestOption();
      if (!option) return;
      selectTimeOption(option);
      centerSelectedTime(wheel);
    }

    wheel.addEventListener('click', (event) => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      const option = event.target.closest('.time-option');
      if (!option) return;
      selectTimeOption(option);
      centerSelectedTime(wheel);
    });

    wheel.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      clearTimeout(scrollEndTimer);
      pointerState = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startScrollTop: wheel.scrollTop,
        moved: false
      };
      wheel.setPointerCapture(event.pointerId);
      wheel.classList.add('is-dragging');
    });

    wheel.addEventListener('pointermove', (event) => {
      if (!pointerState || pointerState.pointerId !== event.pointerId) return;
      const distance = event.clientY - pointerState.startY;
      if (Math.abs(distance) > 3) pointerState.moved = true;
      wheel.scrollTop = pointerState.startScrollTop - distance;
      event.preventDefault();
    });

    function finishPointerDrag(event) {
      if (!pointerState || pointerState.pointerId !== event.pointerId) return;
      const moved = pointerState.moved;
      pointerState = null;
      wheel.classList.remove('is-dragging');
      if (wheel.hasPointerCapture(event.pointerId)) {
        wheel.releasePointerCapture(event.pointerId);
      }
      snapToNearestOption();
      if (moved) {
        suppressClick = true;
        window.setTimeout(() => {
          suppressClick = false;
        }, 0);
      }
    }

    wheel.addEventListener('pointerup', finishPointerDrag);
    wheel.addEventListener('pointercancel', finishPointerDrag);

    wheel.addEventListener('scroll', () => {
      if (!timePickerOpen) return;
      cancelAnimationFrame(scrollFrame);
      scrollFrame = requestAnimationFrame(() => {
        const option = closestOption();
        if (option) selectTimeOption(option);
      });
      clearTimeout(scrollEndTimer);
      if (!pointerState) {
        scrollEndTimer = window.setTimeout(snapToNearestOption, 90);
      }
    }, { passive: true });

    wheel.addEventListener('keydown', (event) => {
      if (!['ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) {
        return;
      }
      event.preventDefault();

      const options = qsa('.time-option', wheel);
      const currentIndex = options.findIndex((option) => option.getAttribute('aria-selected') === 'true');
      const step = event.key === 'PageUp' || event.key === 'PageDown' ? 5 : 1;
      let nextIndex = currentIndex;
      if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = options.length - 1;
      else if (event.key === 'ArrowUp' || event.key === 'PageUp') nextIndex -= step;
      else nextIndex += step;

      nextIndex = Math.max(0, Math.min(options.length - 1, nextIndex));
      selectTimeOption(options[nextIndex]);
      centerSelectedTime(wheel);
    });
  }

  function maybeAskNotificationPermission() {
    if (state.notifyAsked) return;

    markNotificationAsked();
    saveState();
    void requestNotificationPermission();
  }

  function bindEvents() {
    qs('#addAlarmBtn').addEventListener('click', () => open());
    qs('#dlgClose').addEventListener('click', close);
    qs('#dlgCancel').addEventListener('click', close);
    qs('#dlgSave').addEventListener('click', save);
    qs('#dlgTimePickerBtn').addEventListener('click', toggleTimePicker);
    qs('#dlgTimeInput').addEventListener('click', () => {
      if (!timePickerOpen) toggleTimePicker();
    });
    qs('#dlgTimeInput').addEventListener('input', () => {
      const normalized = parseTime(qs('#dlgTimeInput').value);
      if (!normalized) return;
      selectedTime = normalized;
      if (timePickerOpen) pickerTime = normalized;
      syncTimeSelection();
    });
    qs('#timePickerConfirm').addEventListener('click', () => {
      setTime(pickerTime);
      closeTimePicker();
      qs('#dlgTimeInput').focus();
    });
    bindTimeWheel(qs('#timeHourWheel'));
    bindTimeWheel(qs('#timeMinuteWheel'));
    document.addEventListener('pointerdown', (event) => {
      if (timePickerOpen && !qs('.time-field-wrap').contains(event.target)) {
        closeTimePicker();
      }
    });
    scrim.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && timePickerOpen) {
        event.stopPropagation();
        closeTimePicker();
        qs('#dlgTimeInput').focus();
      }
    });
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

      if (previewingSoundId === button.dataset.sound) {
        stopPreview();
        syncDraftUi();
        return;
      }

      draft.sound = button.dataset.sound;
      syncDraftUi();
      previewingSoundId = draft.sound;
      syncDraftUi();
      if (!previewSound(draft.sound, () => {
        if (previewingSoundId === draft.sound) {
          previewingSoundId = null;
          syncDraftUi();
        }
      })) {
        previewingSoundId = null;
        syncDraftUi();
        showToast('该提示音当前无法播放');
      }
    });
  }

  function stopPreview() {
    stopPreviewSound();
    previewingSoundId = null;
  }

  return {
    open,
    close,
    isOpen: () => scrim.classList.contains('is-open')
  };
}
