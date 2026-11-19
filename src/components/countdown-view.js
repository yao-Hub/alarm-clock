import { ensureAudioContext } from '../core/audio.js';
import { addHistory, removeHistory, saveState, state } from '../core/store.js';
import { qs, qsa } from '../utils/dom.js';
import { formatClockTime, formatCountdown, formatTimerLength, pad } from '../utils/time.js';
import { renderTimerLabels, rotateElement } from './dial.js';
import { showToast } from './toast.js';

const ARC_LENGTH = 2 * Math.PI * 150;
const DEFAULT_SECONDS = 25 * 60;
const DEFAULT_HINT = '结束时将使用设置中的默认提示音提醒。';

export function createCountdownView({ ring }) {
  const countdown = {
    total: DEFAULT_SECONDS,
    remaining: DEFAULT_SECONDS,
    running: false,
    target: 0,
    done: false,
    interval: null
  };

  bindControls();

  function readInputs() {
    const hours = Math.min(99, Math.max(0, Number.parseInt(qs('#inH').value, 10) || 0));
    const minutes = Math.min(59, Math.max(0, Number.parseInt(qs('#inM').value, 10) || 0));
    const seconds = Math.min(59, Math.max(0, Number.parseInt(qs('#inS').value, 10) || 0));
    return hours * 3600 + minutes * 60 + seconds;
  }

  function writeInputs(total) {
    qs('#inH').value = Math.floor(total / 3600);
    qs('#inM').value = Math.floor((total % 3600) / 60);
    qs('#inS').value = total % 60;
  }

  function setStatus(text, mode = '') {
    qs('#cdStateText').textContent = text;
    const status = qs('#cdState');
    status.classList.toggle('is-running', mode === 'running');
    status.classList.toggle('is-done', mode === 'done');
  }

  function render() {
    const total = countdown.total || readInputs();
    qs('#cdTime').textContent = formatCountdown(countdown.remaining);
    renderTimerLabels(total);

    const ratio = total > 0
      ? Math.min(1, Math.max(0, countdown.remaining / total))
      : 0;
    qs('#progressArc').setAttribute(
      'stroke-dashoffset',
      (ARC_LENGTH * (1 - ratio)).toFixed(2)
    );
    const degrees = total > 0 ? (1 - ratio) * 360 : 0;
    rotateElement(qs('#timerHand'), degrees);
    rotateElement(qs('#timerHandShadow'), degrees);
  }

  function renderHistory() {
    const list = qs('#cdHistory');
    if (!state.history.length) {
      list.innerHTML = '<li class="hist-empty">还没有完成的计时</li>';
      return;
    }

    list.innerHTML = state.history.map((entry, index) => {
      const endedAt = new Date(entry.endAt);
      return (
        `<li class="hist-item"><div class="hist-row" data-history-index="${index}">` +
          '<div class="hist-content" role="button" tabindex="0" ' +
          `aria-label="载入 ${formatCountdown(entry.sec)} 的计时">` +
          `<strong>${formatCountdown(entry.sec)}</strong>` +
          `<span class="hist-ended">${endedAt.getMonth() + 1}月${endedAt.getDate()}日 ` +
            `${pad(endedAt.getHours())}:${pad(endedAt.getMinutes())} 结束</span>` +
          '</div>' +
          '<div class="hist-delete" role="button" tabindex="0" ' +
            `aria-label="删除 ${formatCountdown(entry.sec)} 的计时记录">删除</div>` +
        '</div></li>'
      );
    }).join('');
  }

  function tick() {
    if (!countdown.running) return;
    const remainingMs = countdown.target - Date.now();
    countdown.remaining = Math.max(0, remainingMs / 1000);
    render();
    if (remainingMs > 0) return;

    countdown.running = false;
    countdown.done = true;
    countdown.remaining = 0;
    clearInterval(countdown.interval);
    countdown.interval = null;
    render();
    setStatus('已结束 · 提示音播放中', 'done');
    qs('#cdHint').textContent = '时间到。按「重置」可再次设定。';

    addHistory(countdown.total);
    saveState();
    renderHistory();
    ring.start(state.sound, {
      timeText: formatTimerLength(countdown.total),
      label: '计时完成',
      sound: state.sound,
      kind: 'timer',
      onRepeat: restart
    });
  }

  function start() {
    if (countdown.running) return;
    ensureAudioContext();

    const resuming = !countdown.done && countdown.remaining > 0.5 && countdown.total > 0;
    if (!resuming) {
      countdown.total = readInputs();
      countdown.remaining = countdown.total;
    }
    if (countdown.total <= 0) {
      showToast('请先设置大于 0 的时长');
      return;
    }
    if (countdown.remaining <= 0) countdown.remaining = countdown.total;

    countdown.done = false;
    countdown.target = Date.now() + countdown.remaining * 1000;
    countdown.running = true;
    clearInterval(countdown.interval);
    countdown.interval = window.setInterval(tick, 120);
    setStatus(`计时中 · 预计 ${formatClockTime(countdown.target)} 结束`, 'running');
    qs('#cdHint').textContent = DEFAULT_HINT;
    render();
  }

  function pause() {
    if (!countdown.running) return;
    countdown.remaining = Math.max(0, (countdown.target - Date.now()) / 1000);
    countdown.running = false;
    clearInterval(countdown.interval);
    countdown.interval = null;
    render();
    setStatus(`已暂停 · 剩余 ${formatCountdown(countdown.remaining)}`);
  }

  function reset() {
    countdown.running = false;
    clearInterval(countdown.interval);
    countdown.interval = null;
    countdown.done = false;
    countdown.total = readInputs();
    countdown.remaining = countdown.total;
    countdown.target = 0;
    render();
    setStatus(countdown.total > 0 ? '待命 · 点击开始' : '待命 · 设置时长后开始');
    qs('#cdHint').textContent = DEFAULT_HINT;
  }

  function applyPreset(seconds) {
    countdown.running = false;
    clearInterval(countdown.interval);
    countdown.interval = null;
    countdown.done = false;
    countdown.total = seconds;
    countdown.remaining = seconds;
    writeInputs(seconds);
    render();
    setStatus('待命 · 点击开始');
    qs('#cdHint').textContent = DEFAULT_HINT;
  }

  function restart() {
    const seconds = countdown.total;
    applyPreset(seconds);
    start();
  }

  function syncFromInputs() {
    if (countdown.running) return;
    countdown.total = readInputs();
    countdown.remaining = countdown.total;
    countdown.done = false;
    render();
    setStatus(countdown.total > 0 ? '待命 · 点击开始' : '待命 · 设置时长后开始');
  }

  function bindControls() {
    qs('#cdStart').addEventListener('click', start);
    qs('#cdPause').addEventListener('click', pause);
    qs('#cdReset').addEventListener('click', reset);
    qsa('.preset').forEach((button) => {
      button.addEventListener('click', () => applyPreset(Number(button.dataset.preset)));
    });
    ['#inH', '#inM', '#inS'].forEach((selector) => {
      qs(selector).addEventListener('change', syncFromInputs);
    });
    function handleHistoryAction(target) {
      const row = target.closest('.hist-row');
      if (!row) return;

      if (target.closest('.hist-delete')) {
        if (removeHistory(Number(row.dataset.historyIndex))) {
          saveState();
          renderHistory();
          showToast('已删除计时记录');
        }
        return;
      }

      if (!target.closest('.hist-content')) return;
      const entry = state.history[Number(row.dataset.historyIndex)];
      if (!entry) return;
      applyPreset(entry.sec);
      showToast(`已载入 ${formatCountdown(entry.sec)}，点击开始再次计时`);
    }

    const history = qs('#cdHistory');
    history.addEventListener('click', (event) => {
      handleHistoryAction(event.target);
    });
    history.addEventListener('keydown', (event) => {
      if (!['Enter', ' '].includes(event.key)) return;
      if (!event.target.closest('[role="button"]')) return;
      event.preventDefault();
      handleHistoryAction(event.target);
    });
  }

  function setSoundName(name) {
    if (!countdown.running) {
      qs('#cdHint').textContent = `结束时将用「${name}」提醒。`;
    }
  }

  function initialize() {
    writeInputs(DEFAULT_SECONDS);
    render();
    renderHistory();
  }

  return {
    initialize,
    setSoundName,
    toggle: () => (countdown.running ? pause() : start())
  };
}
