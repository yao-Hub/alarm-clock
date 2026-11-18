export const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];
export const WEEK_TEXT = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

export const pad = (value) => String(value).padStart(2, '0');

export function nextOccurrence(alarm, fromMs) {
  const [hours, minutes] = alarm.time.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  const base = new Date(fromMs);
  for (let offset = 0; offset < 9; offset += 1) {
    const date = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate() + offset,
      hours,
      minutes,
      0,
      0
    );
    if (date.getTime() <= fromMs) continue;
    if (alarm.days.length && !alarm.days.includes(date.getDay())) continue;
    return date;
  }

  return null;
}

export function repeatText(alarm) {
  if (!alarm.days.length) return '仅一次';
  if (alarm.days.length === 7) return '每天';

  const days = [...alarm.days].sort();
  if (days.join() === '1,2,3,4,5') return '工作日';
  if (days.join() === '0,6') return '周末';
  return days.map((day) => `周${DAY_NAMES[day]}`).join(' ');
}

export function humanLeft(milliseconds) {
  const minutes = Math.max(1, Math.round(milliseconds / 60000));
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days} 天${hours % 24 ? ` ${hours % 24} 小时` : ''}`;
  }
  if (hours > 0) return `${hours} 小时${restMinutes ? ` ${restMinutes} 分` : ''}`;
  return `${restMinutes} 分钟`;
}

export function dayHint(date) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const difference = Math.round((target - today) / 86400000);

  if (difference === 0) return '今天';
  if (difference === 1) return '明天';
  return `周${DAY_NAMES[date.getDay()]}`;
}

export function formatCountdown(seconds) {
  const normalized = Math.max(0, Math.ceil(seconds));
  const hours = Math.floor(normalized / 3600);
  const minutes = Math.floor((normalized % 3600) / 60);
  const restSeconds = normalized % 60;

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(restSeconds)}`
    : `${pad(minutes)}:${pad(restSeconds)}`;
}

export function formatClockTime(timestamp) {
  const date = new Date(timestamp);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
