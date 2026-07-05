import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { io } from 'socket.io-client';

const port = 3199;
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

test('three players can complete a classic spy round', { timeout: 15000 }, async () => {
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), NODE_ENV: 'production' },
    stdio: 'ignore',
  });
  const sockets = [];
  try {
    assert.equal((await waitForServer(`${baseUrl}/api/health`)).status, 200);
    for (let index = 0; index < 3; index += 1) {
      const socket = io(baseUrl, { transports: ['websocket'] });
      sockets.push(socket);
      await new Promise((resolve) => socket.once('connect', resolve));
      socket.emit('identify', { playerId: `p${index + 1}` });
    }

    const created = await request(sockets[0], 'create_room', { playerId: 'p1', name: 'Host' });
    const roomId = created.room.id;
    const code = created.room.code;
    await request(sockets[1], 'join_room', { playerId: 'p2', name: 'Two', code });
    const duplicate = await request(sockets[2], 'join_room', { playerId: 'p3', name: 'Two', code });
    assert.equal(duplicate.room.players.find((player) => player.id === 'p3').name, 'Two 2');
    const renamed = await request(sockets[2], 'rename_player', { roomId, name: 'Three' });
    assert.equal(renamed.name, 'Three');
    await request(sockets[1], 'set_ready', { roomId, ready: true });
    await request(sockets[2], 'set_ready', { roomId, ready: true });
    await request(sockets[0], 'start_round', { roomId });

    const cards = await Promise.all(sockets.map((socket) => request(socket, 'get_role', { roomId }).then((response) => response.card)));
    assert.equal(cards.filter((card) => card.isSpy).length, 1);

    const offline = waitFor(sockets[0], 'room_updated', (room) => room.players.find((player) => player.id === 'p3')?.online === false);
    sockets[2].disconnect();
    await offline;
    const discussion = waitFor(sockets[0], 'room_updated', (room) => room.round?.phase === 'discussion');
    await Promise.all(sockets.slice(0, 2).map((socket) => request(socket, 'role_seen', { roomId })));
    await discussion;
    const outsider = io(baseUrl, { transports: ['websocket'] });
    await new Promise((resolve) => outsider.once('connect', resolve));
    outsider.emit('identify', { playerId: 'outsider' });
    await assert.rejects(request(outsider, 'get_role', { roomId }), /Вы не состоите в этой комнате/);
    sockets[2].connect();
    await new Promise((resolve) => sockets[2].once('connect', resolve));
    await request(sockets[2], 'resume_room', { roomId, playerId: 'p3' });
    await request(sockets[0], 'start_vote', { roomId });
    await assert.rejects(request(outsider, 'vote', { roomId, targetId: 'p1' }), /Вы не состоите в этой комнате/);
    outsider.disconnect();

    const spyIndex = cards.findIndex((card) => card.isSpy);
    const spyId = `p${spyIndex + 1}`;
    const revote = waitFor(sockets[0], 'room_updated', (room) => room.round?.phase === 'voting' && room.round?.voteRound === 2);
    for (let index = 0; index < sockets.length; index += 1) {
      await request(sockets[index], 'vote', { roomId, targetId: `p${((index + 1) % sockets.length) + 1}` });
    }
    const tied = await revote;
    assert.equal(tied.round.voteCandidateIds.length, 3);

    const result = waitFor(sockets[0], 'room_updated', (room) => room.state === 'round_result');
    for (let index = 0; index < sockets.length; index += 1) {
      const voterId = `p${index + 1}`;
      const targetId = voterId === spyId ? (spyId === 'p1' ? 'p2' : 'p1') : spyId;
      await request(sockets[index], 'vote', { roomId, targetId });
    }
    const finished = await result;
    assert.equal(finished.round.result.winner, 'civilians');
    assert.equal(finished.scores.civilians, 1);
    assert.equal(finished.matchHistory[0].winner, 'civilians');
    assert.equal(finished.matchHistory[0].round, 1);
    await request(sockets[0], 'create_room', { playerId: 'p1', name: 'Host' });
    await request(sockets[0], 'create_room', { playerId: 'p1', name: 'Host' });
    await assert.rejects(request(sockets[0], 'create_room', { playerId: 'p1', name: 'Host' }), /Слишком много действий/);
  } finally {
    sockets.forEach((socket) => socket.disconnect());
    server.kill();
  }
});

test('host can switch game in lobby', { timeout: 15000 }, async () => {
  const switchPort = 3300 + Math.floor(Math.random() * 2000);
  const switchUrl = `http://127.0.0.1:${switchPort}`;
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(switchPort), NODE_ENV: 'production' },
    stdio: 'ignore',
  });
  const host = io(switchUrl, { transports: ['websocket'] });
  const guest = io(switchUrl, { transports: ['websocket'] });
  try {
    assert.equal((await waitForServer(`${switchUrl}/api/health`)).status, 200);
    await Promise.all([host, guest].map((socket) => new Promise((resolve) => socket.once('connect', resolve))));
    host.emit('identify', { playerId: 'switch-host' });
    guest.emit('identify', { playerId: 'switch-guest' });
    const created = await request(host, 'create_room', { playerId: 'switch-host', name: 'Host' });
    const roomId = created.room.id;
    await request(guest, 'join_room', { playerId: 'switch-guest', name: 'Guest', code: created.room.code });
    await request(guest, 'set_ready', { roomId, ready: true });

    const switched = await request(host, 'change_game', { roomId, gameId: 'bunker' });
    const bunkerRoom = switched.room;
    assert.equal(bunkerRoom.gameId, 'bunker');
    assert.equal(bunkerRoom.settings.revealMode, 'private_table');
    assert.deepEqual(bunkerRoom.scores, { saved: 0, eliminated: 0 });
    assert.equal(bunkerRoom.players.find((player) => player.id === 'switch-host').ready, true);
    assert.equal(bunkerRoom.players.find((player) => player.id === 'switch-guest').ready, false);
    await assert.rejects(request(guest, 'change_game', { roomId, gameId: 'alias' }), /Только хост/);
  } finally {
    host.disconnect();
    guest.disconnect();
    server.kill();
  }
});

test('spy answer is reviewed by civilian vote', { timeout: 15000 }, async () => {
  const reviewPort = 3211;
  const reviewUrl = `http://127.0.0.1:${reviewPort}`;
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(reviewPort), NODE_ENV: 'production' },
    stdio: 'ignore',
  });
  const sockets = [];
  try {
    assert.equal((await waitForServer(`${reviewUrl}/api/health`)).status, 200);
    for (let index = 0; index < 4; index += 1) {
      const socket = io(reviewUrl, { transports: ['websocket'] });
      sockets.push(socket);
      await new Promise((resolve) => socket.once('connect', resolve));
      socket.emit('identify', { playerId: `g${index + 1}` });
    }
    const created = await request(sockets[0], 'create_room', { playerId: 'g1', name: 'Host' });
    const roomId = created.room.id;
    await Promise.all(sockets.slice(1).map((socket, index) => request(socket, 'join_room', { playerId: `g${index + 2}`, name: `P${index + 2}`, code: created.room.code })));
    await Promise.all(sockets.slice(1).map((socket) => request(socket, 'set_ready', { roomId, ready: true })));
    await request(sockets[0], 'start_round', { roomId });
    const cards = await Promise.all(sockets.map((socket) => request(socket, 'get_role', { roomId }).then((response) => response.card)));
    await Promise.all(sockets.map((socket) => request(socket, 'role_seen', { roomId })));
    const spyIndex = cards.findIndex((card) => card.isSpy);
    const review = waitFor(sockets[0], 'room_updated', (room) => room.round?.phase === 'guess_review');
    await request(sockets[spyIndex], 'spy_guess', { roomId });
    const reviewRoom = await review;
    assert.equal(reviewRoom.round.phase, 'guess_review');
    assert.equal(reviewRoom.round.spyGuessVotesCount, 0);
    await assert.rejects(request(sockets[spyIndex], 'spy_guess_vote', { roomId, accepted: true }), /Шпион не голосует/);
    const result = waitFor(sockets[0], 'room_updated', (room) => room.state === 'round_result');
    for (let index = 0; index < sockets.length; index += 1) {
      if (index !== spyIndex) await request(sockets[index], 'spy_guess_vote', { roomId, accepted: true });
    }
    const finished = await result;
    assert.equal(finished.round.result.winner, 'spies');
    assert.equal(finished.round.result.reason, 'spy_guess_accepted');
    assert.deepEqual(finished.round.result.spyGuessVotes, { yes: 3, no: 0 });
  } finally {
    sockets.forEach((socket) => socket.disconnect());
    server.kill();
  }
});

test('four players can complete alias turns and finish a match', { timeout: 15000 }, async () => {
  const aliasPort = 3212;
  const aliasUrl = `http://127.0.0.1:${aliasPort}`;
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(aliasPort), NODE_ENV: 'production' },
    stdio: 'ignore',
  });
  const sockets = [];
  try {
    assert.equal((await waitForServer(`${aliasUrl}/api/health`)).status, 200);
    const catalog = await fetch(`${aliasUrl}/api/games/alias/catalog`).then((response) => response.json());
    assert.equal(catalog.definition.status, 'mvp');
    assert.equal(catalog.dictionaries[0].name, 'На каждый день');

    for (let index = 0; index < 4; index += 1) {
      const socket = io(aliasUrl, { transports: ['websocket'] });
      sockets.push(socket);
      await new Promise((resolve) => socket.once('connect', resolve));
      socket.emit('identify', { playerId: `a${index + 1}` });
    }

    const created = await request(sockets[0], 'create_room', { playerId: 'a1', name: 'Host', gameId: 'alias' });
    const roomId = created.room.id;
    assert.equal(created.room.gameId, 'alias');
    assert.deepEqual(created.room.scores, { team_1: 0, team_2: 0 });
    await Promise.all(sockets.slice(1).map((socket, index) => request(socket, 'join_room', { playerId: `a${index + 2}`, name: `A${index + 2}`, code: created.room.code })));
    await request(sockets[0], 'update_settings', { roomId, settings: { roundSeconds: 60, targetScore: 10 } });
    await Promise.all(sockets.slice(1).map((socket) => request(socket, 'set_ready', { roomId, ready: true })));

    const firstTurn = waitFor(sockets[0], 'room_updated', (room) => room.round?.phase === 'alias_turn');
    await request(sockets[0], 'start_round', { roomId });
    const playing = await firstTurn;
    assert.equal(playing.gameId, 'alias');
    assert.equal(playing.round.teamId, 'team_1');
    assert.equal(playing.aliasTeams.length, 2);
    const firstWord = playing.round.word;

    const correctUpdate = waitFor(sockets[0], 'room_updated', (room) => room.round?.correct === 1);
    await request(sockets[1], 'alias_mark_word', { roomId, result: 'correct' });
    const afterCorrect = await correctUpdate;
    assert.notEqual(afterCorrect.round.word, firstWord);
    const skipUpdate = waitFor(sockets[0], 'room_updated', (room) => room.round?.skipped === 1);
    await request(sockets[2], 'alias_mark_word', { roomId, result: 'skip' });
    assert.equal((await skipUpdate).round.skipped, 1);
    await request(sockets[3], 'alias_mark_word', { roomId, result: 'correct' });

    const firstResult = waitFor(sockets[0], 'room_updated', (room) => room.state === 'round_result');
    await request(sockets[0], 'alias_finish_turn', { roomId });
    const resultRoom = await firstResult;
    assert.equal(resultRoom.round.result.teamId, 'team_1');
    assert.equal(resultRoom.round.result.correct, 2);
    assert.equal(resultRoom.round.result.skipped, 1);
    assert.equal(resultRoom.scores.team_1, 2);

    const secondTurn = waitFor(sockets[0], 'room_updated', (room) => room.round?.phase === 'alias_turn' && room.round.teamId === 'team_2');
    await request(sockets[0], 'next_round', { roomId });
    const secondPlaying = await secondTurn;
    assert.equal(secondPlaying.round.teamName, 'Команда 2');

    for (let score = 1; score <= 10; score += 1) {
      const scoreUpdate = waitFor(sockets[0], 'room_updated', (room) => room.round?.teamId === 'team_2' && room.round?.correct === score);
      await request(sockets[0], 'alias_mark_word', { roomId, result: 'correct' });
      await scoreUpdate;
    }
    const matchResult = waitFor(sockets[0], 'room_updated', (room) => room.state === 'match_result');
    await request(sockets[0], 'alias_finish_turn', { roomId });
    const finished = await matchResult;
    assert.equal(finished.round.result.teamId, 'team_2');
    assert.equal(finished.scores.team_2, 10);
  } finally {
    sockets.forEach((socket) => socket.disconnect());
    server.kill();
  }
});
