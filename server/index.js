import { createServer } from 'node:http';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import {
  addPlayer,
  allRooms,
  cleanupInactiveRooms,
  createRoom,
  getRoom,
  getRoomByCode,
  publicRoom,
  removePlayer,
  restoreRooms,
  touchRoom,
  updateRoomSettings,
  uniquePlayerName,
} from './roomStore.js';
import { connectRoomPersistence, loadRoomSnapshot, scheduleRoomSnapshot } from './roomPersistence.js';
import { checkHttpRate, checkRate, cleanupExpiredRateLimits } from './lib/rateLimit.js';
import { sendSystemEmail } from './lib/mailer.js';
import { verifyVkLaunch } from './lib/vk.js';
import { canonicalRedirectTarget, createPublicPageHandler } from './publicPages.js';
import { cleanAvatarDataUrl, cleanName, cleanPlayerId } from './lib/validators.js';
import { persistProfiles, persistRooms } from './lib/persist.js';
import {
  createYooKassaPayment,
  demoCheckoutEnabled,
  handleYooKassaWebhook,
  syncYooKassaOrder,
  yooKassaConfig,
} from './lib/yookassa.js';
import { roomThemes } from './lib/roomThemes.js';
import { adminRouter } from './routes/admin.js';
import { feedbackRouter } from './routes/feedback.js';
import { authRouter } from './routes/auth.js';
import {
  createSpyRound,
  getSpyDictionary,
  getSpyBundle,
  getSpyLocations,
  getSpyPlayerCard,
  listSpyDictionaries,
  listSpyBundles,
  spyDefinition,
} from './games/spy/index.js';
import {
  activateDemoPro,
  activateDemoPlan,
  activatePartyPass,
  addCustomLocation,
  attachOrderPayment,
  confirmDemoOrder,
  createOrder,
  unlockCustomDictionary,
  getOrCreateProfile,
  hasAdFreeAccess,
  hasAnyThemePass,
  hasTimedGameAccess,
  publicProfile,
  unlockDemoDictionary,
  unlockBundle,
  recordGame,
  restoreProfiles,
  updateProfileAvatar,
  updateProfileName,
} from './profileStore.js';
import { connectProfilePersistence, loadProfileSnapshot, scheduleProfileSnapshot } from './profilePersistence.js';
import { connectAnalyticsPersistence, restoreAnalyticsSnapshot, track } from './analyticsStore.js';
import { aliasDefinition, aliasDictionaryPreview, createAliasRound, createAliasTeams, nextAliasWord } from './games/alias/index.js';
import {
  bunkerActiveContestants,
  bunkerCardFields,
  bunkerContentPacks,
  bunkerDefinition,
  continueBunkerRound,
  createBunkerRound,
  currentBunkerRevealPlayer,
  getBunkerPlayerCard,
  publicBunkerCards,
  startBunkerAfterBriefing,
} from './games/bunker/index.js';
import { chooseTruthDarePrompt, createTruthDareRound, finishTruthDareTurn, refuseTruthDare, submitTruthDareAnswer, truthDareDecks, truthDareDefinition, truthDareJury, voteTruthDare } from './games/truthdare/index.js';
import { getContentThemeIds, listThemePasses } from './games/thematicPasses.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });
const port = Number(process.env.PORT || 3100);
const inactiveRoomTtlMs = Number(process.env.ROOM_TTL_MS || 6 * 60 * 60 * 1000);

app.use((request, response, next) => {
  if (process.env.NODE_ENV !== 'production') return next();
  const target = canonicalRedirectTarget(request.get('host'), request.originalUrl);
  return target ? response.redirect(301, target) : next();
});
app.use(express.json({ limit: '64kb' }));

app.get('/api/health', (_request, response) => response.json({ ok: true }));
// Публичный статус — только здоровье сервиса. Аналитика содержит id игроков,
// user-agent'ы и рекламные кампании, поэтому живёт только в /api/admin/overview
// под ADMIN_PIN.
app.get('/api/status', (_request, response) => response.json({ ok: true, games: ['spy', 'alias', 'bunker', 'truthdare'], activeRooms: allRooms().length }));
app.get('/api/games', (_request, response) => response.json({ games: [spyDefinition, aliasDefinition, bunkerDefinition, truthDareDefinition] }));
app.use('/api', feedbackRouter);
app.post('/api/vk/launch', (request, response) => {
  const result = verifyVkLaunch(request.body?.params || {}, process.env.VK_APP_SECRET);
  response.json(result);
});
app.post('/api/yookassa/webhook', async (request, response) => {
  try {
    const result = await handleYooKassaWebhook(request.body || {});
    response.json({ ok: true, ...result });
  } catch (error) {
    response.status(error.status || 400).json({ ok: false, error: error.message || 'YooKassa webhook failed' });
  }
});
app.use('/api/auth', authRouter);
function withThemeIds(gameId, items = []) {
  return items.map((item) => ({ ...item, themeIds: getContentThemeIds(gameId, item.id) }));
}

app.get('/api/games/alias/catalog', (_request, response) => response.json({ definition: aliasDefinition, dictionaries: withThemeIds('alias', aliasDictionaryPreview) }));
app.get('/api/games/bunker/catalog', (_request, response) => response.json({ definition: bunkerDefinition, fields: bunkerCardFields, contentPacks: withThemeIds('bunker', bunkerContentPacks) }));
app.get('/api/games/spy/catalog', (_request, response) => response.json({
  definition: spyDefinition,
  dictionaries: withThemeIds('spy', listSpyDictionaries()),
  bundles: listSpyBundles(),
  aliasDictionaries: withThemeIds('alias', aliasDictionaryPreview),
  bunkerContentPacks: withThemeIds('bunker', bunkerContentPacks),
  subscriptions: [{ id: 'pro', name: 'PRO на месяц', priceRub: 299 }],
  gamePasses: [
    { id: 'spy_pass', name: 'Spy Pass', gameId: 'spy', priceRub: 99 },
    { id: 'alias_pass', name: 'Alias Pass', gameId: 'alias', priceRub: 99 },
    { id: 'bunker_pass', name: 'Bunker Pass', gameId: 'bunker', priceRub: 99 },
  ],
  themePasses: listThemePasses(),
  truthDareDecks: withThemeIds('truthdare', truthDareDecks),
  passes: [{ id: 'party_pass_24h', name: 'WeekendPass', hours: 24, priceRub: 149 }],
  themes: roomThemes,
}));
app.get('/api/games/spy/locations', (_request, response) => response.json({
  locations: getSpyLocations(['base']).map(({ id, name }) => ({ id, name })),
}));
app.use('/api/admin', adminRouter);

if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '..', 'dist');
  let buildId = 'unknown';
  try {
    buildId = JSON.parse(readFileSync(path.join(dist, 'version.json'), 'utf8')).buildId || buildId;
  } catch {
    // The app still starts if an old deployment has no build manifest yet.
  }
  app.use((request, response, next) => {
    const acceptsHtml = request.method === 'GET' && (
      request.get('sec-fetch-dest') === 'document'
      || request.get('accept')?.includes('text/html')
    );
    if (acceptsHtml) {
      response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      response.setHeader('Pragma', 'no-cache');
      response.setHeader('Expires', '0');
      const cookieBuild = request.headers.cookie?.match(/(?:^|;\s*)ghp_build=([^;]+)/)?.[1];
      if (cookieBuild !== buildId) {
        response.setHeader('Clear-Site-Data', '"cache"');
        response.append('Set-Cookie', `ghp_build=${encodeURIComponent(buildId)}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`);
      }
    }
    next();
  });
  const retireServiceWorker = (_request, response) => {
    response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    response.type('application/javascript').send("self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())await caches.delete(key);await self.registration.unregister();for(const client of await self.clients.matchAll({type:'window'}))client.navigate(client.url)})()));");
  };
  app.get(['/sw.js', '/service-worker.js'], retireServiceWorker);
  app.use(express.static(dist, {
    index: false,
    setHeaders(response, filePath) {
      // Хешированные ассеты Vite (/assets/index-abc123.js) неизменны — кэшируем навсегда.
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (filePath.endsWith('.html') || filePath.endsWith('version.json')) {
        response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        response.setHeader('Pragma', 'no-cache');
        response.setHeader('Expires', '0');
      } else {
        response.setHeader('Cache-Control', 'public, max-age=86400');
      }
    },
  }));
  app.get('/{*splat}', createPublicPageHandler(dist));
}

async function replyWith(callback, action) {
  try {
    callback?.({ ok: true, ...(await action()) });
  } catch (error) {
    callback?.({ ok: false, error: error.message || 'Ошибка' });
  }
}

function emitRoom(room) {
  touchRoom(room);
  scheduleRoomSnapshot(allRooms);
  const adPolicy = getRoomAdPolicy(room);
  for (const player of room.players) {
    io.to(`player:${player.id}`).emit('room_updated', publicRoom(room, player.id, { adPolicy }));
  }
}

function getRoomAdPolicy(room) {
  const sponsor = room.players.find((player) => hasAdFreeAccess(getOrCreateProfile(player.id, player.name), Date.now(), room.gameId));
  return {
    enabled: !sponsor,
    adFree: Boolean(sponsor),
    sponsorPlayerId: sponsor?.id || null,
    sponsorName: sponsor?.name || '',
    provider: 'adsterra',
    placements: sponsor ? [] : ['pre_round', 'post_round', 'lobby_player_banner'],
  };
}

function resetRoomGame(room, gameId) {
  if (!['spy', 'alias', 'bunker', 'truthdare'].includes(gameId) || room.gameId === gameId) return;
  room.gameId = gameId;
  room.settings = gameId === 'alias'
    ? { ...aliasDefinition.defaultSettings }
    : gameId === 'bunker'
      ? { ...bunkerDefinition.defaultSettings }
      : gameId === 'truthdare'
        ? { ...truthDareDefinition.defaultSettings }
        : { ...spyDefinition.defaultSettings };
  room.scores = gameId === 'alias'
    ? { team_1: 0, team_2: 0 }
    : gameId === 'bunker'
      ? { saved: 0, eliminated: 0 }
      : gameId === 'truthdare'
        ? {}
        : { civilians: 0, spies: 0 };
  room.aliasTeams = [];
  room.usedAliasWords = [];
  room.truthDareTurnIndex = -1;
  room.round = null;
  room.matchHistory = [];
  room.players.forEach((player) => { player.ready = player.id === room.hostId; });
}

function ownedThemeIds(playerId) {
  const profile = getOrCreateProfile(playerId);
  return new Set(['ghp', ...(profile.ownedThemeIds || [])]);
}

function assertThemeAvailable(playerId, themeId) {
  const safeThemeId = String(themeId || 'ghp').trim();
  if (!roomThemes.some((theme) => theme.id === safeThemeId)) throw new Error('Тема не найдена');
  if (!ownedThemeIds(playerId).has(safeThemeId)) throw new Error('Сначала купите эту тему');
  return safeThemeId;
}

function hasProAccess(profile, now = Date.now()) {
  return Boolean(profile?.pro || profile?.proPlus || Number(profile?.subscription?.activeUntil || 0) > now);
}

function assertTruthDareAccess(playerId) {
  if (!hasProAccess(getOrCreateProfile(playerId))) throw new Error('Правда или действие пока доступна только в PRO');
}



function setRoundResult(room, winner, reason, extra = {}) {
  if (!room.round || room.round.phase === 'result') return;
  const subjectType = room.round.subjectType || room.settings.subjectType || 'location';
  room.round.phase = 'result';
  room.round.result = {
    winner,
    reason,
    locationName: room.round.locationName,
    subjectType,
    spyId: room.round.spyId,
    spyIds: room.round.spyIds || [room.round.spyId],
    ...extra,
  };
  room.scores[winner] += 1;
  room.matchHistory ??= [];
  room.matchHistory.unshift({ round: room.round.number, winner, reason, locationName: room.round.locationName, subjectType, at: Date.now() });
  room.matchHistory = room.matchHistory.slice(0, 20);
  room.state = room.scores[winner] >= room.settings.targetScore ? 'match_result' : 'round_result';
  track('round_finished', { gameId: room.gameId || 'spy', winner, reason, roomId: room.id });
  recordGame(room);
  persistProfiles();
  emitRoom(room);
}

function activePlayers(room) {
  return room.players.filter((player) => player.online);
}

function requireRoomPlayer(room, playerId) {
  const player = room?.players.find((item) => item.id === playerId);
  if (!room || !player) throw new Error('Вы не состоите в этой комнате');
  return player;
}

function finishVote(room) {
  const counts = {};
  for (const targetId of Object.values(room.round.votes)) counts[targetId] = (counts[targetId] || 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const tied = sorted.length < 1 || (sorted[1] && sorted[0][1] === sorted[1][1]);
  if (tied) {
    if (room.round.voteRound >= 2) return setRoundResult(room, 'spies', 'vote_tie');
    const topCount = sorted[0]?.[1] || 0;
    room.round.voteRound += 1;
    room.round.voteCandidateIds = sorted.filter(([, count]) => count === topCount).map(([id]) => id);
    room.round.votes = {};
    room.round.votingEndsAt = Date.now() + room.settings.votingSeconds * 1000;
    emitRoom(room);
    return;
  }
  const votedOutId = sorted[0][0];
  const spyIds = room.round.spyIds || [room.round.spyId];
  setRoundResult(room, spyIds.includes(votedOutId) ? 'civilians' : 'spies', spyIds.includes(votedOutId) ? 'spy_found' : 'civilian_accused', { votedOutId, voteCounts: counts });
}

function civilianPlayers(room) {
  const spyIds = room.round?.spyIds || [room.round?.spyId];
  return activePlayers(room).filter((player) => !spyIds.includes(player.id));
}

function finishSpyGuessReview(room) {
  const votes = room.round.spyGuessVotes || {};
  const yes = Object.values(votes).filter(Boolean).length;
  const no = Object.values(votes).filter((vote) => vote === false).length;
  const accepted = yes > no;
  setRoundResult(room, accepted ? 'spies' : 'civilians', accepted ? 'spy_guess_accepted' : 'spy_guess_rejected', {
    spyGuessVotes: { yes, no },
  });
}

function finishAliasTurn(room) {
  if (!room.round || room.round.phase !== 'alias_turn') return;
  const gained = Number(room.round.correct || 0);
  room.scores[room.round.teamId] = (room.scores[room.round.teamId] || 0) + gained;
  room.usedAliasWords = [...new Set([...(room.usedAliasWords || []), ...(room.round.wordsSeen || [])])].slice(-80);
  room.round.phase = 'result';
  room.round.result = {
    winner: room.round.teamId,
    teamId: room.round.teamId,
    teamName: room.round.teamName,
    correct: room.round.correct || 0,
    skipped: room.round.skipped || 0,
    gained,
  };
  room.matchHistory ??= [];
  room.matchHistory.unshift({ round: room.round.number, winner: room.round.teamId, teamName: room.round.teamName, gained, at: Date.now() });
  room.matchHistory = room.matchHistory.slice(0, 20);
  room.state = room.scores[room.round.teamId] >= room.settings.targetScore ? 'match_result' : 'round_result';
  track('round_finished', { gameId: 'alias', winner: room.round.teamId, reason: 'turn_finished', roomId: room.id });
  emitRoom(room);
}

function finishBunkerVote(room) {
  const contestants = bunkerActiveContestants(room);
  const counts = {};
  for (const targetId of Object.values(room.round.votes)) counts[targetId] = (counts[targetId] || 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const tied = sorted.length < 1 || (sorted[1] && sorted[0][1] === sorted[1][1]);
  if (tied) {
    if (room.round.voteRound >= 2) {
      room.round.phase = 'result';
      room.round.result = { reason: 'vote_tie', eliminatedId: null, voteCounts: counts, savedIds: contestants.map((player) => player.id) };
      room.state = 'round_result';
      track('round_finished', { gameId: 'bunker', reason: 'vote_tie', roomId: room.id });
      emitRoom(room);
      return;
    }
    const topCount = sorted[0]?.[1] || 0;
    room.round.voteRound += 1;
    room.round.voteCandidateIds = sorted.filter(([, count]) => count === topCount).map(([id]) => id);
    room.round.votes = {};
    room.round.votingEndsAt = Date.now() + room.settings.votingSeconds * 1000;
    emitRoom(room);
    return;
  }
  const eliminatedId = sorted[0][0];
  if (!room.round.eliminatedIds.includes(eliminatedId)) room.round.eliminatedIds.push(eliminatedId);
  const savedIds = bunkerActiveContestants(room).map((player) => player.id);
  room.scores = { saved: savedIds.length, eliminated: room.round.eliminatedIds.length };
  room.round.phase = 'result';
  room.round.result = { reason: 'voted_out', eliminatedId, voteCounts: counts, savedIds };
  room.matchHistory ??= [];
  room.matchHistory.unshift({ round: room.round.number, eliminatedId, savedCount: savedIds.length, at: Date.now() });
  room.matchHistory = room.matchHistory.slice(0, 20);
  room.state = savedIds.length <= room.round.shelterCapacity ? 'match_result' : 'round_result';
  track('round_finished', { gameId: 'bunker', reason: 'voted_out', roomId: room.id });
  emitRoom(room);
}

function finishBunkerByCapacity(room) {
  const savedIds = bunkerActiveContestants(room).map((player) => player.id);
  room.scores = { saved: savedIds.length, eliminated: room.round.eliminatedIds?.length || 0 };
  room.round.phase = 'result';
  room.round.result = { reason: 'capacity_reached', eliminatedId: null, voteCounts: {}, savedIds };
  room.state = 'match_result';
  track('round_finished', { gameId: 'bunker', reason: 'capacity_reached', roomId: room.id });
  emitRoom(room);
}

function startBunkerDiscussion(room) {
  room.round.phase = 'discussion';
  room.round.startedAt = Date.now();
  room.round.endsAt = Date.now() + room.settings.roundSeconds * 1000;
  room.round.voteStartRequestIds = [];
  emitRoom(room);
}

function startVoting(room) {
  if (!room.round || room.round.phase !== 'discussion') return;
  room.round.phase = 'voting';
  room.round.votes = {};
  room.round.voteRound = 1;
  room.round.voteCandidateIds = null;
  room.round.voteStartRequestIds = [];
  room.round.votingEndsAt = Date.now() + room.settings.votingSeconds * 1000;
  emitRoom(room);
}

function maybeAdvanceRound(room) {
  if (!room.round) return;
  if (room.gameId === 'alias') {
    if (room.round.phase === 'alias_turn' && room.round.endsAt <= Date.now()) finishAliasTurn(room);
    return;
  }
  if (room.gameId === 'bunker') {
    const activeIds = bunkerActiveContestants(room).map((player) => player.id);
    if (room.round.phase === 'briefing' && activeIds.every((id) => room.round.acceptedRuleIds?.includes(id))) {
      startBunkerAfterBriefing(room);
      emitRoom(room);
    } else if (room.round.phase === 'role_reveal' && activeIds.every((id) => room.round.seenIds.includes(id))) {
      startBunkerDiscussion(room);
    } else if (room.round.phase === 'voting' && activeIds.every((id) => room.round.votes[id])) {
      finishBunkerVote(room);
    }
    return;
  }
  const activeIds = activePlayers(room).map((player) => player.id);
  if (room.round.phase === 'role_reveal' && activeIds.every((id) => room.round.seenIds.includes(id))) {
    room.round.phase = 'discussion';
    room.round.startedAt = Date.now();
    room.round.endsAt = Date.now() + room.settings.roundSeconds * 1000;
    emitRoom(room);
  } else if (room.round.phase === 'voting' && activeIds.every((id) => room.round.votes[id])) {
    finishVote(room);
  } else if (room.round.phase === 'guess_review' && civilianPlayers(room).every((player) => room.round.spyGuessVotes?.[player.id] !== undefined)) {
    finishSpyGuessReview(room);
  }
}

function cancelRound(room) {
  room.round = null;
  room.state = 'lobby';
  room.players.forEach((player) => { player.ready = player.id === room.hostId; });
  emitRoom(room);
}

io.on('connection', (socket) => {
  socket.on('identify', ({ playerId }) => {
    if (!playerId) return;
    socket.data.playerId = String(playerId);
    socket.join(`player:${playerId}`);
    getOrCreateProfile(playerId);
    const room = allRooms().find((item) => item.players.some((player) => player.id === String(playerId)));
    const player = room?.players.find((item) => item.id === String(playerId));
    if (room && player) {
      socket.data.roomId = room.id;
      player.online = true;
      emitRoom(room);
    }
  });

  socket.on('create_room', (payload, callback) => replyWith(callback, () => {
    checkRate(socket, 'create_room', 3, 60000);
    const playerId = cleanPlayerId(payload.playerId);
    const gameId = ['alias', 'bunker', 'truthdare'].includes(payload.gameId) ? payload.gameId : 'spy';
    if (gameId === 'truthdare') assertTruthDareAccess(playerId);
    const room = createRoom({ hostId: playerId, hostName: cleanName(payload.name), gameId });
    track('room_created', { gameId, playerId, roomId: room.id });
    updateProfileName(playerId, room.players[0].name);
    persistProfiles();
    socket.data.playerId = playerId;
    socket.data.roomId = room.id;
    socket.join(`player:${playerId}`);
    emitRoom(room);
    return { room: publicRoom(room, playerId, { adPolicy: getRoomAdPolicy(room) }) };
  }));

  socket.on('join_room', (payload, callback) => replyWith(callback, () => {
    checkRate(socket, 'join_room', 15, 60000);
    const room = getRoomByCode(payload.code);
    if (!room) throw new Error('Комната не найдена');
    const playerId = cleanPlayerId(payload.playerId);
    addPlayer(room, { playerId, name: cleanName(payload.name) });
    track('room_joined', { gameId: room.gameId || 'spy', playerId, roomId: room.id });
    updateProfileName(playerId, room.players.find((player) => player.id === playerId).name);
    persistProfiles();
    socket.data.playerId = playerId;
    socket.data.roomId = room.id;
    socket.join(`player:${playerId}`);
    emitRoom(room);
    return { room: publicRoom(room, playerId, { adPolicy: getRoomAdPolicy(room) }) };
  }));

  socket.on('resume_room', (payload, callback) => replyWith(callback, () => {
    const room = getRoom(payload.roomId);
    if (!room || !room.players.some((player) => player.id === payload.playerId)) throw new Error('Комната недоступна');
    const player = room.players.find((item) => item.id === payload.playerId);
    player.online = true;
    socket.data.playerId = payload.playerId;
    socket.data.roomId = room.id;
    socket.join(`player:${payload.playerId}`);
    emitRoom(room);
    return { room: publicRoom(room, payload.playerId, { adPolicy: getRoomAdPolicy(room) }) };
  }));

  socket.on('set_ready', ({ roomId, ready }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    const player = room?.players.find((item) => item.id === socket.data.playerId);
    if (!room || !player || room.state !== 'lobby') throw new Error('Действие недоступно');
    player.ready = player.id === room.hostId ? true : Boolean(ready);
    emitRoom(room);
    return {};
  }));

  socket.on('rename_player', ({ roomId, name }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    const player = room?.players.find((item) => item.id === socket.data.playerId);
    if (!room || !player || room.state !== 'lobby') throw new Error('Имя можно менять только в лобби');
    player.name = uniquePlayerName(room, cleanName(name), player.id);
    updateProfileName(player.id, player.name);
    persistProfiles();
    emitRoom(room);
    return { name: player.name };
  }));

  socket.on('change_game', ({ roomId, gameId }, callback) => replyWith(callback, () => {
    checkRate(socket, 'change_game', 12, 10000);
    const room = getRoom(roomId);
    if (!room || room.hostId !== socket.data.playerId || room.state !== 'lobby') throw new Error('Только хост может менять игру в лобби');
    if (String(gameId || 'spy') === 'truthdare') assertTruthDareAccess(socket.data.playerId);
    resetRoomGame(room, String(gameId || 'spy'));
    emitRoom(room);
    return { room: publicRoom(room, socket.data.playerId, { adPolicy: getRoomAdPolicy(room) }) };
  }));

  socket.on('update_settings', ({ roomId, settings }, callback) => replyWith(callback, () => {
    checkRate(socket, 'settings', 20, 10000);
    const room = getRoom(roomId);
    if (!room || room.hostId !== socket.data.playerId || room.state !== 'lobby') throw new Error('Только хост может менять настройки');
    if (room.gameId === 'spy' && settings.dictionaryIds) {
      const profile = getOrCreateProfile(socket.data.playerId);
      const hasPartyPass = profile.partyPasses?.some((pass) => pass.activeUntil > Date.now());
      const freeDictionaryIds = listSpyDictionaries().filter((dictionary) => dictionary.free).map((dictionary) => dictionary.id);
      const hasSpyAccess = hasTimedGameAccess(profile, 'spy') || hasPartyPass;
      const allowed = new Set(hasSpyAccess
        ? listSpyDictionaries().map((dictionary) => dictionary.id)
        : listSpyDictionaries()
          .filter((dictionary) => freeDictionaryIds.includes(dictionary.id) || (profile.ownedDictionaryIds || []).includes(dictionary.id) || hasAnyThemePass(profile, getContentThemeIds('spy', dictionary.id)))
          .map((dictionary) => dictionary.id));
      if (settings.dictionaryIds.some((id) => !allowed.has(id))) throw new Error('Сначала приобретите этот словарь');
    }
    if (room.gameId === 'spy' && Number(settings.spyCount || 0) > 1) {
      const profile = getOrCreateProfile(socket.data.playerId);
      if (!hasTimedGameAccess(profile, 'spy')) throw new Error('Больше одного шпиона доступно в PRO, WeekendPass или Spy Pass');
    }
    if (room.gameId === 'alias' && settings.dictionaryIds) {
      const profile = getOrCreateProfile(socket.data.playerId);
      const hasPartyPass = profile.partyPasses?.some((pass) => pass.activeUntil > Date.now());
      const hasAliasAccess = hasTimedGameAccess(profile, 'alias') || hasPartyPass;
      const freeIds = aliasDictionaryPreview.filter((dictionary) => dictionary.free).map((dictionary) => dictionary.id);
      const allowed = new Set(hasAliasAccess
        ? aliasDictionaryPreview.map((dictionary) => dictionary.id)
        : aliasDictionaryPreview
          .filter((dictionary) => freeIds.includes(dictionary.id) || hasAnyThemePass(profile, getContentThemeIds('alias', dictionary.id)))
          .map((dictionary) => dictionary.id));
      if (settings.dictionaryIds.some((id) => !allowed.has(id))) throw new Error('Этот набор Alias доступен в Alias Pass, WeekendPass, тематическом пропуске или PRO');
    }
    if (room.gameId === 'bunker' && settings.contentPackIds) {
      const profile = getOrCreateProfile(socket.data.playerId);
      const hasPartyPass = profile.partyPasses?.some((pass) => pass.activeUntil > Date.now());
      const hasBunkerAccess = hasTimedGameAccess(profile, 'bunker') || hasPartyPass;
      for (const packId of settings.contentPackIds) {
        const pack = bunkerContentPacks.find((item) => item.id === packId);
        if (pack && !pack.free && pack.tier !== 'free' && !hasBunkerAccess && !hasAnyThemePass(profile, getContentThemeIds('bunker', pack.id))) throw new Error('Этот сценарий Бункера доступен в Bunker Pass, WeekendPass, тематическом пропуске или PRO');
      }
    }
    if (room.gameId === 'truthdare' && settings.decks) {
      const profile = getOrCreateProfile(socket.data.playerId);
      for (const deckId of settings.decks) {
        const deck = truthDareDecks.find((item) => item.id === deckId);
        const hasDeckAccess = hasTimedGameAccess(profile, 'truthdare') || hasAnyThemePass(profile, getContentThemeIds('truthdare', deck?.id));
        if (deck && !deck.free && deck.tier !== 'free' && !hasDeckAccess) throw new Error('Этот набор доступен в тематическом пропуске или PRO');
      }
    }
    updateRoomSettings(room, settings);
    emitRoom(room);
    return {};
  }));

  socket.on('apply_room_theme', ({ roomId, themeId }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    if (!room || room.hostId !== socket.data.playerId || room.state !== 'lobby') throw new Error('Только хост может менять тему');
    const safeThemeId = assertThemeAvailable(socket.data.playerId, themeId);
    room.themeId = safeThemeId;
    room.themeSuggestions = (room.themeSuggestions || []).filter((suggestion) => suggestion.themeId !== safeThemeId);
    emitRoom(room);
    return {};
  }));

  socket.on('suggest_room_theme', ({ roomId, themeId }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    const player = room?.players.find((item) => item.id === socket.data.playerId);
    if (!room || !player || room.state !== 'lobby') throw new Error('Тему можно предложить только в лобби');
    const safeThemeId = assertThemeAvailable(socket.data.playerId, themeId);
    if (room.themeId === safeThemeId) return {};
    room.themeSuggestions = [
      ...(room.themeSuggestions || []).filter((suggestion) => suggestion.playerId !== player.id && suggestion.themeId !== safeThemeId),
      { playerId: player.id, playerName: player.name, themeId: safeThemeId, createdAt: Date.now() },
    ].slice(-5);
    emitRoom(room);
    return {};
  }));

  socket.on('accept_room_theme', ({ roomId, playerId, themeId }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    if (!room || room.hostId !== socket.data.playerId || room.state !== 'lobby') throw new Error('Только хост может принять тему');
    const suggestion = (room.themeSuggestions || []).find((item) => item.playerId === playerId && item.themeId === themeId);
    if (!suggestion) throw new Error('Предложение не найдено');
    assertThemeAvailable(playerId, themeId);
    room.themeId = suggestion.themeId;
    room.themeSuggestions = (room.themeSuggestions || []).filter((item) => item !== suggestion);
    emitRoom(room);
    return {};
  }));

  socket.on('start_round', ({ roomId }, callback) => replyWith(callback, () => {
    checkRate(socket, 'start_round', 5, 10000);
    const room = getRoom(roomId);
    if (!room || room.hostId !== socket.data.playerId) throw new Error('Только хост может начать раунд');
    if (room.state !== 'lobby') throw new Error('Раунд уже идёт');
    room.players = room.players.filter((player) => player.online);
    if (room.gameId === 'alias') {
      if (room.players.length < aliasDefinition.minPlayers) throw new Error('Нужно минимум 4 игрока');
      if (!room.players.every((player) => player.ready)) throw new Error('Не все игроки готовы');
      room.aliasTeams = createAliasTeams(room.players);
      room.round = createAliasRound(room);
      track('round_started', { gameId: 'alias', roomId: room.id, playersCount: room.players.length });
      room.state = 'playing';
      emitRoom(room);
      return {};
    }
    if (room.gameId === 'bunker') {
      if (room.players.length < bunkerDefinition.minPlayers) throw new Error('Нужно минимум 4 игрока');
      if (!room.players.every((player) => player.ready)) throw new Error('Не все игроки готовы');
      room.round = createBunkerRound(room);
      room.scores = { saved: room.players.length, eliminated: 0 };
      track('round_started', { gameId: 'bunker', roomId: room.id, playersCount: room.players.length });
      room.state = 'playing';
      emitRoom(room);
      return {};
    }
    if (room.gameId === 'truthdare') {
      assertTruthDareAccess(socket.data.playerId);
      if (room.players.length < truthDareDefinition.minPlayers) throw new Error('Нужно минимум 2 игрока');
      if (!room.players.every((player) => player.ready)) throw new Error('Не все игроки готовы');
      room.scores = Object.fromEntries(room.players.map((player) => [player.id, room.scores?.[player.id] || 0]));
      room.round = createTruthDareRound(room);
      track('round_started', { gameId: 'truthdare', roomId: room.id, playersCount: room.players.length });
      room.state = 'playing';
      emitRoom(room);
      return {};
    }
    if (room.players.length < spyDefinition.minPlayers) throw new Error('Нужно минимум 3 игрока');
    if (!room.players.every((player) => player.ready)) throw new Error('Не все игроки готовы');
    room.customLocations = getOrCreateProfile(room.hostId).customLocations || [];
    room.round = createSpyRound(room);
    track('round_started', { gameId: 'spy', mode: room.settings.mode, roomId: room.id, playersCount: room.players.length });
    room.lastLocations = [...room.lastLocations, room.round.locationId].slice(-5);
    room.state = 'playing';
    emitRoom(room);
    return {};
  }));

  socket.on('get_role', ({ roomId }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    requireRoomPlayer(room, socket.data.playerId);
    if (!room?.round) throw new Error('Раунд не найден');
    if (room.gameId === 'bunker') return { card: getBunkerPlayerCard(room, socket.data.playerId) };
    return { card: getSpyPlayerCard(room, socket.data.playerId) };
  }));

  socket.on('role_seen', ({ roomId }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    if (!room?.round || room.round.phase !== 'role_reveal') throw new Error('Действие недоступно');
    requireRoomPlayer(room, socket.data.playerId);
    if (room.gameId === 'bunker' && room.round.eliminatedIds?.includes(socket.data.playerId)) throw new Error('Исключённый игрок уже не открывает карточку');
    if (!room.round.seenIds.includes(socket.data.playerId)) room.round.seenIds.push(socket.data.playerId);
    maybeAdvanceRound(room);
    if (room.round.phase === 'role_reveal') emitRoom(room);
    return {};
  }));

  socket.on('bunker_accept_rules', ({ roomId }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    requireRoomPlayer(room, socket.data.playerId);
    if (room?.gameId !== 'bunker' || room.round?.phase !== 'briefing') throw new Error('Действие недоступно');
    room.round.acceptedRuleIds ??= [];
    if (!room.round.acceptedRuleIds.includes(socket.data.playerId)) room.round.acceptedRuleIds.push(socket.data.playerId);
    maybeAdvanceRound(room);
    if (room.round.phase === 'briefing') emitRoom(room);
    return {};
  }));

  socket.on('bunker_reveal_field', ({ roomId, fieldId, revealed }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    requireRoomPlayer(room, socket.data.playerId);
    if (room?.gameId !== 'bunker' || room.round?.phase !== 'public_reveal') throw new Error('Вскрытие карточек сейчас не идёт');
    if (currentBunkerRevealPlayer(room) !== socket.data.playerId) throw new Error('Сейчас вскрывается другой игрок');
    if (!bunkerCardFields.some((field) => field.id === fieldId)) throw new Error('Поле карточки не найдено');
    room.round.bunkerReveals ??= {};
    room.round.bunkerReveals[socket.data.playerId] ??= {};
    room.round.bunkerReveals[socket.data.playerId][fieldId] = Boolean(revealed);
    emitRoom(room);
    return {};
  }));

  socket.on('bunker_finish_reveal_turn', ({ roomId }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    requireRoomPlayer(room, socket.data.playerId);
    if (room?.gameId !== 'bunker' || room.round?.phase !== 'public_reveal') throw new Error('Вскрытие карточек сейчас не идёт');
    if (currentBunkerRevealPlayer(room) !== socket.data.playerId) throw new Error('Сейчас вскрывается другой игрок');
    const order = room.round.revealOrder || [];
    room.round.currentRevealIndex = (room.round.currentRevealIndex || 0) + 1;
    if (room.round.currentRevealIndex >= order.length) startBunkerDiscussion(room);
    else emitRoom(room);
    return {};
  }));

  socket.on('start_vote', ({ roomId }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    if (!room || room.hostId !== socket.data.playerId) throw new Error('Только хост начинает голосование');
    startVoting(room);
    return {};
  }));

  socket.on('request_vote', ({ roomId }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    requireRoomPlayer(room, socket.data.playerId);
    if (!room.round || room.round.phase !== 'discussion') throw new Error('Действие недоступно');
    room.round.voteStartRequestIds ??= [];
    if (!room.round.voteStartRequestIds.includes(socket.data.playerId)) room.round.voteStartRequestIds.push(socket.data.playerId);
    if (room.round.voteStartRequestIds.length > activePlayers(room).length / 2) startVoting(room);
    else emitRoom(room);
    return {};
  }));

  socket.on('get_profile', (_payload, callback) => replyWith(callback, () => ({
    profile: publicProfile(getOrCreateProfile(socket.data.playerId)),
  })));

  socket.on('update_profile', ({ name, avatarDataUrl }, callback) => replyWith(callback, () => {
    checkRate(socket, 'update_profile', 20, 60000);
    let profile = getOrCreateProfile(socket.data.playerId);
    if (name !== undefined) profile = updateProfileName(socket.data.playerId, cleanName(name));
    if (avatarDataUrl !== undefined) profile = updateProfileAvatar(socket.data.playerId, cleanAvatarDataUrl(avatarDataUrl));
    persistProfiles();
    return { profile: publicProfile(profile) };
  }));

  socket.on('create_order', ({ type, productId, months }, callback) => replyWith(callback, async () => {
    checkRate(socket, 'create_order', 20, 60000);
    const currentProfile = getOrCreateProfile(socket.data.playerId);
    if (!currentProfile.email) throw new Error('Войдите или зарегистрируйтесь, чтобы оформить покупку.');
    if (!yooKassaConfig().enabled && !demoCheckoutEnabled()) throw new Error('Оплата временно недоступна. Напишите в поддержку, если покупка нужна сейчас.');
    const { profile, order } = createOrder(socket.data.playerId, { type, productId, months });
    const payment = await createYooKassaPayment(profile, order);
    if (payment) attachOrderPayment(socket.data.playerId, order.id, {
      provider: 'yookassa',
      paymentId: payment.id,
      paymentUrl: payment.confirmationUrl,
      paymentStatus: payment.status,
    });
    track('order_created', { type, productId, playerId: profile.id, amountRub: order.amountRub, provider: payment ? 'yookassa' : 'demo' });
    persistProfiles();
    return {
      profile: publicProfile(profile),
      order,
      payment: payment ? { provider: 'yookassa', id: payment.id, confirmationUrl: payment.confirmationUrl } : null,
    };
  }));

  socket.on('confirm_demo_order', ({ orderId }, callback) => replyWith(callback, () => {
    checkRate(socket, 'confirm_demo_order', 20, 60000);
    if (!demoCheckoutEnabled()) throw new Error('Тестовое подтверждение заказов отключено на продакшене.');
    const { profile, order } = confirmDemoOrder(socket.data.playerId, orderId);
    track('order_paid', { type: order.type, productId: order.productId, playerId: profile.id, amountRub: order.amountRub, provider: 'demo' });
    persistProfiles();
    const room = socket.data.roomId ? getRoom(socket.data.roomId) : null;
    if (room) emitRoom(room);
    return { profile: publicProfile(profile), order };
  }));

  socket.on('sync_order', ({ orderId }, callback) => replyWith(callback, async () => {
    checkRate(socket, 'sync_order', 20, 60000);
    const { profile, order } = await syncYooKassaOrder(socket.data.playerId, orderId);
    const room = socket.data.roomId ? getRoom(socket.data.roomId) : null;
    if (room) emitRoom(room);
    return { profile: publicProfile(profile), order };
  }));

  socket.on('unlock_demo_dictionary', ({ dictionaryId }, callback) => replyWith(callback, () => {
    const dictionary = getSpyDictionary(dictionaryId);
    if (!dictionary) throw new Error('Набор не найден');
    const profile = unlockDemoDictionary(socket.data.playerId, dictionary);
    persistProfiles();
    return { profile: publicProfile(profile) };
  }));

  socket.on('unlock_bundle', ({ bundleId }, callback) => replyWith(callback, () => {
    const bundle = getSpyBundle(bundleId);
    if (!bundle) throw new Error('Пак не найден');
    const profile = unlockBundle(socket.data.playerId, bundle);
    persistProfiles();
    return { profile: publicProfile(profile) };
  }));

  socket.on('activate_demo_pro', (_payload, callback) => replyWith(callback, () => {
    const profile = activateDemoPro(socket.data.playerId);
    persistProfiles();
    const room = socket.data.roomId ? getRoom(socket.data.roomId) : null;
    if (room) emitRoom(room);
    return { profile: publicProfile(profile) };
  }));

  socket.on('activate_demo_plan', ({ plan, months }, callback) => replyWith(callback, () => {
    const profile = activateDemoPlan(socket.data.playerId, plan, months);
    persistProfiles();
    const room = socket.data.roomId ? getRoom(socket.data.roomId) : null;
    if (room) emitRoom(room);
    return { profile: publicProfile(profile) };
  }));

  socket.on('add_custom_location', ({ location }, callback) => replyWith(callback, () => {
    const profile = addCustomLocation(socket.data.playerId, location);
    persistProfiles();
    return { profile: publicProfile(profile) };
  }));

  socket.on('unlock_custom_dictionary', (_payload, callback) => replyWith(callback, () => {
    const profile = unlockCustomDictionary(socket.data.playerId);
    persistProfiles();
    return { profile: publicProfile(profile) };
  }));

  socket.on('activate_party_pass', ({ hours }, callback) => replyWith(callback, () => {
    const profile = activatePartyPass(socket.data.playerId, hours);
    persistProfiles();
    const room = socket.data.roomId ? getRoom(socket.data.roomId) : null;
    if (room) emitRoom(room);
    return { profile: publicProfile(profile) };
  }));

  socket.on('vote', ({ roomId, targetId }, callback) => replyWith(callback, () => {
    checkRate(socket, 'vote', 10, 10000);
    const room = getRoom(roomId);
    requireRoomPlayer(room, socket.data.playerId);
    if (!room?.round || room.round.phase !== 'voting') throw new Error('Голосование не идёт');
    if (targetId === socket.data.playerId) throw new Error('Нельзя голосовать за себя');
    if (!room.players.some((player) => player.id === targetId)) throw new Error('Игрок не найден');
    if (room.gameId === 'bunker') {
      const contestantIds = bunkerActiveContestants(room).map((player) => player.id);
      if (!contestantIds.includes(socket.data.playerId)) throw new Error('Исключённые игроки не голосуют');
      if (!contestantIds.includes(targetId)) throw new Error('За этого игрока уже нельзя голосовать');
      if (room.round.voteCandidateIds && !room.round.voteCandidateIds.includes(targetId)) throw new Error('В переголосовании доступны только лидеры');
      room.round.votes[socket.data.playerId] = targetId;
      if (Object.keys(room.round.votes).length === contestantIds.length) finishBunkerVote(room);
      else emitRoom(room);
      return {};
    }
    if (room.round.voteCandidateIds && !room.round.voteCandidateIds.includes(targetId)) throw new Error('В переголосовании доступны только лидеры');
    room.round.votes[socket.data.playerId] = targetId;
    if (Object.keys(room.round.votes).length === activePlayers(room).length) finishVote(room);
    else emitRoom(room);
    return {};
  }));

  socket.on('spy_guess', ({ roomId }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    requireRoomPlayer(room, socket.data.playerId);
    const subjectType = room?.settings.subjectType || 'location';
    const subjectName = subjectType === 'item' ? 'предмета' : 'локации';
    if (!room?.settings.allowSpyGuess) throw new Error(`Угадывание ${subjectName} выключено в настройках комнаты`);
    if (!room?.round || room.round.phase !== 'discussion' || !(room.round.spyIds || [room.round.spyId]).includes(socket.data.playerId)) throw new Error('Действие недоступно');
    room.round.phase = 'guess_review';
    room.round.spyGuess = { spyId: socket.data.playerId, at: Date.now() };
    room.round.spyGuessVotes = {};
    room.round.votingEndsAt = Date.now() + room.settings.votingSeconds * 1000;
    emitRoom(room);
    return {};
  }));

  socket.on('spy_guess_vote', ({ roomId, accepted }, callback) => replyWith(callback, () => {
    checkRate(socket, 'spy_guess_vote', 10, 10000);
    const room = getRoom(roomId);
    requireRoomPlayer(room, socket.data.playerId);
    if (!room?.round || room.round.phase !== 'guess_review') throw new Error('Проверка ответа не идёт');
    if ((room.round.spyIds || [room.round.spyId]).includes(socket.data.playerId)) throw new Error('Шпион не голосует за свой ответ');
    room.round.spyGuessVotes ??= {};
    room.round.spyGuessVotes[socket.data.playerId] = Boolean(accepted);
    if (civilianPlayers(room).every((player) => room.round.spyGuessVotes[player.id] !== undefined)) finishSpyGuessReview(room);
    else emitRoom(room);
    return {};
  }));

  socket.on('get_guess_locations', ({ roomId }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    requireRoomPlayer(room, socket.data.playerId);
    return { locations: getSpyLocations(room.settings.dictionaryIds, room.customLocations, room.settings.subjectType || 'location').map(({ id, name }) => ({ id, name })) };
  }));

  socket.on('alias_mark_word', ({ roomId, result }, callback) => replyWith(callback, () => {
    checkRate(socket, 'alias_mark_word', 80, 10000);
    const room = getRoom(roomId);
    requireRoomPlayer(room, socket.data.playerId);
    if (room?.gameId !== 'alias' || room.round?.phase !== 'alias_turn') throw new Error('Ход Alias не идёт');
    if (result === 'correct') room.round.correct += 1;
    else if (result === 'skip') room.round.skipped += 1;
    else throw new Error('Непонятный результат слова');
    nextAliasWord(room);
    emitRoom(room);
    return {};
  }));

  socket.on('alias_finish_turn', ({ roomId }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    if (!room || room.gameId !== 'alias' || room.hostId !== socket.data.playerId) throw new Error('Только хост может завершить ход');
    finishAliasTurn(room);
    return {};
  }));

  // Активный игрок сам выбирает правду или действие и только потом видит текст.
  socket.on('truthdare_choose', ({ roomId, promptType }, callback) => replyWith(callback, () => {
    checkRate(socket, 'truthdare_choose', 30, 10000);
    const room = getRoom(roomId);
    requireRoomPlayer(room, socket.data.playerId);
    if (room?.gameId !== 'truthdare' || room.round?.phase !== 'truthdare_choice') throw new Error('Сейчас нет выбора карточки');
    if (room.round.activePlayerId !== socket.data.playerId) throw new Error('Выбирает только активный игрок');
    if (!['truth', 'dare'].includes(promptType)) throw new Error('Выберите правду или действие');
    chooseTruthDarePrompt(room, promptType);
    emitRoom(room);
    return {};
  }));

  socket.on('truthdare_submit', ({ roomId }, callback) => replyWith(callback, () => {
    checkRate(socket, 'truthdare_submit', 30, 10000);
    const room = getRoom(roomId);
    requireRoomPlayer(room, socket.data.playerId);
    if (room?.gameId !== 'truthdare' || room.round?.phase !== 'truthdare_turn') throw new Error('Сейчас нет активного задания');
    if (room.round.activePlayerId !== socket.data.playerId) throw new Error('Карточку выполняет активный игрок');
    if (!truthDareJury(room).length) {
      finishTruthDareTurn(room, 'accepted');
      emitRoom(room);
      return {};
    }
    submitTruthDareAnswer(room);
    emitRoom(room);
    return {};
  }));

  // Засчитывает карточку компания, а не сам игрок.
  socket.on('truthdare_review_vote', ({ roomId, accepted }, callback) => replyWith(callback, () => {
    checkRate(socket, 'truthdare_review_vote', 40, 10000);
    const room = getRoom(roomId);
    requireRoomPlayer(room, socket.data.playerId);
    if (room?.gameId !== 'truthdare' || room.round?.phase !== 'truthdare_review') throw new Error('Сейчас нет голосования');
    if (room.round.activePlayerId === socket.data.playerId) throw new Error('Свою карточку не засчитывают сами');
    const outcome = voteTruthDare(room, socket.data.playerId, accepted === true);
    if (outcome) {
      finishTruthDareTurn(room, outcome);
      track('round_finished', { gameId: 'truthdare', reason: outcome, roomId: room.id });
    }
    emitRoom(room);
    return {};
  }));

  socket.on('truthdare_refuse', ({ roomId }, callback) => replyWith(callback, () => {
    checkRate(socket, 'truthdare_refuse', 20, 10000);
    const room = getRoom(roomId);
    requireRoomPlayer(room, socket.data.playerId);
    if (room?.gameId !== 'truthdare' || !['truthdare_choice', 'truthdare_turn'].includes(room.round?.phase)) throw new Error('Сейчас нельзя отказаться');
    if (room.round.activePlayerId !== socket.data.playerId) throw new Error('Отказаться может только активный игрок');
    refuseTruthDare(room, socket.data.playerId);
    track('round_finished', { gameId: 'truthdare', reason: 'refused', roomId: room.id });
    emitRoom(room);
    return {};
  }));

  socket.on('next_round', ({ roomId }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    if (!room || room.hostId !== socket.data.playerId || room.state !== 'round_result') throw new Error('Действие недоступно');
    room.players.forEach((player) => { player.ready = player.id === room.hostId; });
    if (room.gameId === 'alias') room.round = createAliasRound(room);
    else if (room.gameId === 'bunker') continueBunkerRound(room);
    else if (room.gameId === 'truthdare') room.round = createTruthDareRound(room);
    else room.round = null;
    room.state = 'lobby';
    if (room.gameId === 'alias' || room.gameId === 'bunker' || room.gameId === 'truthdare') room.state = 'playing';
    emitRoom(room);
    return {};
  }));

  socket.on('cancel_round', ({ roomId }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    if (!room || room.hostId !== socket.data.playerId || room.state !== 'playing') throw new Error('Только хост может завершить раунд');
    cancelRound(room);
    return {};
  }));

  socket.on('new_match', ({ roomId }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    if (!room || room.hostId !== socket.data.playerId || room.state !== 'match_result') throw new Error('Действие недоступно');
    room.scores = room.gameId === 'alias' ? { team_1: 0, team_2: 0 } : room.gameId === 'bunker' ? { saved: 0, eliminated: 0 } : room.gameId === 'truthdare' ? {} : { civilians: 0, spies: 0 };
    if (room.gameId === 'alias') {
      room.aliasTeams = createAliasTeams(room.players.filter((player) => player.online));
      room.usedAliasWords = [];
      room.aliasTurnIndex = -1;
    }
    if (room.gameId === 'truthdare') room.truthDareTurnIndex = -1;
    room.players.forEach((player) => { player.ready = player.id === room.hostId; });
    room.round = null;
    room.state = 'lobby';
    emitRoom(room);
    return {};
  }));

  socket.on('leave_room', ({ roomId }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    if (room) {
      const leavingWasSpy = (room.round?.spyIds || [room.round?.spyId]).includes(socket.data.playerId);
      removePlayer(room, socket.data.playerId);
      if (room.players.length && room.state === 'playing') {
        if (room.gameId === 'alias') {
          if (room.players.length < aliasDefinition.minPlayers) cancelRound(room);
          else emitRoom(room);
        } else if (room.gameId === 'bunker') {
          if (bunkerActiveContestants(room).length <= room.round.shelterCapacity) finishBunkerByCapacity(room);
          else if (bunkerActiveContestants(room).length < bunkerDefinition.minPlayers - 1) cancelRound(room);
          else maybeAdvanceRound(room);
        } else if (room.gameId === 'truthdare') {
          if (room.players.length < truthDareDefinition.minPlayers) cancelRound(room);
          else {
            if (room.round?.activePlayerId === socket.data.playerId) room.round = createTruthDareRound(room);
            emitRoom(room);
          }
        } else if (leavingWasSpy) setRoundResult(room, 'civilians', 'spy_left');
        else if (room.players.length < spyDefinition.minPlayers) cancelRound(room);
        else maybeAdvanceRound(room);
      } else if (room.players.length) emitRoom(room);
      else persistRooms();
    }
    socket.data.roomId = null;
    return {};
  }));

  socket.on('disconnect', () => {
    const room = getRoom(socket.data.roomId);
    const player = room?.players.find((item) => item.id === socket.data.playerId);
    if (player) {
      player.online = false;
      maybeAdvanceRound(room);
      emitRoom(room);
    }
  });
});

setInterval(() => {
  const now = Date.now();
  for (const room of allRooms()) {
    if (room.gameId === 'alias' && room.round?.phase === 'alias_turn' && room.round.endsAt <= now) finishAliasTurn(room);
    if (room.round?.phase === 'discussion' && room.round.endsAt <= now) startVoting(room);
    if (room.round?.phase === 'voting' && room.round.votingEndsAt <= now) {
      if (room.gameId === 'bunker') finishBunkerVote(room);
      else finishVote(room);
    }
  }
}, 500);

setInterval(() => {
  if (cleanupInactiveRooms(inactiveRoomTtlMs).length) persistRooms();
  cleanupExpiredRateLimits(10 * 60 * 1000);
}, 60000);

await connectRoomPersistence();
restoreRooms(await loadRoomSnapshot());
await connectProfilePersistence();
restoreProfiles(await loadProfileSnapshot());
await connectAnalyticsPersistence();
await restoreAnalyticsSnapshot();
server.listen(port, '0.0.0.0', () => console.log(`GameHubParty server: http://localhost:${port}`));
