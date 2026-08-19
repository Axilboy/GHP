import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseTruthDarePrompt,
  createTruthDareRound,
  fillPromptNames,
  finishTruthDareTurn,
  refusalsLeft,
  refuseTruthDare,
  submitTruthDareAnswer,
  truthDareDecks,
  truthDarePool,
  truthDareJury,
  normalizeTruthDareSettings,
  voteTruthDare,
} from './index.js';

function makeRoom(playerCount = 3, settings = {}) {
  const room = {
    gameId: 'truthdare',
    state: 'playing',
    players: Array.from({ length: playerCount }, (_, index) => ({ id: `p${index + 1}`, name: `Игрок${index + 1}`, online: true })),
    settings: { decks: ['party'], targetScore: 10, ...settings },
    scores: {},
    matchHistory: [],
    round: null,
  };
  room.round = createTruthDareRound(room);
  return room;
}

test('round starts with a choice, not with a random card', () => {
  const room = makeRoom();
  assert.equal(room.round.phase, 'truthdare_choice');
  assert.equal(room.round.promptType, null);
  assert.equal(room.round.promptText, null);
  assert.equal(room.round.activePlayerId, 'p1');
  assert.equal(refusalsLeft(room, 'p1'), 2);
});

test('the active player picks the type and only then sees the card', () => {
  const room = makeRoom();
  chooseTruthDarePrompt(room, 'dare');
  assert.equal(room.round.phase, 'truthdare_turn');
  assert.equal(room.round.promptType, 'dare');
  assert.ok(room.round.promptText.length > 0);
  assert.ok([1, 2, 3].includes(room.round.promptLevel));
});

test('player placeholders are replaced with real names at the table', () => {
  const room = makeRoom();
  const filled = fillPromptNames('Позвони {игрок} и обними {сосед}.', room, 'p1', () => 0);
  assert.doesNotMatch(filled, /\{игрок\}|\{сосед\}/);
  assert.doesNotMatch(filled, /Игрок1/);
  for (let index = 0; index < 40; index += 1) {
    const text = fillPromptNames('{игрок}', room, 'p2', Math.random);
    assert.notEqual(text, 'Игрок2', 'карточка не должна адресовать игрока самому себе');
  }
});

test('a card never carries an unfilled placeholder into the room', () => {
  for (const deck of truthDareDecks) {
    const room = makeRoom(4, { decks: [deck.id] });
    for (let turn = 0; turn < 30; turn += 1) {
      chooseTruthDarePrompt(room, turn % 2 ? 'truth' : 'dare');
      assert.doesNotMatch(room.round.promptText, /\{[^}]+\}/, `${deck.id}: осталась подстановка`);
      finishTruthDareTurn(room, 'accepted');
      if (room.state === 'match_result') break;
    }
  }
});

test('the company scores the card, the player cannot score alone', () => {
  const room = makeRoom(3);
  chooseTruthDarePrompt(room, 'truth');
  submitTruthDareAnswer(room);
  assert.equal(room.round.phase, 'truthdare_review');
  assert.deepEqual(truthDareJury(room).map((player) => player.id), ['p2', 'p3']);

  assert.equal(voteTruthDare(room, 'p2', true), null, 'одного голоса из двух мало');
  const outcome = voteTruthDare(room, 'p3', true);
  assert.equal(outcome, 'accepted');
  finishTruthDareTurn(room, outcome);
  assert.equal(room.scores.p1, 1);
  assert.equal(room.round.activePlayerId, 'p2', 'ход уходит следующему игроку');
});

test('a rejected card gives no point and a tie counts as rejected', () => {
  const room = makeRoom(3);
  chooseTruthDarePrompt(room, 'dare');
  submitTruthDareAnswer(room);
  voteTruthDare(room, 'p2', true);
  const outcome = voteTruthDare(room, 'p3', false);
  assert.equal(outcome, 'rejected');
  finishTruthDareTurn(room, outcome);
  assert.equal(room.scores.p1, undefined);
  assert.equal(room.matchHistory[0].result, 'rejected');
});

test('refusing costs a token and runs out after two', () => {
  const room = makeRoom(3);
  refuseTruthDare(room, 'p1');
  assert.equal(refusalsLeft(room, 'p1'), 1);
  assert.equal(room.round.activePlayerId, 'p2');
  assert.equal(refusalsLeft(room, 'p2'), 2, 'жетоны у каждого свои');

  room.round.activePlayerId = 'p1';
  refuseTruthDare(room, 'p1');
  assert.equal(refusalsLeft(room, 'p1'), 0);
  room.round.activePlayerId = 'p1';
  assert.throws(() => refuseTruthDare(room, 'p1'), /Жетоны отказа закончились/);
});

test('a deck only draws cards of its own boldness levels', () => {
  for (const type of ['truth', 'dare']) {
    assert.deepEqual([...new Set(truthDarePool('family', type).map((prompt) => prompt.level))], [1]);
    assert.deepEqual([...new Set(truthDarePool('bold', type).map((prompt) => prompt.level))], [3]);
    assert.ok(truthDarePool('party', type).every((prompt) => prompt.level <= 2));
  }
});

test('every deck holds enough cards to survive a real party', () => {
  for (const deck of truthDareDecks) {
    for (const type of ['truth', 'dare']) {
      assert.ok(truthDarePool(deck.id, type).length >= 12, `${deck.id}/${type}: слишком мало карточек`);
    }
  }
});

test('recent cards do not repeat while fresh ones are left', () => {
  const room = makeRoom(4, { decks: ['party'], targetScore: 99 });
  const seen = [];
  for (let turn = 0; turn < 10; turn += 1) {
    chooseTruthDarePrompt(room, 'truth');
    seen.push(room.round.promptText);
    finishTruthDareTurn(room, 'rejected');
  }
  assert.equal(new Set(seen).size, seen.length, 'карточки повторились слишком рано');
});

test('match ends when the target score is reached', () => {
  const room = makeRoom(2, { targetScore: 2 });
  for (let turn = 0; turn < 4; turn += 1) {
    if (room.state === 'match_result') break;
    chooseTruthDarePrompt(room, 'truth');
    finishTruthDareTurn(room, room.round.activePlayerId === 'p1' ? 'accepted' : 'rejected');
  }
  assert.equal(room.state, 'match_result');
  assert.equal(room.round.result.winnerId, 'p1');
  assert.equal(room.round.result.score, 2);
});

test('several decks merge into one pool without duplicates', () => {
  for (const type of ['truth', 'dare']) {
    const family = truthDarePool(['family'], type);
    const bold = truthDarePool(['bold'], type);
    const both = truthDarePool(['family', 'bold'], type);
    assert.ok(both.length > family.length, 'вторая колода должна добавлять карточки');
    assert.ok(both.length > bold.length);
    assert.equal(new Set(both.map((prompt) => prompt.text)).size, both.length, 'дубли между колодами не схлопнулись');
    // Уровни обеих колод доступны одновременно.
    const levels = new Set(both.map((prompt) => prompt.level));
    assert.ok(levels.has(1) && levels.has(3));
  }
});

test('a room can play on several decks at once', () => {
  const room = makeRoom(3, { decks: ['family', 'bold'], targetScore: 99 });
  const seen = new Set();
  for (let turn = 0; turn < 20; turn += 1) {
    chooseTruthDarePrompt(room, 'dare');
    seen.add(room.round.promptLevel);
    finishTruthDareTurn(room, 'rejected');
  }
  assert.ok(seen.size >= 2, `ожидались карточки разных уровней, получено: ${[...seen].join(',')}`);
});

test('legacy single-deck rooms keep working', () => {
  assert.deepEqual(normalizeTruthDareSettings({ deck: 'bold' }).decks, ['bold']);
  assert.deepEqual(normalizeTruthDareSettings({ decks: ['family', 'bold'] }).decks, ['family', 'bold']);
  assert.deepEqual(normalizeTruthDareSettings({ decks: ['nope'] }).decks, ['party']);
  assert.deepEqual(normalizeTruthDareSettings({ decks: ['party', 'party'] }).decks, ['party']);
  assert.deepEqual(normalizeTruthDareSettings({}).decks, ['party']);
});
