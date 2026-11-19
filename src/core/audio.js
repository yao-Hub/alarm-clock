let audioContext = null;
let volume = 0.65;
let uploadedAudios = [];
let previewAudio = null;
let previewNodes = [];
let previewCollector = null;
let previewEndTimer = null;

export const CUSTOM_SOUND = {
  name: '上传音频',
  hint: '上传 mp3 / wav 作为铃声'
};

export const SOUNDS = {
  bell: {
    name: '经典铜铃',
    hint: '两声铜铃，余韵绵长',
    period: 2.6,
    play() {
      const strike = (delay) => {
        tone(784, 1.35, 0.42, { type: 'triangle', delay });
        tone(1176, 1.05, 0.26, { type: 'sine', delay: delay + 0.004 });
        tone(392, 1.5, 0.2, { type: 'sine', delay });
        tone(2350, 0.26, 0.1, { type: 'sine', delay: delay + 0.002 });
      };
      strike(0);
      strike(0.3);
    }
  },
  beep: {
    name: '电子滴答',
    hint: '短促三连哔声',
    period: 1.7,
    play() {
      [0, 0.22, 0.44].forEach((delay) => {
        tone(1046, 0.13, 0.45, { type: 'square', delay, attack: 0.006 });
      });
    }
  },
  chime: {
    name: '西敏报时',
    hint: '四音钟楼旋律',
    period: 3.4,
    play() {
      const notes = [
        [659.25, 0.62],
        [587.33, 0.62],
        [523.25, 0.62],
        [440, 1.2]
      ];
      let delay = 0;

      notes.forEach(([frequency, duration]) => {
        tone(frequency, duration * 1.6, 0.34, { type: 'sine', delay });
        tone(frequency * 2, duration * 0.7, 0.1, { type: 'sine', delay: delay + 0.01 });
        delay += duration * 0.62;
      });
    }
  },
  marimba: {
    name: '木琴晨曲',
    hint: '清亮四音上行',
    period: 2.4,
    play() {
      [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
        tone(frequency, 0.45, 0.36, {
          type: 'triangle',
          delay: index * 0.16,
          attack: 0.008
        });
        tone(frequency * 2, 0.2, 0.08, {
          type: 'triangle',
          delay: index * 0.16 + 0.01
        });
      });
    }
  },
  bird: {
    name: '林间鸟鸣',
    hint: '细碎啾啾，轻而不吵',
    period: 2.2,
    play() {
      const sequence = [
        [0, 2100, 3300],
        [0.1, 2450, 3700],
        [0.19, 1950, 2900],
        [0.35, 2600, 3900],
        [0.46, 2250, 3150],
        [0.62, 1800, 2700]
      ];

      sequence.forEach(([delay, frequency, target]) => {
        tone(frequency, 0.1, 0.2, { delay, to: target, attack: 0.02 });
        tone(frequency * 1.45, 0.06, 0.08, {
          delay: delay + 0.03,
          to: target * 1.1,
          attack: 0.02
        });
      });
    }
  }
};

export const PICKABLE_SOUNDS = ['bell', 'beep', 'chime', 'marimba', 'bird'];

export function ensureAudioContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;

  if (!audioContext) audioContext = new AudioContext();
  if (audioContext.state === 'suspended') audioContext.resume();
  return audioContext;
}

export function setVolume(nextVolume) {
  volume = Math.min(1, Math.max(0, nextVolume));
}

export function tone(frequency, duration, level, options = {}) {
  const context = ensureAudioContext();
  if (!context) return;

  const startAt = context.currentTime + (options.delay || 0);
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = options.type || 'sine';
  oscillator.frequency.setValueAtTime(frequency, startAt);
  if (options.to) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, options.to), startAt + duration);
  }

  const peak = Math.min(1, Math.max(0.0003, level * volume * 0.95));
  gain.gain.setValueAtTime(0.0004, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + (options.attack || 0.012));
  gain.gain.exponentialRampToValueAtTime(0.0004, startAt + duration);

  oscillator.connect(gain);
  gain.connect(context.destination);
  previewCollector?.push({ oscillator, gain });
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.03);
}

export function playSound(soundId) {
  SOUNDS[soundId]?.play();
}

export function playCustomAudio(soundId, { loop = false } = {}) {
  const track = getCustomAudio(soundId);
  if (!track.url) return null;
  const audio = new Audio(track.url);
  audio.loop = loop;
  audio.volume = volume;
  const playback = audio.play();
  if (playback?.catch) playback.catch(() => {});
  return audio;
}

export function previewSound(soundId, onEnded) {
  stopPreviewSound();
  ensureAudioContext();

  if (isUploadedSound(soundId)) {
    previewAudio = playCustomAudio(soundId);
    if (!previewAudio) return false;
    previewAudio.addEventListener('ended', () => {
      stopPreviewSound();
      onEnded?.();
    }, { once: true });
    return true;
  }

  if (!SOUNDS[soundId]) return false;
  previewNodes = [];
  previewCollector = previewNodes;
  SOUNDS[soundId].play();
  previewCollector = null;
  previewEndTimer = window.setTimeout(() => {
    stopPreviewSound();
    onEnded?.();
  }, SOUNDS[soundId].period * 1000);
  return true;
}

export function stopPreviewSound() {
  if (previewAudio) {
    try {
      previewAudio.pause();
    } catch {
      // The browser may already have released the media element.
    }
    previewAudio = null;
  }

  previewNodes.forEach(({ oscillator, gain }) => {
    try {
      oscillator.stop();
    } catch {
      // Oscillators that already finished cannot be stopped again.
    }
    gain.disconnect();
  });
  previewNodes = [];
  previewCollector = null;
  clearTimeout(previewEndTimer);
  previewEndTimer = null;
}

export function addCustomAudio(file) {
  const id = `upload:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const track = {
    id,
    name: file.name.replace(/\.[^.]+$/, ''),
    url: URL.createObjectURL(file)
  };
  uploadedAudios.push(track);
  return track;
}

export function getUploadedAudios() {
  return [...uploadedAudios];
}

export function removeCustomAudio(soundId) {
  const track = uploadedAudios.find((item) => item.id === soundId);
  if (!track) return false;
  URL.revokeObjectURL(track.url);
  uploadedAudios = uploadedAudios.filter((item) => item.id !== soundId);
  return true;
}

export function getCustomAudio(soundId) {
  return uploadedAudios.find((track) => track.id === soundId) || { url: '', name: '' };
}

export function isUploadedSound(soundId) {
  return typeof soundId === 'string' && soundId.startsWith('upload:');
}

export function getSoundName(soundId) {
  if (isUploadedSound(soundId)) return getCustomAudio(soundId).name || CUSTOM_SOUND.name;
  return SOUNDS[soundId]?.name || SOUNDS.bell.name;
}
