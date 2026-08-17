import { getPlayerId } from '../identity';
import { localStore, sessionStore } from '../browserStorage';
import { getSubscriptionStatus } from '../profileStatus';
import { isVkRuntime } from '../vk';
import { getMetrikaAttribution, reachMetrikaGoal, trackMetrikaPageView } from '../yandexMetrika';
import { trackOpenPanelEvent } from '../openPanel';

export function formatTime(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function hasGamePass(profile, gameId) {
  return profile?.gamePasses?.some((pass) => pass.gameId === gameId && pass.activeUntil > Date.now());
}

export function hasRoomContentAccess(profile, gameId) {
  const subscription = getSubscriptionStatus(profile);
  const partyPass = profile?.partyPasses?.some((pass) => pass.activeUntil > Date.now());
  return subscription.active || partyPass || hasGamePass(profile, gameId);
}

export function hasThemePass(profile, themeId) {
  const id = String(themeId || '').trim();
  return profile?.themePasses?.some((pass) => pass.themeId === id && pass.activeUntil > Date.now()) || false;
}

export function hasAnyThemePass(profile, themeIds = []) {
  const ids = Array.isArray(themeIds) ? themeIds : [];
  return ids.some((id) => hasThemePass(profile, id));
}

export function hasThemedContentAccess(profile, gameId, item = {}) {
  return Boolean(item.free || item.tier === 'free' || hasRoomContentAccess(profile, gameId) || hasAnyThemePass(profile, item.themeIds));
}

export function isVkHost() {
  return isVkRuntime();
}

export function currentPath() {
  const path = location.pathname.replace(/\/+$/, '');
  return path || '/';
}

export function analyticsSessionId() {
  const key = 'gamehubparty_analytics_session';
  try {
    const saved = sessionStore.getItem(key);
    if (saved) return saved;
    const next = `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStore.setItem(key, next);
    return next;
  } catch (_) {
    return '';
  }
}

export function shouldTrackReturnVisit(now = Date.now()) {
  const sessionKey = 'gamehubparty_return_visit_tracked';
  const lastVisitKey = 'gamehubparty_last_visit_at';
  if (sessionStore.getItem(sessionKey)) return false;
  sessionStore.setItem(sessionKey, '1');
  const previousVisit = Number(localStore.getItem(lastVisitKey) || 0);
  localStore.setItem(lastVisitKey, String(now));
  return previousVisit > 0 && now - previousVisit >= 30 * 60 * 1000;
}

export async function hashAnalyticsRoomId(roomId) {
  const value = String(roomId || '').trim();
  if (!value || !globalThis.crypto?.subtle || typeof TextEncoder === 'undefined') return '';
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(`gamehubparty-room-v1:${value}`));
  return [...new Uint8Array(digest)].slice(0, 12).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function trackClientEvent(name, details = {}) {
  const attribution = getMetrikaAttribution();
  const payload = {
    name,
    details: {
      page: details.page,
      path: location.pathname,
      playerId: getPlayerId(),
      sessionId: analyticsSessionId(),
      referrer: document.referrer,
      source: attribution.utm_source || '',
      medium: attribution.utm_medium || '',
      campaign: attribution.utm_campaign || '',
      content: attribution.utm_content || '',
      term: attribution.utm_term || '',
      ...details,
    },
  };
  fetch('/api/analytics/track', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
  trackOpenPanelEvent(name, payload.details);
  if (name === 'page_view') trackMetrikaPageView(details.page);
  else reachMetrikaGoal(name, { ...attribution, ...details });
}

export const SESSION_GRACE_MS = 5 * 60 * 1000;

export function readSavedSession(sessionKey) {
  try {
    return JSON.parse(localStore.getItem(sessionKey) || 'null');
  } catch {
    localStore.removeItem(sessionKey);
    return null;
  }
}

export function normalizePausedSession(sessionKey, playerId, sourceRoom = null) {
  const saved = sourceRoom ? { roomId: sourceRoom.id, code: sourceRoom.code } : readSavedSession(sessionKey);
  if (!saved?.roomId) return null;
  const pausedUntil = saved.status === 'paused' && saved.pausedUntil ? saved.pausedUntil : Date.now() + SESSION_GRACE_MS;
  if (pausedUntil <= Date.now()) {
    localStore.removeItem(sessionKey);
    return null;
  }
  const session = {
    roomId: saved.roomId,
    code: sourceRoom?.code || saved.code || '',
    playerId,
    status: 'paused',
    pausedAt: saved.pausedAt || Date.now(),
    pausedUntil,
  };
  localStore.setItem(sessionKey, JSON.stringify(session));
  return session;
}

export function saveActiveSession(sessionKey, playerId, nextRoom) {
  if (!nextRoom?.id) return;
  localStore.setItem(sessionKey, JSON.stringify({
    roomId: nextRoom.id,
    code: nextRoom.code || '',
    playerId,
    status: 'active',
    updatedAt: Date.now(),
  }));
}

export const roomThemesFallback = [
  { id: 'ghp', name: 'GHP Classic', free: true, priceRub: 0, description: 'Светлая базовая тема GameHubParty.' },
  { id: 'partyhub', name: 'PartyHub', free: false, priceRub: 149, description: 'Тёмная клубная тема с тёплым акцентом и контрастными кнопками.' },
];

export function getRoomThemeName(themeId, themes = roomThemesFallback) {
  return themes.find((theme) => theme.id === themeId)?.name || 'GHP Classic';
}

export function getOwnedThemeSet(profile) {
  return new Set(['ghp', ...(profile?.ownedThemeIds || [])]);
}

export function hasActiveGamePass(profile, gameId) {
  return Boolean(getActiveGamePass(profile, gameId));
}

export function getActiveGamePass(profile, gameId) {
  return profile?.gamePasses?.find((pass) => pass.gameId === gameId && pass.activeUntil > Date.now()) || null;
}

export function formatAccessDate(activeUntil) {
  if (!activeUntil) return '';
  return new Date(activeUntil).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function profileAccessList(profile) {
  const now = Date.now();
  const items = [];
  const subscription = getSubscriptionStatus(profile);
  if (subscription.active) {
    items.push({
      id: 'subscription',
      title: `${subscription.plan} подписка`,
      label: 'Вся платформа',
      until: profile?.subscription?.activeUntil,
      note: 'Игры, стандартные библиотеки и отключение рекламы на срок подписки.',
    });
  }
  for (const pass of profile?.gamePasses || []) {
    if (pass.activeUntil <= now) continue;
    const names = { spy: 'Spy Pass', alias: 'Alias Pass', bunker: 'Bunker Pass' };
    items.push({
      id: pass.id || pass.productId,
      title: names[pass.gameId] || 'Game Pass',
      label: pass.gameId === 'spy' ? 'Шпион' : pass.gameId === 'alias' ? 'Alias' : pass.gameId === 'bunker' ? 'Бункер' : 'Игра',
      until: pass.activeUntil,
      note: 'Расширения и отключение рекламы только в этой игре.',
    });
  }
  for (const pass of profile?.themePasses || []) {
    if (pass.activeUntil <= now) continue;
    items.push({
      id: pass.id || pass.productId,
      title: pass.name || 'Тематический пропуск',
      label: 'Тематические наборы',
      until: pass.activeUntil,
      note: 'Открывает связанные тематические наборы в играх на срок пропуска.',
    });
  }
  for (const pass of profile?.partyPasses || []) {
    if (pass.activeUntil <= now) continue;
    items.push({
      id: pass.id,
      title: 'WeekendPass',
      label: 'Вечер для комнаты',
      until: pass.activeUntil,
      note: 'Все доступные игры и без рекламных пауз для комнаты.',
    });
  }
  return items;
}

export function hasTimedGameAccess(profile, gameId) {
  const subscriptionActive = Number(profile?.subscription?.activeUntil || 0) > Date.now();
  const partyPassActive = profile?.partyPasses?.some((pass) => pass.activeUntil > Date.now());
  return Boolean(profile?.pro || profile?.proPlus || subscriptionActive || partyPassActive || hasGamePass(profile, gameId));
}

export function hasProAccess(profile) {
  return Boolean(profile?.pro || profile?.proPlus || Number(profile?.subscription?.activeUntil || 0) > Date.now());
}
