import crypto from 'node:crypto';

// Диалоги игрока с админом. Заменяют одностороннюю форму обратной связи:
// у обращения есть история сообщений, статус и выданные награды.
const threads = new Map();

export const threadTopics = ['idea', 'bug', 'payment', 'content', 'task', 'other'];
export const threadStatuses = ['open', 'accepted', 'rejected', 'closed'];

const MAX_MESSAGES = 200;

export function createThread({ playerId, playerName, topic, message, contactEmail = '', page = '', taskId = '' }) {
  const id = crypto.randomUUID();
  const now = Date.now();
  const thread = {
    id,
    playerId: String(playerId),
    playerName: String(playerName || 'Игрок').slice(0, 80),
    contactEmail: String(contactEmail || '').slice(0, 120),
    topic: threadTopics.includes(topic) ? topic : 'other',
    taskId: String(taskId || ''),
    page: String(page || '').slice(0, 300),
    status: 'open',
    rewards: [],
    messages: [],
    unreadForAdmin: 0,
    unreadForPlayer: 0,
    createdAt: now,
    updatedAt: now,
  };
  threads.set(id, thread);
  addMessage(thread, 'player', message);
  return thread;
}

export function addMessage(thread, from, text) {
  const body = String(text || '').trim().slice(0, 2000);
  if (!body) throw new Error('Сообщение пустое');
  thread.messages.push({ id: crypto.randomUUID(), from, text: body, at: Date.now() });
  if (thread.messages.length > MAX_MESSAGES) thread.messages = thread.messages.slice(-MAX_MESSAGES);
  if (from === 'player') thread.unreadForAdmin += 1;
  if (from === 'admin') thread.unreadForPlayer += 1;
  thread.updatedAt = Date.now();
  return thread;
}

export function getThread(id) {
  return threads.get(String(id)) || null;
}

// Игрок видит только свои обращения — доступ проверяется по playerId,
// как и во всём остальном приложении.
export function listPlayerThreads(playerId) {
  return [...threads.values()]
    .filter((thread) => thread.playerId === String(playerId))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function listThreads() {
  return [...threads.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function markRead(thread, side) {
  if (side === 'player') thread.unreadForPlayer = 0;
  if (side === 'admin') thread.unreadForAdmin = 0;
  return thread;
}

export function setThreadStatus(thread, status) {
  if (!threadStatuses.includes(status)) throw new Error('Неизвестный статус обращения');
  thread.status = status;
  thread.updatedAt = Date.now();
  return thread;
}

export function addThreadReward(thread, reward) {
  thread.rewards.push({ ...reward, at: Date.now() });
  return thread;
}

export function publicThread(thread) {
  return {
    id: thread.id,
    topic: thread.topic,
    taskId: thread.taskId,
    status: thread.status,
    rewards: thread.rewards,
    messages: thread.messages,
    unread: thread.unreadForPlayer,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  };
}

export function allThreads() {
  return [...threads.values()];
}

export function restoreThreads(snapshot = []) {
  for (const saved of snapshot) {
    if (!saved?.id || threads.has(saved.id)) continue;
    threads.set(saved.id, { rewards: [], messages: [], unreadForAdmin: 0, unreadForPlayer: 0, ...saved });
  }
}
