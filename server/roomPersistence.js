import { createClient } from 'redis';

const snapshotKey = 'gamehubparty:rooms:v1';
const snapshotTtlSeconds = 60 * 60 * 24 * 7;
let client = null;
let saveTimer = null;

export async function connectRoomPersistence() {
  if (!process.env.REDIS_URL) return null;
  client = createClient({ url: process.env.REDIS_URL });
  client.on('error', (error) => console.error('Redis error:', error.message));
  try {
    await client.connect();
    return client;
  } catch (error) {
    console.error('Redis unavailable, using memory only:', error.message);
    client = null;
    return null;
  }
}

export async function loadRoomSnapshot() {
  if (!client) return [];
  try {
    return JSON.parse(await client.get(snapshotKey) || '[]');
  } catch (error) {
    console.error('Could not load rooms from Redis:', error.message);
    return [];
  }
}

export function scheduleRoomSnapshot(getRooms) {
  if (!client) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await client.set(snapshotKey, JSON.stringify(getRooms()), { EX: snapshotTtlSeconds });
    } catch (error) {
      console.error('Could not save rooms to Redis:', error.message);
    }
  }, 50);
}
