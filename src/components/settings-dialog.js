import {
  PICKABLE_SOUNDS,
  SOUNDS,
  addCustomAudio,
  getSoundName,
  getUploadedAudios,
  isUploadedSound,
  previewSound,
  removeCustomAudio,
  setVolume as setAudioVolume,
  stopPreviewSound,
  tone
} from '../core/audio.js';
import {
  saveState,
  setRingDuration,
  setSound,
  setVolume as setStateVolume,
  state
} from '../core/store.js';
import { escapeHtml, qs, qsa } from '../utils/dom.js';
import { formatTimerLength } from '../utils/time.js';
import { showToast } from './toast.js';

export function createSettingsDialog({ onSoundChanged }) {
  const scrim = qs('#settingsScrim');
  const volumeInput = qs('#settingsVolume');
  const grid = qs('#settingsSoundGrid');
  let previewingSoundId = null;

  bindEvents();

  function bindEvents() {
    qs('#settingsOpen').addEventListener('click', open);
    qs('#settingsClose').addEventListener('click', close);
    qs('#settingsCloseButton').addEventListener('click', close);
    scrim.addEventListener('click', (event) => {
      if (event.target === scrim) close();
    });

    grid.addEventListener('click', (event) => {
      const removeButton = event.target.closest('.settings-sound-remove');
      if (removeButton) {
        removeUploadedSound(removeButton.dataset.removeSound);
        return;
      }
      const button = event.target.closest('.settings-sound');
      if (!button) return;
      togglePreview(button.dataset.sound);
    });

    qs('#settingsUploadBtn').addEventListener('click', chooseCustomAudio);

    volumeInput.addEventListener('input', () => {
      setStateVolume(Number(volumeInput.value) / 100);
      setAudioVolume(state.volume);
      saveState();
    });
    volumeInput.addEventListener('change', () => {
      tone(880, 0.22, 0.35, { type: 'triangle' });
    });

    qsa('.duration-inputs').forEach((group) => {
      qsa('input', group).forEach((input) => {
        input.addEventListener('input', () => {
          const kind = group.dataset.duration;
          setRingDuration(kind, readDuration(kind));
          saveState();
          renderDurationPreview(kind);
        });
      });
    });
  }

  function open() {
    stopPreview();
    renderSounds();
    renderDurations();
    scrim.classList.add('is-open');
    qs('#settingsOpen').setAttribute('aria-expanded', 'true');
  }

  function close() {
    stopPreview();
    scrim.classList.remove('is-open');
    qs('#settingsOpen').setAttribute('aria-expanded', 'false');
  }

  function initialize() {
    setAudioVolume(state.volume);
    volumeInput.value = Math.round(state.volume * 100);
    renderSounds();
    renderDurations();
  }

  function selectSound(soundId) {
    setSound(soundId);
    saveState();
    renderSounds();
    onSoundChanged(getSoundName(soundId));
  }

  function chooseCustomAudio() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.multiple = true;
    input.addEventListener('change', () => {
      const tracks = [];
      [...(input.files || [])].forEach((file) => {
        if (file.size > 30 * 1024 * 1024) {
          showToast(`${file.name} 超过 30MB，已跳过`);
          return;
        }
        tracks.push(addCustomAudio(file));
      });
      if (!tracks.length) return;

      const latest = tracks[tracks.length - 1];
      selectSound(latest.id);
      startPreview(latest.id);
      showToast(`已上传 ${tracks.length} 个音频`);
    });
    input.click();
  }

  function togglePreview(soundId) {
    if (previewingSoundId === soundId) {
      stopPreview();
      renderSounds();
      return;
    }

    selectSound(soundId);
    startPreview(soundId);
  }

  function startPreview(soundId) {
    previewingSoundId = soundId;
    renderSounds();
    const started = previewSound(soundId, () => {
      if (previewingSoundId === soundId) {
        previewingSoundId = null;
        renderSounds();
      }
    });
    if (!started) {
      previewingSoundId = null;
      renderSounds();
      showToast('该提示音当前无法播放');
    }
  }

  function stopPreview() {
    stopPreviewSound();
    previewingSoundId = null;
  }

  function renderSounds() {
    const options = PICKABLE_SOUNDS.map((soundId) => ({
      id: soundId,
      name: SOUNDS[soundId].name
    }));
    getUploadedAudios().forEach((track) => {
      options.push({ id: track.id, name: track.name });
    });

    grid.innerHTML = options.map(({ id, name }) => {
      const button = (
        `<button class="settings-sound" type="button" data-sound="${id}" ` +
          `aria-pressed="${state.sound === id}" data-previewing="${previewingSoundId === id}">` +
          `${escapeHtml(name)}</button>`
      );
      if (!isUploadedSound(id)) return button;
      return (
        '<div class="settings-sound-item">' +
          button +
          `<button class="settings-sound-remove" type="button" data-remove-sound="${id}" ` +
            `aria-label="删除上传音频 ${escapeHtml(name)}">×</button>` +
        '</div>'
      );
    }).join('');
  }

  function removeUploadedSound(soundId) {
    if (!removeCustomAudio(soundId)) return;
    if (previewingSoundId === soundId) stopPreview();

    state.alarms.forEach((alarm) => {
      if (alarm.sound === soundId) alarm.sound = 'bell';
    });
    if (state.sound === soundId) setSound('bell');
    saveState();
    renderSounds();
    onSoundChanged(getSoundName(state.sound));
    showToast('已删除上传音频');
  }

  function renderDurations() {
    renderDuration('alarm');
    renderDuration('timer');
  }

  function renderDuration(kind) {
    const duration = kind === 'timer' ? state.timerRingDuration : state.alarmRingDuration;
    const prefix = kind === 'timer' ? 'timerRing' : 'alarmRing';
    qs(`#${prefix}H`).value = Math.floor(duration / 3600);
    qs(`#${prefix}M`).value = Math.floor((duration % 3600) / 60);
    qs(`#${prefix}S`).value = duration % 60;
    renderDurationPreview(kind);
  }

  function readDuration(kind) {
    const prefix = kind === 'timer' ? 'timerRing' : 'alarmRing';
    const hours = Math.max(0, Number.parseInt(qs(`#${prefix}H`).value, 10) || 0);
    const minutes = Math.max(0, Number.parseInt(qs(`#${prefix}M`).value, 10) || 0);
    const seconds = Math.max(0, Number.parseInt(qs(`#${prefix}S`).value, 10) || 0);
    return hours * 3600 + minutes * 60 + seconds;
  }

  function renderDurationPreview(kind) {
    const duration = kind === 'timer' ? state.timerRingDuration : state.alarmRingDuration;
    qs(kind === 'timer' ? '#timerRingPreview' : '#alarmRingPreview').textContent =
      duration > 0 ? formatTimerLength(duration) : '不自动停止';
  }

  return {
    initialize,
    open,
    close,
    isOpen: () => scrim.classList.contains('is-open')
  };
}
