import bridge from '@vkontakte/vk-bridge';
import { localStore } from './browserStorage';

const VK_LAUNCH_KEY = 'gamehubparty_vk_launch';
let initPromise = null;

export function isVkRuntime() {
  const params = readVkLaunchParams();
  return Boolean(params) || location.hostname === 'vk.gamehubparty.ru' || location.hostname.startsWith('vk.');
}

export function initVkBridge() {
  if (!isVkRuntime()) return Promise.resolve(null);
  if (!initPromise) {
    initPromise = bridge.send('VKWebAppInit').then(() => ({ ok: true })).catch((error) => ({ ok: false, error: error.message }));
  }
  return initPromise;
}

export function readVkLaunchParams(search = location.search) {
  const params = new URLSearchParams(search);
  const entries = {};
  for (const [key, value] of params.entries()) {
    if (key === 'sign' || key.startsWith('vk_')) entries[key] = value;
  }
  return Object.keys(entries).length ? entries : null;
}

export function getSavedVkLaunch() {
  try {
    return JSON.parse(localStore.getItem(VK_LAUNCH_KEY) || 'null');
  } catch {
    return null;
  }
}

export function saveVkLaunch(launch) {
  if (!launch) return;
  localStore.setItem(VK_LAUNCH_KEY, JSON.stringify({ ...launch, savedAt: Date.now() }));
}

export async function verifyVkLaunch(params) {
  if (!params) return null;
  const response = await fetch('/api/vk/launch', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ params }),
  });
  if (!response.ok) throw new Error('VK launch check failed');
  return response.json();
}

export function vkSummary(launch) {
  if (!launch?.vk) return null;
  const { userId, platform, language, appId } = launch.vk;
  return { userId, platform, language, appId, verified: launch.verified };
}
