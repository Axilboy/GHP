import { createClient } from 'redis';

const snapshotKey = 'gamehubparty:profiles:v1';
let client = null;
let saveTimer = null;

export async function connectProfilePersistence() {
  if (!process.env.REDIS_URL) return null;
  client = createClient({ url: process.env.REDIS_URL });
  client.on('error', (error) => console.error('Profile Redis error:', error.message));
  try {
    await client.connect();
    return client;
  } catch (error) {
    console.error('Profile Redis unavailable, using memory only:', error.message);
    client = null;
    return null;
  }
}

export async function loadProfileSnapshot() {
  if (!client) return [];
  try {
    return JSON.parse(await client.get(snapshotKey) || '[]');
  } catch {
    return [];
  }
}

export function scheduleProfileSnapshot(getProfiles) {
  if (!client) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => client.set(snapshotKey, JSON.stringify(getProfiles())).catch(() => {}), 50);
}
