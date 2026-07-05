import test from 'node:test';
import assert from 'node:assert/strict';
import { allRooms, cleanupInactiveRooms, createRoom } from './roomStore.js';

test('inactive rooms are removed after their ttl', () => {
  const room = createRoom({ hostId: 'cleanup-host', hostName: 'Host' });
  room.players[0].online = false;
  room.updatedAt = 1000;
  assert.deepEqual(cleanupInactiveRooms(500, 1600), [room.id]);
  assert.equal(allRooms().some((item) => item.id === room.id), false);
});

test('online rooms are not removed by cleanup', () => {
  const room = createRoom({ hostId: 'online-host', hostName: 'Host' });
  room.updatedAt = 1000;
  assert.deepEqual(cleanupInactiveRooms(500, 1600), []);
  assert.equal(allRooms().some((item) => item.id === room.id), true);
});
