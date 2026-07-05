import { localStore } from './browserStorage';

const ACCOUNT_KEY = 'gamehubparty_account';

const ADJECTIVES = ['Смелый', 'Весёлый', 'Хитрый', 'Спокойный', 'Быстрый', 'Таинственный', 'Ночной', 'Зоркий', 'Ловкий', 'Удачливый'];
const CHARACTERS = ['Детектив', 'Пилот', 'Бариста', 'Капитан', 'Актёр', 'Повар', 'Профессор', 'Курьер', 'Фотограф', 'Турист'];

function key(name) {
  return `gamehubparty_${name}`;
}

function createPlayerId() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    globalThis.crypto?.getRandomValues?.(bytes);
    if (bytes.some(Boolean)) {
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  } catch (_) {}
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getPlayerId() {
  const playerKey = key('player_id');
  let id = localStore.getItem(playerKey);
  if (!id) {
    id = createPlayerId();
    localStore.setItem(playerKey, id);
  }
  return id;
}

export function getAccount() {
  try {
    return JSON.parse(localStore.getItem(ACCOUNT_KEY) || 'null');
  } catch {
    return null;
  }
}

export function saveAccount(account) {
  localStore.setItem(ACCOUNT_KEY, JSON.stringify(account));
  if (account?.id) localStore.setItem(key('player_id'), account.id);
  if (account?.name) localStore.setItem(key('guest_name'), account.name);
}

export function clearAccount() {
  localStore.removeItem(ACCOUNT_KEY);
}

export function signOutAccount() {
  localStore.removeItem(ACCOUNT_KEY);
  localStore.removeItem(key('player_id'));
}

export function getOrCreateDisplayName() {
  const accountName = getAccount()?.name?.trim();
  if (accountName) return accountName;
  const guestNameKey = key('guest_name');
  let name = localStore.getItem(guestNameKey);
  if (!name) {
    name = `${ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]} ${CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)]}`;
    localStore.setItem(guestNameKey, name);
  }
  return name;
}

export function saveGuestDisplayName(name) {
  if (!getAccount()) localStore.setItem(key('guest_name'), String(name).trim());
}

export function getSessionKey() {
  return key('session');
}
