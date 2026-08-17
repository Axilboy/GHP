import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bunkerActiveContestants,
  bunkerContentPacks,
  createBunkerRound,
  getBunkerPlayerCard,
  normalizeBunkerSettings,
  publicBunkerCards,
  startBunkerAfterBriefing,
} from './index.js';

function room() {
  return {
    players: [
      { id: 'p1', name: 'One', online: true },
      { id: 'p2', name: 'Two', online: true },
      { id: 'p3', name: 'Three', online: true },
      { id: 'p4', name: 'Four', online: true },
      { id: 'p5', name: 'Five', online: true },
    ],
    settings: normalizeBunkerSettings({ roundSeconds: 300, votingSeconds: 45 }),
    round: null,
  };
}

test('bunker round creates personal cards and shelter capacity', () => {
  const nextRoom = room();
  nextRoom.round = createBunkerRound(nextRoom, () => 0);
  assert.equal(nextRoom.round.phase, 'briefing');
  assert.equal(nextRoom.round.scenarioGoal, 'Восстановить первую безопасную общину после открытия дверей.');
  assert.equal(nextRoom.round.shelterCapacity, 2);
  assert.deepEqual(nextRoom.round.voteStartRequestIds, []);
  assert.equal(Object.keys(nextRoom.round.cards).length, 5);
  const card = getBunkerPlayerCard(nextRoom, 'p1');
  assert.equal(card.profession, 'врач');
  assert.equal(card.age, '19 лет');
  assert.equal(card.baggage, 'ящик консервов');
  assert.equal(card.special, 'Иммунитет: один раз можете отменить голос против себя.');
  assert.equal(card.eliminated, false);
});

test('bunker contestants exclude eliminated players', () => {
  const nextRoom = room();
  nextRoom.round = createBunkerRound(nextRoom, () => 0);
  nextRoom.round.eliminatedIds = ['p2', 'p4'];
  assert.deepEqual(bunkerActiveContestants(nextRoom).map((player) => player.id), ['p1', 'p3', 'p5']);
});

test('bunker settings reject unsupported durations', () => {
  assert.deepEqual(normalizeBunkerSettings({ roundSeconds: 999, votingSeconds: 10, revealMode: 'bad' }), {
    roundSeconds: 300,
    votingSeconds: 45,
    revealMode: 'private_table',
    contentPackId: 'classic',
  });
  assert.deepEqual(normalizeBunkerSettings({ roundSeconds: 180, votingSeconds: 60, revealMode: 'public_turns', contentPackId: 'space' }), {
    roundSeconds: 180,
    votingSeconds: 60,
    revealMode: 'public_turns',
    contentPackId: 'space',
  });
  assert.deepEqual(normalizeBunkerSettings({ contentPackId: 'harry_potter' }).contentPackId, 'harry_potter');
});

test('bunker catalog keeps classic free and premium expansion packs', () => {
  const classic = bunkerContentPacks.find((pack) => pack.id === 'classic');
  const premiumIds = bunkerContentPacks.filter((pack) => pack.tier === 'premium').map((pack) => pack.id);

  assert.equal(classic.tier, 'free');
  assert.ok(premiumIds.includes('hard_medical'));
  assert.ok(premiumIds.includes('party18'));
  assert.ok(premiumIds.includes('corporate'));
  assert.ok(premiumIds.includes('space'));
  assert.ok(premiumIds.includes('harry_potter'));
  assert.ok(premiumIds.includes('lotr'));
  assert.ok(premiumIds.includes('retro_movies'));
  assert.ok(premiumIds.includes('video_games'));
});

test('public reveal mode exposes only selected fields', () => {
  const nextRoom = room();
  nextRoom.settings = normalizeBunkerSettings({ revealMode: 'public_turns' });
  nextRoom.round = createBunkerRound(nextRoom, () => 0);
  startBunkerAfterBriefing(nextRoom);
  assert.equal(nextRoom.round.phase, 'public_reveal');
  nextRoom.round.bunkerReveals.p1.profession = true;
  nextRoom.round.bunkerReveals.p1.special = true;
  const [publicCard] = publicBunkerCards(nextRoom);
  assert.equal(publicCard.fields.find((field) => field.id === 'profession').value, 'врач');
  assert.equal(publicCard.fields.find((field) => field.id === 'special').value, 'Иммунитет: один раз можете отменить голос против себя.');
  assert.equal(publicCard.fields.find((field) => field.id === 'health').value, null);
});
