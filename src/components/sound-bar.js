import {
  CUSTOM_SOUND,
  PICKABLE_SOUNDS,
  SOUNDS,
  getCustomAudio,
  previewSound,
  setCustomAudio,
  setVolume as setAudioVolume,
  tone
} from '../core/audio.js';
import { saveState, setSound, setVolume as setStateVolume, state } from '../core/store.js';
import { escapeHtml, qs } from '../utils/dom.js';
import { showToast } from './toast.js';

export function createSoundBar({ onSoundChanged }) {
  const chips = qs('#soundChips');
  const volumeInput = qs('#volume');

  chips.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip) return;

    if (chip.dataset.sound === 'custom') {
      chooseCustomAudio();
      return;
    }

    setSound(chip.dataset.sound);
    saveState();
    render();
    previewSound(state.sound);
    onSoundChanged(SOUNDS[state.sound].name);
  });

  qs('#previewBtn').addEventListener('click', () => {
    const played = previewSound(state.sound);
    if (!played) showToast('请先选择一段本机音频');
  });

  volumeInput.addEventListener('input', () => {
    setStateVolume(Number(volumeInput.value) / 100);
    setAudioVolume(state.volume);
    saveState();
  });

  volumeInput.addEventListener('change', () => {
    tone(880, 0.22, 0.35, { type: 'triangle' });
  });

  function chooseCustomAudio() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 30 * 1024 * 1024) {
        showToast('音频不能超过 30MB');
        return;
      }

      const name = setCustomAudio(file);
      setSound('custom');
      saveState();
      render();
      previewSound('custom');
      onSoundChanged(CUSTOM_SOUND.name);
      showToast(`已选择本机音频：${name}`);
    });
    input.click();
  }

  function render() {
    const custom = getCustomAudio();
    const builtInChips = PICKABLE_SOUNDS.map((soundId) => (
      `<button class="chip" data-sound="${soundId}" aria-pressed="${state.sound === soundId}" ` +
        `title="${SOUNDS[soundId].hint}">${SOUNDS[soundId].name}</button>`
    ));
    const customName = custom.name ? escapeHtml(custom.name.slice(0, 12)) : CUSTOM_SOUND.name;
    builtInChips.push(
      `<button class="chip" data-sound="custom" aria-pressed="${state.sound === 'custom'}">` +
        `${customName}</button>`
    );
    chips.innerHTML = builtInChips.join('');
  }

  function initialize() {
    setAudioVolume(state.volume);
    volumeInput.value = Math.round(state.volume * 100);
    render();
  }

  return {
    initialize
  };
}
