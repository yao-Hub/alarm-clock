import { qs } from '../utils/dom.js';
import { formatCountdown } from '../utils/time.js';

const CENTER = 200;
let timerLabelTotal = null;

export function renderDialTicks(ticksSelector, numeralsSelector = null) {
  const ticks = [];

  for (let index = 0; index < 60; index += 1) {
    const major = index % 5 === 0;
    const outer = 176;
    const inner = major ? 160 : 168;
    ticks.push(
      `<line class="tick${major ? ' tick-major' : ''}" x1="${CENTER}" y1="${CENTER - outer}" ` +
      `x2="${CENTER}" y2="${CENTER - inner}" transform="rotate(${index * 6} ${CENTER} ${CENTER})" ` +
      `stroke-width="${major ? 1.8 : 0.9}"/>`
    );
  }

  qs(ticksSelector).innerHTML = ticks.join('');
  if (!numeralsSelector) return;

  const numerals = [];
  for (let hour = 1; hour <= 12; hour += 1) {
    const angle = hour * 30 * Math.PI / 180;
    const x = CENTER + 139 * Math.sin(angle);
    const y = CENTER - 139 * Math.cos(angle);
    numerals.push(
      `<text class="numeral" x="${x.toFixed(1)}" y="${y.toFixed(1)}" ` +
      `text-anchor="middle" dominant-baseline="middle">${hour}</text>`
    );
  }

  qs(numeralsSelector).innerHTML = numerals.join('');
}

export function renderTimerLabels(total) {
  if (total === timerLabelTotal) return;
  timerLabelTotal = total;

  const container = qs('#numeralsTimer');
  if (!total || total <= 0) {
    container.innerHTML = '';
    return;
  }

  const marks = [
    [0, total],
    [90, Math.round(total * 0.75)],
    [180, Math.round(total * 0.5)],
    [270, Math.round(total * 0.25)]
  ];

  container.innerHTML = marks.map(([angleDegrees, remaining]) => {
    const angle = angleDegrees * Math.PI / 180;
    const x = CENTER + 126 * Math.sin(angle);
    const y = CENTER - 126 * Math.cos(angle);
    return (
      `<text class="numeral-minor" x="${x.toFixed(1)}" y="${y.toFixed(1)}" ` +
      `text-anchor="middle" dominant-baseline="middle">${formatCountdown(remaining)}</text>`
    );
  }).join('');
}

export function rotateElement(element, degrees) {
  element?.setAttribute('transform', `rotate(${degrees.toFixed(3)} 200 200)`);
}
