import test from 'node:test';
import assert from 'node:assert/strict';
import { analyticsSnapshot, track } from './analyticsStore.js';

test('analytics snapshot builds game and store funnels', () => {
  const suffix = Math.random().toString(36).slice(2);
  const playerId = `analytics-${suffix}`;
  const sessionId = `session-${suffix}`;

  track('page_view', { page: 'home', playerId, sessionId });
  track('open_store', { page: 'store', playerId, sessionId });
  track('room_created', { gameId: 'spy', playerId });
  track('room_joined', { gameId: 'spy', playerId: `${playerId}-guest` });
  track('round_started', { gameId: 'spy', playerId });
  track('round_finished', { gameId: 'spy', playerId });
  track('order_created', { type: 'game_pass', productId: 'spy_pass', playerId });
  track('order_paid', { type: 'game_pass', productId: 'spy_pass', playerId });

  const today = analyticsSnapshot().byWindow.today;
  assert.equal(today.pages.home >= 1, true);
  assert.equal(today.uniqueSessions >= 1, true);
  assert.equal(today.gameFunnel.find((step) => step.key === 'create_room').count >= 1, true);
  assert.equal(today.gameFunnel.find((step) => step.key === 'finish_round').count >= 1, true);
  assert.equal(today.storeFunnel.find((step) => step.key === 'start_checkout').count >= 1, true);
  assert.equal(today.storeFunnel.find((step) => step.key === 'payment_success').count >= 1, true);
});
