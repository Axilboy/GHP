import { BASE_SPY_DICTIONARY } from './baseLocations.js';
import { EXTRA_SPY_DICTIONARIES, SPY_BUNDLES } from './extraDictionaries.js';
import { ITEM_SPY_DICTIONARIES } from './itemDictionaries.js';

const SUBJECT_DEFAULTS = { location: 'base', item: 'items_home' };
const dictionaries = new Map([BASE_SPY_DICTIONARY, ...EXTRA_SPY_DICTIONARIES, ...ITEM_SPY_DICTIONARIES].map((dictionary) => [dictionary.id, dictionary]));

function dictionarySubject(dictionary) {
  return dictionary?.subjectType || 'location';
}

export const spyDefinition = {
  id: 'spy',
  name: 'Шпион',
  minPlayers: 3,
  maxPlayers: 12,
  modes: [
    { id: 'classic', name: 'Классический', description: 'Один или несколько шпионов против мирных.' },
  ],
  defaultSettings: { roundSeconds: 480, votingSeconds: 30, targetScore: 5, dictionaryIds: ['base'], subjectType: 'location', mode: 'classic', spyCount: 1, revealRoles: true, allowSpyGuess: true },
  settingsSchema: {
    roundSeconds: { type: 'number', values: [300, 480, 600] },
    votingSeconds: { type: 'number', values: [20, 30, 45, 60] },
    targetScore: { type: 'number', min: 3, max: 10 },
    dictionaryIds: { type: 'dictionary-list' },
    subjectType: { type: 'subject-type', values: ['location', 'item'] },
    mode: { type: 'mode', values: ['classic'] },
    spyCount: { type: 'number', min: 1, max: 11 },
    revealRoles: { type: 'boolean' },
    allowSpyGuess: { type: 'boolean' },
  },
};

export function listSpyDictionaries() {
  return [...dictionaries.values()].map(({ locations, ...dictionary }) => {
    const subjectType = dictionary.subjectType || 'location';
    return {
      ...dictionary,
      subjectType,
      countLabel: dictionary.countLabel || (subjectType === 'item' ? 'предметов' : 'локаций'),
      locationCount: locations.length,
    };
  });
}

export function listSpyBundles() { return SPY_BUNDLES; }
export function getSpyBundle(id) { return SPY_BUNDLES.find((bundle) => bundle.id === id) || null; }
export function getSpyDictionary(id) { return dictionaries.get(id) || null; }

export function getSpyLocations(dictionaryIds = ['base'], customLocations = [], subjectType = 'location') {
  const normalizedSubject = spyDefinition.settingsSchema.subjectType.values.includes(subjectType) ? subjectType : 'location';
  const locations = [
    ...dictionaryIds.flatMap((id) => {
      const dictionary = dictionaries.get(id);
      return dictionarySubject(dictionary) === normalizedSubject ? dictionary?.locations || [] : [];
    }),
    ...(normalizedSubject === 'location' ? customLocations : []),
  ];
  return [...new Map(locations.map((location) => [location.id, location])).values()];
}

export function normalizeSpySettings(settings = {}) {
  const subjectType = spyDefinition.settingsSchema.subjectType.values.includes(settings.subjectType) ? settings.subjectType : spyDefinition.defaultSettings.subjectType;
  const mode = spyDefinition.settingsSchema.mode.values.includes(settings.mode) ? settings.mode : 'classic';
  const seconds = Number(settings.roundSeconds);
  const target = Number(settings.targetScore);
  const votingSeconds = Number(settings.votingSeconds);
  const dictionaryIds = (Array.isArray(settings.dictionaryIds) ? settings.dictionaryIds : []).filter((id) => dictionaries.has(id) && dictionarySubject(dictionaries.get(id)) === subjectType);
  const requestedSpyCount = Number(settings.spyCount);
  return {
    roundSeconds: spyDefinition.settingsSchema.roundSeconds.values.includes(seconds) ? seconds : spyDefinition.defaultSettings.roundSeconds,
    votingSeconds: spyDefinition.settingsSchema.votingSeconds.values.includes(votingSeconds) ? votingSeconds : spyDefinition.defaultSettings.votingSeconds,
    targetScore: Math.min(10, Math.max(3, Number.isFinite(target) ? target : spyDefinition.defaultSettings.targetScore)),
    dictionaryIds: dictionaryIds.length ? dictionaryIds : [SUBJECT_DEFAULTS[subjectType]],
    subjectType,
    mode,
    spyCount: Math.min(11, Math.max(1, Number.isFinite(requestedSpyCount) ? requestedSpyCount : 1)),
    revealRoles: settings.revealRoles !== false,
    allowSpyGuess: settings.allowSpyGuess !== false,
  };
}

export function createSpyRound(room, random = Math.random) {
  const subjectType = room.settings.subjectType || 'location';
  const locations = getSpyLocations(room.settings.dictionaryIds, room.customLocations, subjectType);
  const recentIds = new Set(room.lastLocations || []);
  const availableLocations = locations.filter((location) => !recentIds.has(location.id));
  const locationPool = availableLocations.length ? availableLocations : locations;
  const location = locationPool[Math.floor(random() * locationPool.length)];
  const playerIds = room.players.map((player) => player.id);
  const shuffledPlayerIds = [...playerIds].sort(() => random() - 0.5);
  const spyCount = Math.min(room.settings.spyCount || 1, Math.max(1, playerIds.length - 1));
  const spyIds = shuffledPlayerIds.slice(0, spyCount);
  const firstQuestionerId = playerIds[Math.floor(random() * playerIds.length)];
  const shuffledRoles = [...location.roles].sort(() => random() - 0.5);
  const roles = {};
  let roleIndex = 0;
  for (const playerId of playerIds) if (!spyIds.includes(playerId)) roles[playerId] = shuffledRoles[roleIndex++ % shuffledRoles.length];
  return {
    number: (room.round?.number || 0) + 1,
    phase: 'role_reveal',
    locationId: location.id,
    locationName: location.name,
    subjectType,
    spyId: spyIds[0],
    spyIds,
    firstQuestionerId,
    roles,
    seenIds: [],
    startedAt: null,
    endsAt: null,
    votingEndsAt: null,
    votes: {},
    spyGuess: null,
    spyGuessVotes: {},
    voteStartRequestIds: [],
    voteRound: 1,
    voteCandidateIds: null,
    result: null,
  };
}

export function getSpyPlayerCard(room, playerId) {
  if (!room.round) return null;
  const spyIds = room.round.spyIds || [room.round.spyId];
  const isSpy = spyIds.includes(playerId);
  return {
    isSpy,
    location: isSpy ? null : room.round.locationName,
    subjectType: room.round.subjectType || room.settings.subjectType || 'location',
    role: isSpy ? 'Шпион' : room.settings.revealRoles === false ? null : room.round.roles[playerId],
    teammates: isSpy ? spyIds.filter((id) => id !== playerId) : [],
  };
}
