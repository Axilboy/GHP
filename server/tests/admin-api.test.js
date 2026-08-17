import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { io } from 'socket.io-client';

const port = 3207;
const baseUrl = `http://127.0.0.1:${port}`;
const adminPin = '2468';

function request(socket, event, payload = {}) {
  return new Promise((resolve, reject) => {
    socket.timeout(3000).emit(event, payload, (error, response) => {
      if (error) return reject(error);
      if (!response?.ok) return reject(new Error(response?.error || 'Request failed'));
      resolve(response);
    });
  });
}

async function waitForServer(url, timeoutMs = 5000) {
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

async function signInByEmail(baseUrl, playerId, email, name) {
  const codeResponse = await fetch(`${baseUrl}/api/auth/request-code`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  assert.equal(codeResponse.status, 200);
  const verifyResponse = await fetch(`${baseUrl}/api/auth/verify-code`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, code: '111111', playerId, name }),
  });
  const verifyData = await verifyResponse.json();
  assert.equal(verifyData.ok, true);
  return verifyData;
}

test('admin overview shows rooms and can confirm demo orders', { timeout: 15000 }, async () => {
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), NODE_ENV: 'test', ADMIN_PIN: adminPin },
    stdio: 'ignore',
  });
  const socket = io(baseUrl, { transports: ['websocket'] });
  try {
    assert.equal((await waitForServer(`${baseUrl}/api/health`)).status, 200);

    const denied = await fetch(`${baseUrl}/api/admin/overview`);
    assert.equal(denied.status, 403);

    // Публичный статус не должен раздавать аналитику: там id игроков,
    // user-agent'ы, реферреры и рекламные кампании.
    const status = await (await fetch(`${baseUrl}/api/status`)).json();
    assert.equal(status.ok, true);
    assert.equal(status.analytics, undefined);
    const statusKeys = Object.keys(status).sort();
    assert.deepEqual(statusKeys, ['activeRooms', 'games', 'ok']);

    await new Promise((resolve) => socket.once('connect', resolve));
    socket.emit('identify', { playerId: 'admin-guest' });
    await request(socket, 'get_profile');
    socket.emit('identify', { playerId: 'admin-buyer' });
    await signInByEmail(baseUrl, 'admin-buyer', 'admin-buyer@example.com', 'Admin Buyer');
    await request(socket, 'create_room', { playerId: 'admin-buyer', name: 'Admin Buyer' });
    const { order } = await request(socket, 'create_order', { type: 'dictionary', productId: 'city' });

    const overviewResponse = await fetch(`${baseUrl}/api/admin/overview`, { headers: { 'x-admin-pin': adminPin } });
    const overviewData = await overviewResponse.json();
    assert.equal(overviewData.ok, true);
    assert.equal(overviewData.overview.totals.pendingOrders, 1);
    assert.equal(overviewData.overview.rooms.length, 1);
    assert.equal(overviewData.overview.orders[0].id, order.id);
    assert.equal(overviewData.overview.profiles.length, 1);
    assert.equal(overviewData.overview.profiles[0].id, 'admin-buyer');
    assert.equal(overviewData.overview.profiles[0].email, 'admin-buyer@example.com');

    const confirmResponse = await fetch(`${baseUrl}/api/admin/orders/admin-buyer/${order.id}/confirm`, {
      method: 'POST',
      headers: { 'x-admin-pin': adminPin },
    });
    const confirmData = await confirmResponse.json();
    assert.equal(confirmData.ok, true);
    assert.equal(confirmData.order.status, 'paid');
    assert.equal(confirmData.overview.totals.paidOrders, 1);

    const grantResponse = await fetch(`${baseUrl}/api/admin/profiles/admin-buyer/grants`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-pin': adminPin },
      body: JSON.stringify({ type: 'game_pass', productId: 'spy_pass', months: 2 }),
    });
    const grantData = await grantResponse.json();
    assert.equal(grantData.ok, true);
    assert.equal(grantData.profile.gamePasses[0].gameId, 'spy');
    assert.equal(grantData.profile.purchases[0].provider, 'admin');

    const purchaseId = grantData.profile.purchases[0].id;
    const removePurchaseResponse = await fetch(`${baseUrl}/api/admin/profiles/admin-buyer/purchases/${purchaseId}`, {
      method: 'DELETE',
      headers: { 'x-admin-pin': adminPin },
    });
    const removePurchaseData = await removePurchaseResponse.json();
    assert.equal(removePurchaseData.ok, true);
    assert.equal(removePurchaseData.profile.purchases.some((purchase) => purchase.id === purchaseId), false);

    const revokeResponse = await fetch(`${baseUrl}/api/admin/profiles/admin-buyer/revoke`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-pin': adminPin },
      body: JSON.stringify({ type: 'game_pass', productId: 'spy_pass' }),
    });
    const revokeData = await revokeResponse.json();
    assert.equal(revokeData.ok, true);
    assert.equal(revokeData.profile.gamePasses.length, 0);
  } finally {
    socket.disconnect();
    server.kill();
  }
});

test('email account is required before creating orders', { timeout: 15000 }, async () => {
  const authPort = 7300 + Math.floor(Math.random() * 1000);
  const authUrl = `http://127.0.0.1:${authPort}`;
  const suffix = `${process.pid}-${Date.now()}`;
  const playerId = `email-buyer-${suffix}`;
  const email = `buyer-${suffix}@example.com`;
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(authPort), NODE_ENV: 'test' },
    stdio: 'ignore',
  });
  const socket = io(authUrl, { transports: ['websocket'] });
  try {
    assert.equal((await waitForServer(`${authUrl}/api/health`)).status, 200);
    await new Promise((resolve) => socket.once('connect', resolve));
    socket.emit('identify', { playerId });
    await assert.rejects(request(socket, 'create_order', { type: 'dictionary', productId: 'city' }), /Войдите или зарегистрируйтесь/);

    const verifyData = await signInByEmail(authUrl, playerId, email, 'Buyer');
    assert.equal(verifyData.created, true);
    assert.equal(verifyData.profile.accountType, 'email');
    assert.equal(verifyData.profile.email, email);

    socket.emit('identify', { playerId: verifyData.account.id });
    const order = await request(socket, 'create_order', { type: 'dictionary', productId: 'city' });
    assert.equal(order.order.status, 'pending');
  } finally {
    socket.disconnect();
    server.kill();
  }
});

test('yookassa payment link, return sync and webhook unlock an order', { timeout: 15000 }, async () => {
  const yookassaPort = 8300 + Math.floor(Math.random() * 500);
  const yookassaUrl = `http://127.0.0.1:${yookassaPort}`;
  const appPort = 8800 + Math.floor(Math.random() * 500);
  const appUrl = `http://127.0.0.1:${appPort}`;
  let savedPayment = null;
  let savedPaymentRequest = null;
  const mockYooKassa = createServer(async (request, response) => {
    response.setHeader('content-type', 'application/json');
    if (request.method === 'POST' && request.url === '/v3/payments') {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      savedPaymentRequest = body;
      savedPayment = {
        id: 'yk-test-payment',
        status: 'pending',
        amount: body.amount,
        metadata: body.metadata,
        confirmation: { confirmation_url: 'https://yookassa.test/checkout' },
      };
      response.end(JSON.stringify(savedPayment));
      return;
    }
    if (request.method === 'GET' && request.url === '/v3/payments/yk-test-payment') {
      response.end(JSON.stringify({ ...savedPayment, status: 'succeeded' }));
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ error: 'not found' }));
  });
  await new Promise((resolve) => mockYooKassa.listen(yookassaPort, '127.0.0.1', resolve));
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(appPort),
      NODE_ENV: 'test',
      YOOKASSA_SHOP_ID: 'shop-test',
      YOOKASSA_SECRET_KEY: 'secret-test',
      YOOKASSA_API_URL: `${yookassaUrl}/v3`,
      PUBLIC_BASE_URL: appUrl,
    },
    stdio: 'ignore',
  });
  const socket = io(appUrl, { transports: ['websocket'] });
  try {
    assert.equal((await waitForServer(`${appUrl}/api/health`)).status, 200);
    await signInByEmail(appUrl, 'yk-buyer', 'yk-buyer@example.com', 'Yoo Buyer');
    await new Promise((resolve) => socket.once('connect', resolve));
    socket.emit('identify', { playerId: 'yk-buyer' });

    const checkout = await request(socket, 'create_order', { type: 'dictionary', productId: 'city' });
    assert.equal(checkout.payment.provider, 'yookassa');
    assert.equal(checkout.payment.confirmationUrl, 'https://yookassa.test/checkout');
    assert.equal(savedPayment.metadata.orderId, checkout.order.id);
    assert.equal(savedPaymentRequest.receipt.customer.email, 'yk-buyer@example.com');
    assert.equal(savedPaymentRequest.receipt.items[0].payment_subject, 'service');

    const syncData = await request(socket, 'sync_order', { orderId: checkout.order.id });
    assert.equal(syncData.order.status, 'paid');
    assert.equal(syncData.profile.purchases[0].paymentId, 'yk-test-payment');

    const webhookResponse = await fetch(`${appUrl}/api/yookassa/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event: 'payment.succeeded', object: { id: 'yk-test-payment' } }),
    });
    const webhookData = await webhookResponse.json();
    assert.equal(webhookData.ok, true);
    assert.equal(webhookData.status, 'paid');

    const profileData = await request(socket, 'get_profile');
    assert.equal(profileData.profile.orders[0].status, 'paid');
    assert.equal(profileData.profile.purchases[0].provider, 'yookassa');
    assert.equal(profileData.profile.purchases[0].paymentId, 'yk-test-payment');
  } finally {
    socket.disconnect();
    server.kill();
    await new Promise((resolve) => mockYooKassa.close(resolve));
  }
});
