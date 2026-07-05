import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activateDemoPlan,
  activatePartyPass,
  addCustomLocation,
  confirmDemoOrder,
  createOrder,
  getOrCreateProfile,
  hasAdFreeAccess,
  unlockBundle,
  unlockCustomDictionary,
  unlockDemoDictionary,
} from './profileStore.js';

test('guest profile starts with progress and base dictionary', () => {
  const profile = getOrCreateProfile('profile-test', 'Игрок');
  assert.equal('coins' in profile, false);
  assert.deepEqual(profile.ownedDictionaryIds, ['base']);
  assert.equal(profile.stats.games, 0);
  assert.deepEqual(profile.orders, []);
  assert.deepEqual(profile.purchases, []);
});

test('dictionary demo unlock is idempotent and demo pro unlocks access', () => {
  const profile = getOrCreateProfile('purchase-test', 'Покупатель');
  const dictionary = { id: 'city', free: false };
  unlockDemoDictionary(profile.id, dictionary);
  unlockDemoDictionary(profile.id, dictionary);
  assert.deepEqual(profile.ownedDictionaryIds, ['base', 'city']);
  assert.equal(activateDemoPlan(profile.id, 'pro', 3).pro, true);
  assert.equal(profile.subscription.months, 3);
});

test('player can create a reusable custom location', () => {
  unlockCustomDictionary('creator-test');
  const profile = addCustomLocation('creator-test', { name: 'Дом', roles: ['Хозяин', 'Гость', 'Сосед'] });
  assert.equal(profile.customLocations.length, 1);
  assert.equal(profile.customLocations[0].roles.length, 3);
});

test('demo order creates purchase and unlocks product after confirmation', () => {
  const { order } = createOrder('order-test', { type: 'dictionary', productId: 'city' });
  assert.equal(order.status, 'pending');
  const { profile, order: paidOrder } = confirmDemoOrder('order-test', order.id);
  assert.equal(paidOrder.status, 'paid');
  assert.ok(profile.ownedDictionaryIds.includes('city'));
  assert.equal(profile.purchases[0].productId, 'city');
});

test('subscription order activates pro access', () => {
  const { order } = createOrder('subscription-order-test', { type: 'subscription', productId: 'pro', months: 2 });
  const { profile } = confirmDemoOrder('subscription-order-test', order.id);
  assert.equal(profile.pro, true);
  assert.equal(profile.proPlus, false);
  assert.equal(profile.subscription.months, 2);
});

test('annual pro order has yearly title and discount', () => {
  const { order } = createOrder('annual-subscription-order-test', { type: 'subscription', productId: 'pro', months: 12 });
  assert.equal(order.title, 'PRO на год');
  assert.equal(order.amountRub, 2990);
  const { profile } = confirmDemoOrder('annual-subscription-order-test', order.id);
  assert.equal(profile.subscription.months, 12);
});

test('game pass order opens one game for a month', () => {
  const { order } = createOrder('game-pass-order-test', { type: 'game_pass', productId: 'spy_pass', months: 1 });
  const { profile } = confirmDemoOrder('game-pass-order-test', order.id);
  assert.equal(profile.gamePasses[0].gameId, 'spy');
  assert.ok(profile.gamePasses[0].activeUntil > Date.now());
});

test('game pass removes ads only for its own game', () => {
  const { order } = createOrder('alias-pass-ad-policy-test', { type: 'game_pass', productId: 'alias_pass', months: 1 });
  const { profile } = confirmDemoOrder('alias-pass-ad-policy-test', order.id);
  assert.equal(hasAdFreeAccess(profile, Date.now(), 'alias'), true);
  assert.equal(hasAdFreeAccess(profile, Date.now(), 'spy'), false);
  assert.equal(hasAdFreeAccess(profile, Date.now(), 'bunker'), false);
});

test('party pass creates a temporary room entitlement', () => {
  const profile = activatePartyPass('party-test', 24);
  assert.ok(profile.partyPasses[0].activeUntil > Date.now());
});

test('bundle unlocks every included dictionary', () => {
  const profile = unlockBundle('bundle-test', { dictionaryIds: ['city', 'travel'] });
  assert.ok(profile.ownedDictionaryIds.includes('city'));
  assert.ok(profile.ownedDictionaryIds.includes('travel'));
});

test('theme order unlocks room theme after confirmation', () => {
  const profile = getOrCreateProfile('theme-order-test', 'Theme Buyer');
  assert.deepEqual(profile.ownedThemeIds, ['ghp']);
  const { order } = createOrder('theme-order-test', { type: 'theme', productId: 'partyhub' });
  const { profile: paidProfile } = confirmDemoOrder('theme-order-test', order.id);
  assert.ok(paidProfile.ownedThemeIds.includes('partyhub'));
});
