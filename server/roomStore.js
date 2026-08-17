import { randomUUID } from 'node:crypto';
import { aliasDefinition, normalizeAliasSettings } from './games/alias/index.js';
import { bunkerDefinition, currentBunkerRevealPlayer, normalizeBunkerSettings, publicBunkerCards } from './games/bunker/index.js';
import { normalizeSpySettings, spyDefinition } from './games/spy/index.js';
import { normalizeTruthDareSettings, truthDareDefinition } from './games/truthdare/index.js';

const rooms = new Map();
const roomCodes = new Map();

function makeCode() {
  let code;
  do code = String(Math.floor(100000 + Math.random() * 900000));
  while (roomCodes.has(code));
  return code;
}

export function createRoom({ hostId, hostName, gameId = 'spy' }) {
  const id = randomUUID();
  const code = makeCode();
  const safeGameId = ['alias', 'bunker', 'truthdare'].includes(gameId) ? gameId : 'spy';
  const room = {
    id,
    code,
    hostId,
    gameId: safeGameId,
    state: 'lobby',
    settings: safeGameId === 'alias' ? { ...aliasDefinition.defaultSettings } : safeGameId === 'bunker' ? { ...bunkerDefinition.defaultSettings } : safeGameId === 'truthdare' ? { ...truthDareDefinition.defaultSettings } : { ...spyDefinition.defaultSettings },
    scores: safeGameId === 'alias' ? { team_1: 0, team_2: 0 } : safeGameId === 'bunker' ? { saved: 0, eliminated: 0 } : safeGameId === 'truthdare' ? {} : { civilians: 0, spies: 0 },
    aliasTeams: [],
    usedAliasWords: [],
    matchHistory: [],
    customLocations: [],
    themeId: 'ghp',
    themeSuggestions: [],
    players: [{ id: hostId, name: String(hostName).trim().slice(0, 24), ready: true, online: true }],
    round: null,
    lastLocations: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  rooms.set(id, room);
  roomCodes.set(code, id);
  return room;
}

export function getRoom(roomId) {
  return rooms.get(roomId) || null;
}

export function getRoomByCode(code) {
  return getRoom(roomCodes.get(String(code)) || '');
}

export function addPlayer(room, { playerId, name }) {
  const existing = room.players.find((player) => player.id === playerId);
  if (existing) {
    existing.online = true;
    existing.name = uniquePlayerName(room, name || existing.name, playerId);
    return existing;
  }
  if (room.state !== 'lobby') throw new Error('Игра уже началась');
  const maxPlayers = room.gameId === 'alias' ? aliasDefinition.maxPlayers : room.gameId === 'bunker' ? bunkerDefinition.maxPlayers : room.gameId === 'truthdare' ? truthDareDefinition.maxPlayers : spyDefinition.maxPlayers;
  if (room.players.length >= maxPlayers) throw new Error('Комната заполнена');
  const player = { id: playerId, name: uniquePlayerName(room, name, playerId), ready: false, online: true };
  room.players.push(player);
  return player;
}

export function uniquePlayerName(room, requestedName, playerId) {
  const base = String(requestedName || 'Игрок').trim().slice(0, 24) || 'Игрок';
  const taken = new Set(room.players.filter((player) => player.id !== playerId).map((player) => player.name.toLocaleLowerCase('ru')));
  if (!taken.has(base.toLocaleLowerCase('ru'))) return base;
  let number = 2;
  while (taken.has(`${base} ${number}`.toLocaleLowerCase('ru'))) number += 1;
  return `${base} ${number}`.slice(0, 24);
}

export function removePlayer(room, playerId) {
  room.players = room.players.filter((player) => player.id !== playerId);
  if (room.hostId === playerId && room.players.length) {
    room.hostId = room.players[0].id;
    room.players[0].ready = true;
  }
  if (!room.players.length) {
    rooms.delete(room.id);
    roomCodes.delete(room.code);
  }
}

export function updateRoomSettings(room, settings) {
  room.settings = room.gameId === 'alias'
    ? normalizeAliasSettings({ ...room.settings, ...settings })
    : room.gameId === 'bunker'
      ? normalizeBunkerSettings({ ...room.settings, ...settings })
      : room.gameId === 'truthdare'
        ? normalizeTruthDareSettings({ ...room.settings, ...settings })
        : normalizeSpySettings({ ...room.settings, ...settings });
}

export function publicRoom(room, playerId, extra = {}) {
  const round = room.round ? {
    number: room.round.number,
    phase: room.round.phase,
    seenCount: room.round.seenIds?.length || 0,
    startedAt: room.round.startedAt,
    endsAt: room.round.endsAt,
    votingEndsAt: room.round.votingEndsAt,
    votesCount: Object.keys(room.round.votes || {}).length,
    myVote: room.round.votes?.[playerId] || null,
    spyGuess: room.round.spyGuess || null,
    spyGuessVotesCount: Object.keys(room.round.spyGuessVotes || {}).length,
    mySpyGuessVote: room.round.spyGuessVotes?.[playerId] ?? null,
    firstQuestionerId: room.round.firstQuestionerId,
    voteRound: room.round.voteRound,
    voteCandidateIds: room.round.voteCandidateIds,
    voteStartRequestsCount: room.round.voteStartRequestIds?.length || 0,
    result: room.round.result,
    spyCount: room.round.spyIds?.length || 1,
    amSpy: (room.round.spyIds || [room.round.spyId]).includes(playerId),
    teamId: room.round.teamId,
    teamName: room.round.teamName,
    word: room.round.word,
    correct: room.round.correct,
    skipped: room.round.skipped,
    catastrophe: room.round.catastrophe,
    shelter: room.round.shelter,
    scenarioGoal: room.round.scenarioGoal,
    shelterCapacity: room.round.shelterCapacity,
    eliminatedIds: room.round.eliminatedIds || [],
    acceptedRulesCount: room.round.acceptedRuleIds?.length || 0,
    revealOrder: room.round.revealOrder || [],
    currentRevealIndex: room.round.currentRevealIndex || 0,
    currentRevealPlayerId: room.gameId === 'bunker' ? currentBunkerRevealPlayer(room) : null,
    publicCards: room.gameId === 'bunker' ? publicBunkerCards(room) : [],
    activePlayerId: room.round.activePlayerId,
    activePlayerName: room.round.activePlayerName,
    promptType: room.round.promptType,
    promptText: room.round.promptText,
  } : null;
  return {
    id: room.id,
    code: room.code,
    hostId: room.hostId,
    gameId: room.gameId,
    state: room.state,
    settings: room.settings,
    scores: room.scores,
    aliasTeams: room.aliasTeams || [],
    matchHistory: room.matchHistory || [],
    themeId: room.themeId || 'ghp',
    themeSuggestions: room.themeSuggestions || [],
    players: room.players,
    round,
    adPolicy: extra.adPolicy || { enabled: true, adFree: false, provider: 'stub', placements: ['pre_round', 'post_round', 'lobby_player_banner'] },
  };
}

export function allRooms() {
  return [...rooms.values()];
}

export function touchRoom(room) {
  room.updatedAt = Date.now();
}

export function restoreRooms(snapshot = []) {
  for (const saved of snapshot) {
    if (!saved?.id || !saved?.code || rooms.has(saved.id) || roomCodes.has(saved.code)) continue;
    saved.players = (saved.players || []).map((player) => ({ ...player, online: false }));
    rooms.set(saved.id, saved);
    roomCodes.set(saved.code, saved.id);
  }
}

export function cleanupInactiveRooms(maxOfflineAgeMs, now = Date.now()) {
  const removed = [];
  for (const room of rooms.values()) {
    if (room.players.some((player) => player.online)) continue;
    if (now - (room.updatedAt || room.createdAt || now) < maxOfflineAgeMs) continue;
    rooms.delete(room.id);
    roomCodes.delete(room.code);
    removed.push(room.id);
  }
  return removed;
}
