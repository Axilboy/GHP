import { createClient } from 'redis';

const events = [];
const maxEvents = Number(process.env.ANALYTICS_MAX_EVENTS || 5000);
const snapshotKey = 'gamehubparty:analytics:v1';
let client = null;
let saveTimer = null;
const windows = [
  { id: 'today', label: 'Сегодня', ms: 24 * 60 * 60 * 1000 },
  { id: 'week', label: '7 дней', ms: 7 * 24 * 60 * 60 * 1000 },
  { id: 'month', label: '30 дней', ms: 30 * 24 * 60 * 60 * 1000 },
];

const gameFunnelSteps = [
  { key: 'page_view:home', title: 'Главная' },
  { key: 'create_room', title: 'Комната создана' },
  { key: 'join_room', title: 'Второй игрок вошёл' },
  { key: 'start_round', title: 'Раунд стартовал' },
  { key: 'finish_round', title: 'Раунд завершён' },
];

const storeFunnelSteps = [
  { key: 'open_store', title: 'Магазин открыт' },
  { key: 'start_checkout', title: 'Оплата начата' },
  { key: 'payment_success', title: 'Оплата успешна' },
];

export function track(name, details = {}) {
  const event = {
    name: cleanEventName(name),
    at: Date.now(),
    details: cleanDetails(details),
  };
  events.push(event);
  if (events.length > maxEvents) events.splice(0, events.length - maxEvents);
  scheduleAnalyticsSnapshot();
  return event;
}

export async function connectAnalyticsPersistence() {
  if (!process.env.REDIS_URL) return null;
  client = createClient({ url: process.env.REDIS_URL });
  client.on('error', (error) => console.error('Analytics Redis error:', error.message));
  try {
    await client.connect();
    return client;
  } catch (error) {
    console.error('Analytics Redis unavailable, using memory only:', error.message);
    client = null;
    return null;
  }
}

export async function restoreAnalyticsSnapshot() {
  if (!client) return;
  try {
    const saved = JSON.parse(await client.get(snapshotKey) || '[]');
    if (!Array.isArray(saved)) return;
    events.splice(0, events.length, ...saved.map(normalizeSavedEvent).filter(Boolean).slice(-maxEvents));
  } catch (error) {
    console.error('Could not load analytics from Redis:', error.message);
  }
}

export function analyticsSnapshot(now = Date.now()) {
  const byWindow = Object.fromEntries(windows.map((window) => [window.id, summarizeWindow(window, now)]));
  return {
    generatedAt: now,
    windows: windows.map(({ id, label }) => ({ id, label })),
    byWindow,
    recent: events.slice(-25).reverse(),
  };
}

function scheduleAnalyticsSnapshot() {
  if (!client) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    client.set(snapshotKey, JSON.stringify(events.slice(-maxEvents))).catch(() => {});
  }, 100);
}

function normalizeSavedEvent(event) {
  const name = cleanEventName(event?.name);
  const at = Number(event?.at || 0);
  if (!name || !Number.isFinite(at) || at <= 0) return null;
  return { name, at, details: cleanDetails(event.details || {}) };
}

function summarizeWindow(window, now) {
  const since = now - window.ms;
  const windowEvents = events.filter((event) => event.at >= since);
  return {
    since,
    totalEvents: windowEvents.length,
    uniquePlayers: uniqueCount(windowEvents.map((event) => event.details.playerId)),
    uniqueSessions: uniqueCount(windowEvents.map((event) => event.details.sessionId)),
    counters: countBy(windowEvents.map((event) => event.name)),
    pages: countBy(windowEvents.filter((event) => event.name === 'page_view').map((event) => event.details.page || 'unknown')),
    referrers: topEntries(countBy(windowEvents.map((event) => event.details.referrer).filter(Boolean)), 8),
    gameFunnel: buildFunnel(windowEvents, gameFunnelSteps),
    storeFunnel: buildFunnel(windowEvents, storeFunnelSteps),
  };
}

// Шаги воронки считаем по уникальным комнатам, а не по событиям: старт раунда
// шлётся раз на комнату, а завершение — на каждый раунд или ход (Alias, ПоД),
// из-за чего сырые счётчики давали конверсию в тысячи процентов.
// События без roomId (просмотры страниц, магазин) считаются поштучно как раньше.
function buildFunnel(windowEvents, steps) {
  const buckets = {};
  windowEvents.forEach((event, index) => {
    const bucketId = event.details?.roomId || `event-${index}`;
    for (const key of eventKeys(event)) (buckets[key] ??= new Set()).add(bucketId);
  });
  let previous = null;
  return steps.map((step) => {
    const count = buckets[step.key]?.size || 0;
    const conversion = previous === null ? 100 : previous > 0 ? Math.round((count / previous) * 100) : 0;
    previous = count;
    return { ...step, count, conversion };
  });
}

function eventKeys(event) {
  const keys = [event.name];
  if (event.name === 'page_view' && event.details.page) keys.push(`page_view:${event.details.page}`);
  if (event.name === 'room_created') keys.push('create_room', `create_room:${event.details.gameId || 'spy'}`);
  if (event.name === 'room_joined') keys.push('join_room', `join_room:${event.details.gameId || 'unknown'}`);
  if (event.name === 'round_started') keys.push('start_round', `start_round:${event.details.gameId || 'spy'}`);
  if (event.name === 'round_finished') keys.push('finish_round', `finish_round:${event.details.gameId || 'spy'}`);
  if (event.name === 'order_created') keys.push('start_checkout', `start_checkout:${event.details.productId || 'unknown'}`);
  if (event.name === 'order_paid') keys.push('payment_success', `payment_success:${event.details.productId || 'unknown'}`);
  if (event.name === 'order_canceled') keys.push('payment_failed');
  return keys;
}

function cleanEventName(value) {
  return String(value || 'unknown').trim().toLowerCase().replace(/[^a-z0-9:_-]+/g, '_').slice(0, 80) || 'unknown';
}

function cleanDetails(details) {
  const safe = {};
  for (const [key, value] of Object.entries(details || {})) {
    if (value === undefined || value === null || value === '') continue;
    safe[key] = typeof value === 'number' || typeof value === 'boolean'
      ? value
      : String(value).slice(0, 220);
  }
  return safe;
}

function countBy(values) {
  const counts = {};
  for (const value of values) {
    if (!value) continue;
    counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

function uniqueCount(values) {
  return new Set(values.filter(Boolean)).size;
}

function topEntries(counts, limit) {
  return Object.entries(counts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}
