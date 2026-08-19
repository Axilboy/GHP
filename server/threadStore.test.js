import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addMessage,
  addThreadReward,
  createThread,
  getThread,
  listPlayerThreads,
  listThreads,
  markRead,
  publicThread,
  setThreadStatus,
} from './threadStore.js';

function newThread(playerId = `p-${Math.random().toString(36).slice(2)}`) {
  return createThread({ playerId, playerName: 'Игрок', topic: 'bug', message: 'Карточка не открывается на iPhone' });
}

test('a new request starts a dialogue, not a one-way letter', () => {
  const thread = newThread();
  assert.equal(thread.status, 'open');
  assert.equal(thread.messages.length, 1);
  assert.equal(thread.messages[0].from, 'player');
  assert.equal(thread.unreadForAdmin, 1, 'админ должен увидеть новое обращение');
  assert.equal(thread.unreadForPlayer, 0);
});

test('unread counters follow who wrote last', () => {
  const thread = newThread();
  markRead(thread, 'admin');
  addMessage(thread, 'admin', 'Спасибо, какая версия iOS?');
  assert.equal(thread.unreadForPlayer, 1);
  assert.equal(thread.unreadForAdmin, 0);

  markRead(thread, 'player');
  addMessage(thread, 'player', 'iOS 18.7');
  assert.equal(thread.unreadForPlayer, 0);
  assert.equal(thread.unreadForAdmin, 1);
});

test('a player only ever sees their own threads', () => {
  const mine = newThread('player-a');
  newThread('player-b');
  const list = listPlayerThreads('player-a');
  assert.equal(list.length, 1);
  assert.equal(list[0].id, mine.id);
  assert.equal(listPlayerThreads('player-c').length, 0);
  assert.ok(listThreads().length >= 2, 'админ видит все обращения');
});

test('the public view never leaks the reporter identity back out', () => {
  const view = publicThread(newThread('secret-player'));
  assert.equal(view.playerId, undefined);
  assert.equal(view.contactEmail, undefined);
  assert.equal(view.page, undefined);
  assert.ok(view.messages.length > 0);
});

test('rewards and status land in the same dialogue', () => {
  const thread = newThread();
  addThreadReward(thread, { type: 'subscription', productId: 'pro', title: 'PRO на месяц' });
  addThreadReward(thread, { type: 'game_pass', productId: 'spy_pass', title: 'Spy Pass' });
  setThreadStatus(thread, 'accepted');
  addMessage(thread, 'system', 'Заявка принята. Начислено: PRO на месяц, Spy Pass.');

  const view = publicThread(thread);
  assert.equal(view.status, 'accepted');
  assert.equal(view.rewards.length, 2);
  assert.equal(view.messages.at(-1).from, 'system');
  assert.match(view.messages.at(-1).text, /Заявка принята/);
  assert.throws(() => setThreadStatus(thread, 'нечто'), /Неизвестный статус/);
});

test('empty messages are refused and threads stay findable by id', () => {
  const thread = newThread();
  assert.throws(() => addMessage(thread, 'player', '   '), /Сообщение пустое/);
  assert.equal(getThread(thread.id).id, thread.id);
  assert.equal(getThread('нет такого'), null);
});
