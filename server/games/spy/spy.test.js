import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpyRound, getSpyBundle, getSpyLocations, getSpyPlayerCard, listSpyDictionaries, normalizeSpySettings } from './index.js';

test('base dictionary has enough distinct locations and roles', () => {
  const locations = getSpyLocations(['base']);
  assert.ok(locations.length >= 30);
  assert.equal(new Set(locations.map((location) => location.id)).size, locations.length);
  for (const location of locations) assert.ok(location.roles.length >= 6);
});

test('classic round assigns exactly one spy and hides location from them', () => {
  const room = {
    settings: normalizeSpySettings(),
    players: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    round: null,
  };
  room.round = createSpyRound(room, () => 0);
  const cards = room.players.map((player) => getSpyPlayerCard(room, player.id));
  assert.equal(cards.filter((card) => card.isSpy).length, 1);
  assert.equal(cards.find((card) => card.isSpy).location, null);
  assert.ok(cards.filter((card) => !card.isSpy).every((card) => card.location === room.round.locationName));
});

test('settings reject unsupported future modes and dictionaries', () => {
  assert.deepEqual(normalizeSpySettings({ roundSeconds: 1, targetScore: 99, dictionaryIds: ['missing'], mode: 'chaos' }), {
    roundSeconds: 480,
    votingSeconds: 30,
    targetScore: 10,
    dictionaryIds: ['base'],
    subjectType: 'location',
    mode: 'classic',
    spyCount: 1,
    revealRoles: true,
    allowSpyGuess: true,
  });
});

test('item mode uses item dictionaries and hides item from spies', () => {
  const settings = normalizeSpySettings({ subjectType: 'item', dictionaryIds: ['base', 'items_home'] });
  assert.deepEqual(settings.dictionaryIds, ['items_home']);
  assert.equal(settings.subjectType, 'item');
  const items = getSpyLocations(settings.dictionaryIds, [{ id: 'custom', name: 'Дом', roles: ['Хозяин', 'Гость', 'Сосед'] }], settings.subjectType);
  assert.ok(items.some((item) => item.name === 'Микроволновка'));
  assert.ok(!items.some((item) => item.id === 'custom'));

  const room = {
    settings,
    players: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    customLocations: [],
    round: null,
  };
  room.round = createSpyRound(room, () => 0);
  const cards = room.players.map((player) => getSpyPlayerCard(room, player.id));
  assert.equal(room.round.subjectType, 'item');
  assert.equal(cards.find((card) => card.isSpy).location, null);
  assert.ok(cards.filter((card) => !card.isSpy).every((card) => card.subjectType === 'item' && card.location === room.round.locationName));
});

test('paid item catalog includes alcohol and computer games packs', () => {
  const dictionaries = listSpyDictionaries();
  const alcohol = dictionaries.find((dictionary) => dictionary.id === 'items_alcohol');
  const computerGames = dictionaries.find((dictionary) => dictionary.id === 'items_computer_games');
  assert.equal(alcohol?.free, false);
  assert.equal(alcohol?.subjectType, 'item');
  assert.equal(alcohol?.priceRub, 179);
  assert.equal(computerGames?.free, false);
  assert.equal(computerGames?.subjectType, 'item');
  assert.equal(computerGames?.priceRub, 149);
  assert.ok(getSpyBundle('items_pack').dictionaryIds.includes('items_alcohol'));
  assert.ok(getSpyBundle('items_pack').dictionaryIds.includes('items_computer_games'));
});

test('new round avoids recently used locations when alternatives exist', () => {
  const room = {
    settings: normalizeSpySettings(),
    players: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    round: null,
    lastLocations: [getSpyLocations(['base'])[0].id],
  };
  const round = createSpyRound(room, () => 0);
  assert.notEqual(round.locationId, room.lastLocations[0]);
  assert.ok(round.firstQuestionerId);
});

test('duo mode assigns two spies and exposes teammates only to spies', () => {
  const room = {
    settings: normalizeSpySettings({ mode: 'duo' }),
    players: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
    round: null,
  };
  room.round = createSpyRound(room, () => 0);
  const cards = room.players.map((player) => getSpyPlayerCard(room, player.id));
  assert.equal(cards.filter((card) => card.isSpy).length, 2);
  assert.ok(cards.filter((card) => card.isSpy).every((card) => card.teammates.length === 1));
});

test('custom locations can be selected for a round', () => {
  const room = {
    settings: normalizeSpySettings(),
    players: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    customLocations: [{ id: 'custom', name: 'Дом', roles: ['Хозяин', 'Гость', 'Сосед'] }],
    lastLocations: getSpyLocations(['base']).map((location) => location.id),
    round: null,
  };
  assert.equal(createSpyRound(room, () => 0).locationId, 'custom');
});
