import { qs, qsa } from '../utils/dom.js';

export function createTabs() {
  const tabs = qsa('.tab');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => select(tab.dataset.view));
  });

  function select(viewName) {
    tabs.forEach((tab) => {
      tab.setAttribute('aria-selected', String(tab.dataset.view === viewName));
    });
    qs('#view-alarm').dataset.active = String(viewName === 'alarm');
    qs('#view-timer').dataset.active = String(viewName === 'timer');
  }

  return {
    select,
    getActive: () => (qs('#view-timer').dataset.active === 'true' ? 'timer' : 'alarm')
  };
}
