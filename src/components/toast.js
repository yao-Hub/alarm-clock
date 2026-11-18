import { qs } from '../utils/dom.js';

let hideTimer = null;

export function showToast(message) {
  const toast = qs('#toast');
  toast.textContent = message;
  toast.classList.add('is-on');
  clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => toast.classList.remove('is-on'), 2400);
}
