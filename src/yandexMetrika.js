const rawMetrikaId = String(import.meta.env.VITE_YANDEX_METRIKA_ID || '').trim();
const metrikaId = /^\d+$/.test(rawMetrikaId) ? Number(rawMetrikaId) : null;
const attributionStorageKey = 'gamehubparty_marketing_attribution';
const attributionKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

const options = {
  ssr: true,
  clickmap: true,
  trackLinks: true,
  accurateTrackBounce: true,
  webvisor: true,
  ecommerce: 'dataLayer',
  referrer: document.referrer,
  url: location.href,
};

function canUseMetrika() {
  return Boolean(metrikaId && typeof window !== 'undefined' && typeof document !== 'undefined');
}

export function getMetrikaAttribution() {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(location.search);
  const current = Object.fromEntries(attributionKeys
    .map((key) => [key, String(params.get(key) || '').trim().slice(0, 160)])
    .filter(([, value]) => value));
  try {
    if (Object.keys(current).length) {
      localStorage.setItem(attributionStorageKey, JSON.stringify(current));
      return current;
    }
    const saved = JSON.parse(localStorage.getItem(attributionStorageKey) || '{}');
    return Object.fromEntries(attributionKeys
      .map((key) => [key, String(saved?.[key] || '').trim().slice(0, 160)])
      .filter(([, value]) => value));
  } catch (_) {
    return current;
  }
}

export function initYandexMetrika() {
  if (!canUseMetrika() || window.__GAMEHUBPARTY_METRIKA_READY__) return;
  getMetrikaAttribution();
  window.__GAMEHUBPARTY_METRIKA_READY__ = true;
  window.ym = window.ym || function ymStub() {
    window.ym.a = window.ym.a || [];
    window.ym.a.push(arguments);
  };
  window.ym.l = Date.now();
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://mc.yandex.ru/metrika/tag.js?id=${metrikaId}`;
  document.head.append(script);
  window.ym(metrikaId, 'init', options);
}

export function trackMetrikaPageView(page) {
  if (!canUseMetrika()) return;
  initYandexMetrika();
  window.ym(metrikaId, 'hit', `${location.pathname}${location.search}${location.hash}`, {
    title: document.title,
    referer: document.referrer,
    params: { page, ...getMetrikaAttribution() },
  });
}

export function reachMetrikaGoal(goal, params = {}) {
  if (!canUseMetrika()) return;
  initYandexMetrika();
  window.ym(metrikaId, 'reachGoal', goal, { ...getMetrikaAttribution(), ...params });
}
