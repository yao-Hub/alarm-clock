import { createAlarmWatcher } from './core/alarm-watcher.js';
import { ensureAudioContext, setVolume as setAudioVolume } from './core/audio.js';
import { loadState, nextEnabledAlarm, saveState, state } from './core/store.js';
import { createAlarmDialog } from './components/alarm-dialog.js';
import { createAlarmList } from './components/alarm-list.js';
import { createClockPanel } from './components/clock-panel.js';
import { createCountdownView } from './components/countdown-view.js';
import { createRingOverlay } from './components/ring-overlay.js';
import { createSoundBar } from './components/sound-bar.js';
import { createTabs } from './components/tabs.js';

loadState();
setAudioVolume(state.volume);

const clockPanel = createClockPanel({
  getNextAlarm: nextEnabledAlarm
});
const ringOverlay = createRingOverlay();
const countdownView = createCountdownView({ ring: ringOverlay });
const tabs = createTabs();

const alarmDialog = createAlarmDialog({
  onSaved: () => refreshAlarms()
});
const alarmList = createAlarmList({
  onChange: () => refreshAlarms(),
  onEdit: (id) => alarmDialog.open(id)
});
const soundBar = createSoundBar({
  onSoundChanged: (name) => countdownView.setSoundName(name)
});

const alarmWatcher = createAlarmWatcher({
  alarms: () => state.alarms,
  onFire: (alarm) => {
    if (ringOverlay.isOpen()) return;

    if (!alarm.days.length) {
      alarm.on = false;
      saveState();
      refreshAlarms();
    }
    ringOverlay.start(alarm.sound || 'bell', {
      timeText: alarm.time,
      label: alarm.label || '闹钟',
      sound: alarm.sound || 'bell'
    });
  }
});

function refreshAlarms() {
  alarmList.render();
  clockPanel.renderNextAlarm();
}

function bindKeyboardShortcuts() {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (ringOverlay.isOpen()) {
        ringOverlay.stop();
        return;
      }
      if (alarmDialog.isOpen()) {
        alarmDialog.close();
        return;
      }
    }

    if (event.code !== 'Space') return;
    const tagName = event.target instanceof Element
      ? event.target.tagName.toLowerCase()
      : '';
    if (['input', 'button', 'select', 'textarea'].includes(tagName)) return;
    if (alarmDialog.isOpen() || tabs.getActive() !== 'timer') return;

    event.preventDefault();
    countdownView.toggle();
  });
}

alarmList.render();
soundBar.initialize();
countdownView.initialize();
tabs.select('alarm');
clockPanel.renderTime();
refreshAlarms();
bindKeyboardShortcuts();

document.addEventListener('pointerdown', function unlockAudio() {
  ensureAudioContext();
  document.removeEventListener('pointerdown', unlockAudio);
}, { once: true });

window.setInterval(() => {
  clockPanel.renderTime();
  alarmWatcher.check();
  clockPanel.renderNextAlarm();
}, 500);
