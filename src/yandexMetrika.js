const rawMetrikaId = String(import.meta.env.VITE_YANDEX_METRIKA_ID || '').trim();
const metrikaId = /^\d+$/.test(rawMetrikaId) ? Number(rawMetrikaId) : null;

const options = {
  clickmap: true,
  trackLinks: true,
  accurateTrackBounce: true,
  webvisor: true,
};

function canUseMetrika() {
  return Boolean(metrikaId && typeof window !== 'undefined' && typeof document !== 'undefined');
}

export function initYandexMetrika() {
  if (!canUseMetrika() || window.__GAMEHUBPARTY_METRIKA_READY__) return;
  window.__GAMEHUBPARTY_METRIKA_READY__ = true;
  window.ym = window.ym || function ymStub() {
    window.ym.a = window.ym.a || [];
    window.ym.a.push(arguments);
  };
  window.ym.l = Date.now();
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://mc.yandex.ru/metrika/tag.js';
  document.head.append(script);
  window.ym(metrikaId, 'init', options);
}

export function trackMetrikaPageView(page) {
  if (!canUseMetrika()) return;
  initYandexMetrika();
  window.ym(metrikaId, 'hit', `${location.pathname}${location.search}${location.hash}`, {
    title: document.title,
    referer: document.referrer,
    params: { page },
  });
}

export function reachMetrikaGoal(goal, params = {}) {
  if (!canUseMetrika()) return;
  initYandexMetrika();
  window.ym(metrikaId, 'reachGoal', goal, params);
}
