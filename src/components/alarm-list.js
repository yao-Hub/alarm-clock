import { SOUNDS } from '../core/audio.js';
import {
  createAlarm,
  getSelectedAlarmSound,
  removeAlarm,
  saveState,
  state,
  toggleAlarm
} from '../core/store.js';
import { escapeHtml, qs } from '../utils/dom.js';
import { repeatText } from '../utils/time.js';
import { showToast } from './toast.js';

export function createAlarmList({ onChange, onEdit }) {
  const list = qs('#alarmList');
  const emptyState = qs('#alarmEmpty');

  list.addEventListener('click', (event) => {
    const row = event.target.closest('.alarm');
    if (!row) return;

    const { id } = row.dataset;
    const action = event.target.dataset.act;
    if (action === 'toggle') {
      const alarm = toggleAlarm(id);
      if (!alarm) return;
      saveState();
      onChange({ type: 'toggle', alarm });
      showToast(`${alarm.time} ${alarm.on ? '已启用' : '已关闭'}`);
    }
    if (action === 'edit') onEdit(id);
    if (action === 'del') {
      const alarm = removeAlarm(id);
      if (!alarm) return;
      saveState();
      onChange({ type: 'delete', alarm });
      showToast('已删除该闹钟');
    }
  });

  qs('#tplRow').addEventListener('click', (event) => {
    const template = event.target.closest('.tpl');
    if (!template) return;

    const days = template.dataset.days
      ? template.dataset.days.split(',').map(Number)
      : [];
    const alarm = createAlarm({
      time: template.dataset.time,
      label: template.dataset.label,
      days,
      sound: getSelectedAlarmSound()
    });

    saveState();
    onChange({ type: 'create', alarm });
    showToast(`已添加闹钟 · ${alarm.time} ${alarm.label}`);
  });

  function render() {
    const alarms = [...state.alarms].sort((left, right) => left.time.localeCompare(right.time));
    emptyState.hidden = alarms.length > 0;

    list.innerHTML = alarms.map((alarm) => {
      const soundName = SOUNDS[alarm.sound]?.name || SOUNDS.bell.name;
      const label = alarm.label
        ? `<span class="sep">/</span><span>${escapeHtml(alarm.label)}</span>`
        : '';

      return (
        `<li class="alarm${alarm.on ? '' : ' is-off'}" data-id="${escapeHtml(alarm.id)}">` +
          '<div class="alarm-body">' +
            `<button class="switch" role="switch" aria-checked="${alarm.on}" ` +
              'aria-label="启用或关闭闹钟" data-act="toggle"></button>' +
            '<div class="alarm-copy">' +
              `<div class="alarm-time">${alarm.time}</div>` +
              '<div class="alarm-meta">' +
                `<span>${repeatText(alarm)}</span>${label}` +
                `<span class="sep">/</span><span class="sound">${soundName}</span>` +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="alarm-actions">' +
            '<button data-act="edit">编辑</button>' +
            '<button data-act="del">删除</button>' +
          '</div>' +
        '</li>'
      );
    }).join('');
  }

  return { render };
}
