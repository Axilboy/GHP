import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { io } from 'socket.io-client';

const port = 3201;
const baseUrl = `http://127.0.0.1:${port}`;

function request(socket, event, payload = {}) {
  return new Promise((resolve, reject) => {
    socket.timeout(3000).emit(event, payload, (error, response) => {
      if (error) return reject(error);
      if (!response?.ok) return reject(new Error(response?.error || 'Request failed'));
      resolve(response);
    });
  });
}

function waitFor(socket, event, predicate = () => true) {
  return new Promise((resolve) => {
    const handler = (payload) => {
      if (!predicate(payload)) return;
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });
}

async function waitForServer(url, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Server did not start in time');
}

async function connect(playerId) {
  const socket = io(baseUrl, { transports: ['websocket'] });
  await new Promise((resolve) => socket.once('connect', resolve));
  socket.emit('identify', { playerId });
  return socket;
}

test('room ads are disabled for everyone when any player has PRO access', { timeout: 15000 }, async () => {
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), NODE_ENV: 'production' },
    stdio: 'ignore',
  });
  const sockets = [];
  try {
    assert.equal((await waitForServer(`${baseUrl}/api/health`)).status, 200);
    const host = await connect('ad-host');
    const guest = await connect('ad-pro-guest');
    sockets.push(host, guest);

    const created = await request(host, 'create_room', { playerId: 'ad-host', name: 'Host' });
    assert.equal(created.room.adPolicy.enabled, true);
    assert.equal(created.room.adPolicy.adFree, false);
    assert.ok(created.room.adPolicy.placements.includes('pre_round'));
    assert.ok(created.room.adPolicy.placements.includes('lobby_player_banner'));

    await request(guest, 'activate_demo_plan', { plan: 'pro', months: 1 });
    const update = waitFor(host, 'room_updated', (room) => room.adPolicy?.adFree === true);
    const joined = await request(guest, 'join_room', { playerId: 'ad-pro-guest', name: 'PRO Guest', code: created.room.code });
    assert.equal(joined.room.adPolicy.adFree, true);
    assert.equal(joined.room.adPolicy.enabled, false);
    assert.equal(joined.room.adPolicy.sponsorName, 'PRO Guest');

    const hostRoom = await update;
    assert.equal(hostRoom.adPolicy.adFree, true);
    assert.equal(hostRoom.adPolicy.enabled, false);
  } finally {
    sockets.forEach((socket) => socket.disconnect());
    server.kill();
  }
});
