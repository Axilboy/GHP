import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const port = 6900 + Math.floor(Math.random() * 400);
const baseUrl = `http://127.0.0.1:${port}`;
const adminPin = '3571';

async function waitForServer(url, timeoutMs = 6000) {
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

const post = (url, body, pin) => fetch(baseUrl + url, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(pin ? { 'x-admin-pin': pin } : {}) },
  body: JSON.stringify(body),
});
const get = (url, pin) => fetch(baseUrl + url, { headers: pin ? { 'x-admin-pin': pin } : {} });

// Награду можно выдать только на привязанный аккаунт, поэтому тестовый игрок
// заранее входит по почте.
async function signInByEmail(url, playerId, email, name) {
  await fetch(url + '/api/auth/request-code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
  const verified = await fetch(url + '/api/auth/verify-code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code: '111111', playerId, name }) }).then((response) => response.json());
  assert.equal(verified.ok, true);
}

test('support chat carries a reply and pays the reward into the same thread', { timeout: 20000 }, async () => {
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), NODE_ENV: 'test', ADMIN_PIN: adminPin },
    stdio: 'ignore',
  });
  try {
    assert.equal((await waitForServer(`${baseUrl}/api/health`)).status, 200);
    await signInByEmail(baseUrl, 'support-tester', 'support-tester@example.com', 'Денис');

    const created = await (await post('/api/feedback', {
      topic: 'bug',
      message: 'В Шпионе не переворачивается карточка на iPhone',
      playerId: 'support-tester',
      playerName: 'Денис',
    })).json();
    assert.equal(created.ok, true);
    const threadId = created.threadId;
    assert.ok(threadId, 'обращение должно завести диалог');

    // Админ видит обращение и отвечает.
    const listed = await (await get('/api/admin/threads', adminPin)).json();
    const thread = listed.threads.find((item) => item.id === threadId);
    assert.equal(thread.playerName, 'Денис');
    assert.equal(thread.unread, 1);

    const replied = await (await post(`/api/admin/threads/${threadId}/messages`, { text: 'Спасибо, какая версия iOS?' }, adminPin)).json();
    assert.equal(replied.thread.messages.length, 2);

    const mine = await (await get(`/api/threads?playerId=support-tester`)).json();
    assert.equal(mine.threads[0].messages.at(-1).from, 'admin');
    assert.equal(mine.threads[0].unread, 1);

    // Приём заявки выдаёт несколько наград разом и пишет об этом в диалог.
    const accepted = await (await post(`/api/admin/threads/${threadId}/accept`, {
      rewards: [
        { type: 'subscription', productId: 'pro', months: 1 },
        { type: 'game_pass', productId: 'spy_pass', months: 1 },
      ],
      note: 'Баг подтверждён.',
    }, adminPin)).json();
    assert.equal(accepted.thread.status, 'accepted');
    assert.equal(accepted.thread.rewards.length, 2);
    assert.match(accepted.thread.messages.at(-1).text, /Заявка принята/);

    const afterReward = await (await get(`/api/threads?playerId=support-tester`)).json();
    assert.equal(afterReward.threads[0].status, 'accepted');
    assert.equal(afterReward.threads[0].rewards.length, 2);
    assert.match(afterReward.threads[0].rewards[0].title, /PRO/, 'в награде виден купленный продукт');
  } finally {
    server.kill();
  }
});

test('threads and rewards are closed to everyone but their owner and the admin', { timeout: 20000 }, async () => {
  const guardPort = port + 500;
  const guardUrl = `http://127.0.0.1:${guardPort}`;
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(guardPort), NODE_ENV: 'test', ADMIN_PIN: adminPin },
    stdio: 'ignore',
  });
  try {
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      try { if ((await fetch(`${guardUrl}/api/health`)).ok) break; } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const created = await (await fetch(`${guardUrl}/api/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic: 'idea', message: 'Добавьте колоду про космос', playerId: 'owner-player', playerName: 'Автор' }),
    })).json();

    const foreign = await (await fetch(`${guardUrl}/api/threads?playerId=someone-else`)).json();
    assert.equal(foreign.threads.length, 0, 'чужие обращения видеть нельзя');

    const stolen = await fetch(`${guardUrl}/api/threads/${created.threadId}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ playerId: 'stranger', text: 'подмена' }),
    });
    assert.equal(stolen.status, 400);

    assert.equal((await fetch(`${guardUrl}/api/admin/threads`)).status, 403);
    const noPinReward = await fetch(`${guardUrl}/api/admin/threads/${created.threadId}/accept`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rewards: [{ type: 'subscription', productId: 'pro' }] }),
    });
    assert.equal(noPinReward.status, 403, 'награду нельзя выдать без админского пина');
  } finally {
    server.kill();
  }
});

test('a guest cannot be rewarded — the grant would vanish with their cache', { timeout: 20000 }, async () => {
  const guestPort = port + 700;
  const guestUrl = `http://127.0.0.1:${guestPort}`;
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(guestPort), NODE_ENV: 'test', ADMIN_PIN: adminPin },
    stdio: 'ignore',
  });
  try {
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      try { if ((await fetch(`${guestUrl}/api/health`)).ok) break; } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const created = await (await fetch(`${guestUrl}/api/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic: 'bug', message: 'Гостевое обращение про баг', playerId: 'guest-reporter', playerName: 'Гость' }),
    })).json();

    const response = await fetch(`${guestUrl}/api/admin/threads/${created.threadId}/accept`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-pin': adminPin },
      body: JSON.stringify({ rewards: [{ type: 'subscription', productId: 'pro', months: 1 }] }),
    });
    const data = await response.json();
    assert.equal(response.status, 400);
    assert.match(data.error, /гостевой профиль/);
  } finally {
    server.kill();
  }
});
