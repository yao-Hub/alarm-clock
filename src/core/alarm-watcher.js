import { nextOccurrence } from '../utils/time.js';

export function createAlarmWatcher({ alarms, onFire }) {
  let previousCheck = Date.now();

  function check() {
    const now = Date.now();

    alarms().forEach((alarm) => {
      if (!alarm.on || !alarm.time) return;
      const occurrence = nextOccurrence(alarm, previousCheck);
      if (occurrence && occurrence.getTime() <= now) onFire(alarm);
    });

    previousCheck = now;
  }

  return { check };
}
