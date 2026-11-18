import { qs } from '../utils/dom.js';
import { dayHint, humanLeft, pad, WEEK_TEXT } from '../utils/time.js';
import { renderDialTicks, rotateElement } from './dial.js';

export function createClockPanel({ getNextAlarm }) {
  renderDialTicks('#ticksClock', '#numeralsClock');

  function renderTime() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    qs('#clockHM').textContent = `${pad(hours)}:${pad(minutes)}`;
    qs('#clockS').textContent = pad(seconds);
    qs('#clockWeekday').textContent = WEEK_TEXT[now.getDay()];
    qs('#clockDate').textContent = `${now.getMonth() + 1}月${now.getDate()}日`;
    qs('#dialDate').textContent =
      `${pad(now.getMonth() + 1)} · ${pad(now.getDate())} · ${now.getFullYear()}`;

    rotateElement(qs('#secondHand'), seconds * 6);
    const minuteDegrees = minutes * 6 + seconds * 0.1;
    rotateElement(qs('#minuteHand'), minuteDegrees);
    rotateElement(qs('#minuteHand2'), minuteDegrees);
    const hourDegrees = (hours % 12) * 30 + minutes * 0.5;
    rotateElement(qs('#hourHand'), hourDegrees);
    rotateElement(qs('#hourHand2'), hourDegrees);
  }

  function renderNextAlarm() {
    const container = qs('#nextLine');
    const nearest = getNextAlarm();

    if (!nearest) {
      container.innerHTML = '<span class="quiet">暂无启用的闹钟</span>';
      return;
    }

    container.innerHTML =
      `下一个闹钟 <strong>${nearest.alarm.time}</strong> · ${dayHint(nearest.date)}` +
      ` · 还有 ${humanLeft(nearest.date.getTime() - Date.now())}`;
  }

  return {
    renderTime,
    renderNextAlarm
  };
}
