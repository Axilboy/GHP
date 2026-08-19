import { createClient } from 'redis';

const snapshotKey = 'gamehubparty:threads:v1';
let client = null;
let saveTimer = null;

export async function connectThreadPersistence() {
  if (!process.env.REDIS_URL) return null;
  client = createClient({ url: process.env.REDIS_URL });
  client.on('error', (error) => console.error('Thread Redis error:', error.message));
  try {
    await client.connect();
    return client;
  } catch (error) {
    console.error('Thread Redis unavailable, using memory only:', error.message);
    client = null;
    return null;
  }
}

export async function loadThreadSnapshot() {
  if (!client) return [];
  try {
    return JSON.parse(await client.get(snapshotKey) || '[]');
  } catch {
    return [];
  }
}

export function scheduleThreadSnapshot(getThreads) {
  if (!client) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => client.set(snapshotKey, JSON.stringify(getThreads())).catch(() => {}), 50);
}
