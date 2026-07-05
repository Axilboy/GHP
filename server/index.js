import { createServer } from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import tls from 'node:tls';
import { appendFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import {
  addPlayer,
  allRooms,
  cleanupInactiveRooms,
  createRoom,
  getRoom,
  getRoomByCode,
  publicRoom,
  removePlayer,
  restoreRooms,
  touchRoom,
  updateRoomSettings,
  uniquePlayerName,
} from './roomStore.js';
import { connectRoomPersistence, loadRoomSnapshot, scheduleRoomSnapshot } from './roomPersistence.js';
import {
  createSpyRound,
  getSpyDictionary,
  getSpyBundle,
  getSpyLocations,
  getSpyPlayerCard,
  listSpyDictionaries,
  listSpyBundles,
  spyDefinition,
} from './games/spy/index.js';
import {
  activateDemoPro,
  activateDemoPlan,
  adminGrantAccess,
  adminRemovePurchase,
  adminRevokeAccess,
  activatePartyPass,
  addCustomLocation,
  attachOrderPayment,
  cancelOrder,
  confirmDemoOrder,
  confirmPaidOrder,
  createOrder,
  findOrderByPaymentId,
  unlockCustomDictionary,
  allProfiles,
  getOrCreateProfile,
  hasAdFreeAccess,
  hasTimedGameAccess,
  publicProfile,
  unlockDemoDictionary,
  unlockBundle,
  recordGame,
  restoreProfiles,
  updateProfileAvatar,
  updateProfileName,
} from './profileStore.js';
import { connectProfilePersistence, loadProfileSnapshot, scheduleProfileSnapshot } from './profilePersistence.js';
import { analyticsSnapshot, connectAnalyticsPersistence, restoreAnalyticsSnapshot, track } from './analyticsStore.js';
import { aliasDefinition, aliasDictionaryPreview, createAliasRound, createAliasTeams, nextAliasWord } from './games/alias/index.js';
import {
  bunkerActiveContestants,
  bunkerCardFields,
  bunkerContentPacks,
  bunkerDefinition,
  continueBunkerRound,
  createBunkerRound,
  currentBunkerRevealPlayer,
  getBunkerPlayerCard,
  publicBunkerCards,
  startBunkerAfterBriefing,
} from './games/bunker/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });
const port = Number(process.env.PORT || 3100);
const inactiveRoomTtlMs = Number(process.env.ROOM_TTL_MS || 6 * 60 * 60 * 1000);
const rateLimits = new Map();
const authCodes = new Map();
const feedbackDir = process.env.FEEDBACK_DIR || path.join(__dirname, '..', 'artifacts', 'feedback');

app.use(express.json({ limit: '64kb' }));

app.get('/api/health', (_request, response) => response.json({ ok: true }));
app.get('/api/status', (_request, response) => response.json({ ok: true, games: ['spy', 'alias', 'bunker'], activeRooms: allRooms().length, analytics: analyticsSnapshot() }));
app.get('/api/games', (_request, response) => response.json({ games: [spyDefinition, aliasDefinition, bunkerDefinition] }));
app.post('/api/analytics/track', (request, response) => {
  try {
    checkHttpRate(request, 'analytics', 80, 60 * 1000);
    const event = normalizeAnalyticsEvent(request);
    track(event.name, event.details);
    response.json({ ok: true });
  } catch (error) {
    response.status(error.status || 400).json({ ok: false, error: error.message || 'Analytics failed' });
  }
});
app.post('/api/vk/launch', (request, response) => {
  const result = verifyVkLaunch(request.body?.params || {}, process.env.VK_APP_SECRET);
  response.json(result);
});
app.post('/api/feedback', async (request, response) => {
  try {
    checkHttpRate(request, 'feedback', 5, 10 * 60 * 1000);
    const feedback = normalizeFeedback(request);
    await saveFeedback(feedback);
    const mail = await sendFeedbackEmail(feedback).catch((error) => ({ delivered: false, error: error.message || 'SMTP failed' }));
    track('feedback_sent', { topic: feedback.topic, playerId: feedback.playerId, page: feedback.page });
    response.json({ ok: true, id: feedback.id, saved: true, mailed: Boolean(mail.delivered) });
  } catch (error) {
    response.status(error.status || 400).json({ ok: false, error: error.message || 'Feedback failed' });
  }
});
app.post('/api/yookassa/webhook', async (request, response) => {
  try {
    const result = await handleYooKassaWebhook(request.body || {});
    response.json({ ok: true, ...result });
  } catch (error) {
    response.status(error.status || 400).json({ ok: false, error: error.message || 'YooKassa webhook failed' });
  }
});
app.post('/api/auth/request-code', async (request, response) => {
  try {
    checkHttpRate(request, 'auth_request', 5, 10 * 60 * 1000);
    const email = cleanEmail(request.body?.email);
    const code = process.env.AUTH_TEST_CODE || (process.env.NODE_ENV === 'test' ? '111111' : String(Math.floor(100000 + Math.random() * 900000)));
    authCodes.set(email, { code, expiresAt: Date.now() + 10 * 60 * 1000 });
    await sendSystemEmail({
      to: email,
      subject: 'Код входа GameHubParty',
      text: `Ваш код входа в GameHubParty: ${code}\n\nКод действует 10 минут. Если вы не запрашивали вход, просто проигнорируйте письмо.`,
    });
    response.json({ ok: true });
  } catch (error) {
    response.status(error.status || 400).json({ ok: false, error: error.message || 'Auth code failed' });
  }
});
app.post('/api/auth/verify-code', (request, response) => {
  try {
    checkHttpRate(request, 'auth_verify', 10, 10 * 60 * 1000);
    const email = cleanEmail(request.body?.email);
    const code = String(request.body?.code || '').replace(/\D/g, '');
    const saved = authCodes.get(email);
    if (!saved || saved.expiresAt < Date.now() || saved.code !== code) throw new Error('Код неверный или устарел.');
    authCodes.delete(email);
    const profile = attachEmailAccount(request.body?.playerId, email, request.body?.name);
    persistProfiles();
    response.json({ ok: true, account: { id: profile.id, email: profile.email, name: profile.name }, profile: publicProfile(profile) });
  } catch (error) {
    response.status(error.status || 400).json({ ok: false, error: error.message || 'Auth verify failed' });
  }
});
app.get('/api/games/alias/catalog', (_request, response) => response.json({ definition: aliasDefinition, dictionaries: aliasDictionaryPreview }));
app.get('/api/games/bunker/catalog', (_request, response) => response.json({ definition: bunkerDefinition, fields: bunkerCardFields, contentPacks: bunkerContentPacks }));
app.get('/api/games/spy/catalog', (_request, response) => response.json({
  definition: spyDefinition,
  dictionaries: listSpyDictionaries(),
  bundles: listSpyBundles(),
  aliasDictionaries: aliasDictionaryPreview,
  bunkerContentPacks,
  subscriptions: [{ id: 'pro', name: 'PRO на месяц', priceRub: 299 }],
  gamePasses: [
    { id: 'spy_pass', name: 'Spy Pass', gameId: 'spy', priceRub: 99 },
    { id: 'alias_pass', name: 'Alias Pass', gameId: 'alias', priceRub: 99 },
    { id: 'bunker_pass', name: 'Bunker Pass', gameId: 'bunker', priceRub: 99 },
  ],
  passes: [{ id: 'party_pass_24h', name: 'WeekendPass', hours: 24, priceRub: 149 }],
  themes: roomThemes,
}));
app.get('/api/games/spy/locations', (_request, response) => response.json({
  locations: getSpyLocations(['base']).map(({ id, name }) => ({ id, name })),
}));
app.get('/api/admin/overview', requireAdmin, (_request, response) => {
  response.json({ ok: true, overview: adminOverview() });
});
app.post('/api/admin/orders/:playerId/:orderId/confirm', requireAdmin, (request, response) => {
  try {
    const { profile, order } = confirmDemoOrder(request.params.playerId, request.params.orderId);
    track('admin_order_paid', { type: order.type, productId: order.productId, playerId: profile.id });
    persistProfiles();
    response.json({ ok: true, order: adminOrderSummary(profile, order), overview: adminOverview() });
  } catch (error) {
    response.status(404).json({ ok: false, error: error.message || 'Order not found' });
  }
});
app.post('/api/admin/profiles/:playerId/grants', requireAdmin, (request, response) => {
  try {
    const { profile, purchase } = adminGrantAccess(request.params.playerId, request.body || {});
    track('admin_grant', { type: purchase.type, productId: purchase.productId, playerId: profile.id });
    persistProfiles();
    response.json({ ok: true, profile: adminProfileSummary(profile), purchase, overview: adminOverview() });
  } catch (error) {
    response.status(400).json({ ok: false, error: error.message || 'Grant failed' });
  }
});
app.post('/api/admin/profiles/:playerId/revoke', requireAdmin, (request, response) => {
  try {
    const profile = adminRevokeAccess(request.params.playerId, request.body || {});
    track('admin_revoke', { type: request.body?.type, productId: request.body?.productId, playerId: profile.id });
    persistProfiles();
    response.json({ ok: true, profile: adminProfileSummary(profile), overview: adminOverview() });
  } catch (error) {
    response.status(400).json({ ok: false, error: error.message || 'Revoke failed' });
  }
});
app.delete('/api/admin/profiles/:playerId/purchases/:purchaseId', requireAdmin, (request, response) => {
  try {
    const profile = adminRemovePurchase(request.params.playerId, request.params.purchaseId);
    track('admin_purchase_removed', { playerId: profile.id });
    persistProfiles();
    response.json({ ok: true, profile: adminProfileSummary(profile), overview: adminOverview() });
  } catch (error) {
    response.status(400).json({ ok: false, error: error.message || 'Remove purchase failed' });
  }
});

if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '..', 'dist');
  app.use(express.static(dist));
  app.get('/{*splat}', (_request, response) => response.sendFile(path.join(dist, 'index.html')));
}

function cleanName(value) {
  const name = String(value || '').trim().slice(0, 24);
  if (!name) throw new Error('Введите имя');
  return name;
}

function yooKassaConfig() {
  const shopId = String(process.env.YOOKASSA_SHOP_ID || process.env.YOOKASSA_SHOPID || '').trim();
  const secretKey = String(process.env.YOOKASSA_SECRET_KEY || '').trim();
  return {
    shopId,
    secretKey,
    enabled: Boolean(shopId && secretKey),
    apiUrl: String(process.env.YOOKASSA_API_URL || 'https://api.yookassa.ru/v3').replace(/\/+$/, ''),
  };
}

function demoCheckoutEnabled() {
  return process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEMO_CHECKOUT === '1';
}

function publicBaseUrl() {
  return String(process.env.PUBLIC_BASE_URL || process.env.SITE_URL || `http://localhost:${port}`).replace(/\/+$/, '');
}

function yooKassaAuthHeader(config = yooKassaConfig()) {
  return `Basic ${Buffer.from(`${config.shopId}:${config.secretKey}`).toString('base64')}`;
}

function orderReturnUrl(order) {
  const configured = String(process.env.YOOKASSA_RETURN_URL || '').trim();
  if (configured) return configured;
  return `${publicBaseUrl()}/store?order=${encodeURIComponent(order.id)}`;
}

async function yooKassaRequest(pathname, options = {}) {
  const config = yooKassaConfig();
  if (!config.enabled) {
    const error = new Error('YooKassa credentials are not configured');
    error.status = 503;
    throw error;
  }
  const response = await fetch(`${config.apiUrl}${pathname}`, {
    ...options,
    headers: {
      authorization: yooKassaAuthHeader(config),
      accept: 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.description || data.message || 'YooKassa request failed');
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

async function createYooKassaPayment(profile, order) {
  if (!yooKassaConfig().enabled) return null;
  if (!profile.email) throw new Error('Войдите по почте перед оплатой, чтобы YooKassa отправила чек.');
  const payment = await yooKassaRequest('/payments', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotence-key': order.id,
    },
    body: JSON.stringify({
      amount: { value: Number(order.amountRub || 0).toFixed(2), currency: 'RUB' },
      capture: true,
      confirmation: { type: 'redirect', return_url: orderReturnUrl(order) },
      description: `${order.title} (${order.id})`.slice(0, 128),
      metadata: {
        playerId: profile.id,
        orderId: order.id,
        productType: order.type,
        productId: order.productId,
      },
      receipt: {
        customer: { email: profile.email },
        items: [{
          description: order.title.slice(0, 128),
          quantity: '1.00',
          amount: { value: Number(order.amountRub || 0).toFixed(2), currency: 'RUB' },
          vat_code: Number(process.env.YOOKASSA_VAT_CODE || 1),
          payment_mode: 'full_payment',
          payment_subject: 'service',
        }],
      },
    }),
  });
  return {
    id: payment.id,
    status: payment.status,
    confirmationUrl: payment.confirmation?.confirmation_url || '',
  };
}

async function getYooKassaPayment(paymentId) {
  return yooKassaRequest(`/payments/${encodeURIComponent(paymentId)}`);
}

async function verifiedYooKassaPayment(notificationPayment) {
  const paymentId = notificationPayment?.id;
  if (!paymentId) throw new Error('YooKassa payment id is missing');
  if (!yooKassaConfig().enabled) return notificationPayment;
  return getYooKassaPayment(paymentId);
}

async function handleYooKassaWebhook(notification) {
  const event = String(notification?.event || '');
  if (!['payment.succeeded', 'payment.canceled'].includes(event)) return { ignored: true };
  const payment = await verifiedYooKassaPayment(notification.object || {});
  const metadata = payment.metadata || {};
  let playerId = String(metadata.playerId || '').trim();
  let orderId = String(metadata.orderId || '').trim();
  if ((!playerId || !orderId) && payment.id) {
    const found = findOrderByPaymentId(payment.id);
    playerId = playerId || found?.profile?.id || '';
    orderId = orderId || found?.order?.id || '';
  }
  if (!playerId || !orderId) throw new Error('YooKassa order metadata is missing');

  if (event === 'payment.canceled' || payment.status === 'canceled') {
    const { order } = cancelOrder(playerId, orderId, payment.cancellation_details?.reason || 'canceled');
    persistProfiles();
    track('order_canceled', { type: order.type, productId: order.productId, playerId, provider: 'yookassa' });
    return { orderId: order.id, status: order.status };
  }

  if (payment.status !== 'succeeded') return { ignored: true, status: payment.status };
  const found = findOrderByPaymentId(payment.id);
  const orderForCheck = found?.order || getOrCreateProfile(playerId).orders.find((item) => item.id === orderId);
  if (!orderForCheck) throw new Error('Order not found');
  const expected = Number(orderForCheck.amountRub || 0).toFixed(2);
  const actual = Number(payment.amount?.value || 0).toFixed(2);
  if (expected !== actual || payment.amount?.currency !== 'RUB') {
    throw new Error('YooKassa payment amount mismatch');
  }
  const { profile, order } = confirmPaidOrder(playerId, orderId, 'yookassa', payment.id);
  track('order_paid', { type: order.type, productId: order.productId, playerId, amountRub: order.amountRub, provider: 'yookassa' });
  await sendPurchaseAccessEmail(profile, order).catch((error) => console.error('Purchase email failed:', error.message || error));
  persistProfiles();
  return { orderId: order.id, status: order.status, profile: publicProfile(profile) };
}

async function syncYooKassaOrder(playerId, orderId) {
  const profile = getOrCreateProfile(playerId);
  const order = profile.orders.find((item) => item.id === String(orderId || '').trim());
  if (!order) throw new Error('Заказ не найден');
  if (order.status === 'paid') return { profile, order };
  if (order.provider !== 'yookassa' || !order.paymentId) return { profile, order };
  const payment = await getYooKassaPayment(order.paymentId);
  order.paymentStatus = payment.status || order.paymentStatus || null;
  if (payment.status === 'canceled') {
    const result = cancelOrder(playerId, order.id, payment.cancellation_details?.reason || 'canceled');
    persistProfiles();
    return result;
  }
  if (payment.status !== 'succeeded') {
    profile.updatedAt = Date.now();
    persistProfiles();
    return { profile, order };
  }
  const expected = Number(order.amountRub || 0).toFixed(2);
  const actual = Number(payment.amount?.value || 0).toFixed(2);
  if (expected !== actual || payment.amount?.currency !== 'RUB') throw new Error('YooKassa payment amount mismatch');
  const result = confirmPaidOrder(playerId, order.id, 'yookassa', payment.id);
  result.order.paymentStatus = payment.status;
  track('order_paid', { type: result.order.type, productId: result.order.productId, playerId, amountRub: result.order.amountRub, provider: 'yookassa' });
  await sendPurchaseAccessEmail(result.profile, result.order).catch((error) => console.error('Purchase email failed:', error.message || error));
  persistProfiles();
  return result;
}

function toBase64Url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function verifyVkLaunch(params, secret) {
  const safeParams = Object.fromEntries(Object.entries(params).map(([key, value]) => [String(key), String(value)]));
  const signedPayload = Object.keys(safeParams)
    .filter((key) => key.startsWith('vk_'))
    .sort()
    .map((key) => `${key}=${safeParams[key]}`)
    .join('&');
  const expected = secret && signedPayload
    ? toBase64Url(crypto.createHmac('sha256', secret).update(signedPayload).digest())
    : '';
  const verified = Boolean(secret && safeParams.sign && expected === safeParams.sign);
  return {
    ok: true,
    verified,
    mode: secret ? 'signature' : 'no_secret',
    vk: {
      appId: safeParams.vk_app_id || '',
      userId: safeParams.vk_user_id || '',
      platform: safeParams.vk_platform || '',
      language: safeParams.vk_language || '',
    },
  };
}

function requireAdmin(request, response, next) {
  const expectedPin = String(process.env.ADMIN_PIN || '1973');
  const providedPin = String(request.get('x-admin-pin') || request.query.pin || request.body?.pin || '');
  if (providedPin !== expectedPin) {
    response.status(403).json({ ok: false, error: 'Admin access denied' });
    return;
  }
  next();
}

function cleanFeedbackText(value, limit) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function cleanEmail(value) {
  const email = String(value || '').trim().toLowerCase().slice(0, 160);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Введите корректную почту.');
  return email;
}

function cleanAvatarDataUrl(value) {
  const dataUrl = String(value || '').trim();
  if (!dataUrl) return '';
  if (dataUrl.length > 350000) throw new Error('Картинка слишком большая. Выберите файл поменьше.');
  if (!/^data:image\/(png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(dataUrl)) throw new Error('Поддерживаются PNG, JPG и WEBP.');
  return dataUrl;
}

function attachEmailAccount(playerId, email, name) {
  const existing = allProfiles().find((profile) => profile.email === email);
  const profile = existing || getOrCreateProfile(playerId || `email-${crypto.randomUUID()}`, name || email.split('@')[0]);
  profile.email = email;
  profile.accountType = 'email';
  if (name) profile.name = cleanFeedbackText(name, 24) || profile.name;
  profile.updatedAt = Date.now();
  return profile;
}

function normalizeFeedback(request) {
  const topics = new Set(['idea', 'bug', 'payment', 'other']);
  const topic = topics.has(request.body?.topic) ? request.body.topic : 'other';
  const message = cleanFeedbackText(request.body?.message, 2000);
  const contactEmail = cleanFeedbackText(request.body?.contactEmail, 120);
  if (message.length < 8) throw new Error('Напишите чуть подробнее, чтобы мы поняли ситуацию.');
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) throw new Error('Почта для ответа выглядит некорректно.');
  return {
    id: crypto.randomUUID(),
    topic,
    message,
    contactEmail,
    playerId: cleanFeedbackText(request.body?.playerId, 100),
    playerName: cleanFeedbackText(request.body?.playerName, 80),
    page: cleanFeedbackText(request.body?.page, 300),
    userAgent: cleanFeedbackText(request.get('user-agent'), 300),
    ip: cleanFeedbackText(request.ip, 80),
    createdAt: new Date().toISOString(),
  };
}

function normalizeAnalyticsEvent(request) {
  const allowed = new Set(['page_view', 'open_store', 'start_checkout', 'payment_success', 'payment_failed', 'feedback_opened']);
  const name = String(request.body?.name || '').trim().toLowerCase().replace(/[^a-z0-9:_-]+/g, '_').slice(0, 80);
  if (!allowed.has(name)) throw new Error('Unknown analytics event');
  const details = request.body?.details || {};
  return {
    name,
    details: {
      page: cleanFeedbackText(details.page, 80),
      path: cleanFeedbackText(details.path, 160),
      playerId: cleanFeedbackText(details.playerId, 100),
      sessionId: cleanFeedbackText(details.sessionId, 100),
      referrer: cleanFeedbackText(details.referrer, 160),
      source: cleanFeedbackText(details.source || details.utmSource, 80),
      medium: cleanFeedbackText(details.medium || details.utmMedium, 80),
      campaign: cleanFeedbackText(details.campaign || details.utmCampaign, 80),
      productId: cleanFeedbackText(details.productId, 80),
      type: cleanFeedbackText(details.type, 80),
      userAgent: cleanFeedbackText(request.get('user-agent'), 180),
    },
  };
}

async function saveFeedback(feedback) {
  await mkdir(feedbackDir, { recursive: true });
  await appendFile(path.join(feedbackDir, 'feedback.jsonl'), `${JSON.stringify(feedback)}\n`, 'utf8');
}

async function sendFeedbackEmail(feedback) {
  const topicNames = { idea: 'Предложение', bug: 'Баг', payment: 'Оплата', other: 'Другое' };
  return sendSystemEmail({
    to: process.env.FEEDBACK_TO || process.env.SUPPORT_EMAIL || 'support@gamehubparty.ru',
    subject: `GameHubParty: ${topicNames[feedback.topic] || 'Обратная связь'}`,
    replyTo: feedback.contactEmail,
    text: [
      `Тема: ${topicNames[feedback.topic] || feedback.topic}`,
      `Сообщение: ${feedback.message}`,
      `Почта для ответа: ${feedback.contactEmail || 'не указана'}`,
      `Игрок: ${feedback.playerName || '-'} (${feedback.playerId || '-'})`,
      `Страница: ${feedback.page || '-'}`,
      `Время: ${feedback.createdAt}`,
      `User-Agent: ${feedback.userAgent || '-'}`,
    ].join('\r\n'),
  });
}

async function sendPurchaseAccessEmail(profile, order) {
  if (!profile.email) return { delivered: false, reason: 'email_missing' };
  return sendSystemEmail({
    to: profile.email,
    subject: `GameHubParty: доступ открыт (${order.title})`,
    text: [
      `Здравствуйте, ${profile.name || 'игрок'}!`,
      '',
      'Оплата прошла, цифровой доступ открыт в вашем профиле GameHubParty.',
      '',
      `Заказ: ${order.id}`,
      `Товар: ${order.title}`,
      `Сумма: ${order.amountRub} ₽`,
      `Статус: ${order.status}`,
      `Платеж YooKassa: ${order.paymentId || '-'}`,
      '',
      `Профиль: ${publicBaseUrl()}/profile`,
      '',
      'Это письмо подтверждает открытие доступа. Кассовый чек отправляется через платежный/фискальный контур YooKassa на почту, указанную при оплате.',
    ].join('\r\n'),
  });
}

async function sendSystemEmail({ to, subject, text, replyTo = '' }) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return { delivered: false, reason: 'smtp_not_configured' };
  const from = process.env.FEEDBACK_FROM || user;
  const socket = tls.connect({ host, port: Number(process.env.SMTP_PORT || 465), servername: host, timeout: 10000 });
  socket.setEncoding('utf8');
  const smtp = createSmtpSession(socket);
  try {
    await smtp.ready();
    await smtp.command(`EHLO ${process.env.SMTP_HELO || 'gamehubparty.ru'}`, [250]);
    await smtp.command('AUTH LOGIN', [334]);
    await smtp.command(Buffer.from(user).toString('base64'), [334]);
    await smtp.command(Buffer.from(pass).toString('base64'), [235]);
    await smtp.command(`MAIL FROM:<${from}>`, [250]);
    await smtp.command(`RCPT TO:<${to}>`, [250, 251]);
    await smtp.command('DATA', [354]);
    socket.write(buildEmail({ from, to, subject, text, replyTo }));
    await smtp.read([250]);
    await smtp.command('QUIT', [221]).catch(() => {});
    return { delivered: true };
  } finally {
    socket.end();
  }
}

function createSmtpSession(socket) {
  let buffer = '';
  const readers = [];
  const fail = (error) => {
    while (readers.length) readers.shift().reject(error);
  };
  socket.on('data', (chunk) => {
    buffer += chunk;
    flushSmtpReaders();
  });
  socket.on('error', fail);
  socket.on('timeout', () => fail(new Error('SMTP timeout')));
  function flushSmtpReaders() {
    if (!readers.length) return;
    const lines = buffer.split(/\r?\n/).filter(Boolean);
    const finalIndex = lines.findIndex((line) => /^\d{3} /.test(line));
    if (finalIndex < 0) return;
    const response = lines.slice(0, finalIndex + 1).join('\n');
    buffer = lines.slice(finalIndex + 1).join('\r\n');
    readers.shift().resolve(response);
    flushSmtpReaders();
  }
  function read(expectedCodes) {
    return new Promise((resolve, reject) => {
      readers.push({
        resolve: (response) => {
          const code = Number(response.slice(0, 3));
          if (!expectedCodes.includes(code)) reject(new Error(`SMTP ${code}`));
          else resolve(response);
        },
        reject,
      });
      flushSmtpReaders();
    });
  }
  return {
    ready: () => read([220]),
    read,
    command: (line, expectedCodes) => {
      socket.write(`${line}\r\n`);
      return read(expectedCodes);
    },
  };
}

function encodeMailHeader(value) {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value).toString('base64')}?=`;
}

function buildEmail({ from, to, subject, text, replyTo }) {
  const headers = [
    `From: GameHubParty <${from}>`,
    `To: ${to}`,
    `Subject: ${encodeMailHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
  ];
  if (replyTo) headers.splice(2, 0, `Reply-To: ${replyTo}`);
  return `${headers.join('\r\n')}\r\n\r\n${String(text || '').replace(/^\./gm, '..')}\r\n.\r\n`;
}

function adminOrderSummary(profile, order) {
  return {
    id: order.id,
    playerId: profile.id,
    playerName: profile.name,
    type: order.type,
    productId: order.productId,
    title: order.title,
    amountRub: order.amountRub,
    months: order.months || null,
    status: order.status,
    provider: order.provider || 'demo',
    paymentId: order.paymentId || null,
    paymentStatus: order.paymentStatus || null,
    createdAt: order.createdAt,
    paidAt: order.paidAt || null,
  };
}

function adminRoomSummary(room) {
  return {
    id: room.id,
    code: room.code,
    gameId: room.gameId,
    state: room.state,
    hostId: room.hostId,
    hostName: room.players.find((player) => player.id === room.hostId)?.name || '',
    playersCount: room.players.length,
    onlineCount: room.players.filter((player) => player.online).length,
    roundNumber: room.round?.number || 0,
    roundPhase: room.round?.phase || null,
    updatedAt: room.updatedAt || room.createdAt || Date.now(),
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      ready: Boolean(player.ready),
      online: Boolean(player.online),
    })),
  };
}

function adminProfileSummary(profile) {
  const publicData = publicProfile(profile);
  return {
    id: publicData.id,
    name: publicData.name,
    email: publicData.email || '',
    accountType: publicData.accountType,
    avatarDataUrl: publicData.avatarDataUrl || '',
    pro: Boolean(publicData.pro),
    proPlus: Boolean(publicData.proPlus),
    subscription: publicData.subscription || null,
    gamePasses: publicData.gamePasses || [],
    partyPasses: publicData.partyPasses || [],
    ownedDictionaryIds: publicData.ownedDictionaryIds || ['base'],
    ownedDictionaryCount: publicData.ownedDictionaryIds?.length || 0,
    ownedThemeIds: publicData.ownedThemeIds || ['ghp'],
    customDictionaryOwned: Boolean(publicData.customDictionaryOwned),
    purchases: (publicData.purchases || []).slice(0, 10),
    ordersCount: publicData.orders?.length || 0,
    purchasesCount: publicData.purchases?.length || 0,
    updatedAt: publicData.updatedAt || 0,
  };
}

function adminOverview() {
  const profiles = allProfiles().map((profile) => publicProfile(profile));
  const registeredProfiles = profiles.filter((profile) => profile.accountType === 'email' || profile.email);
  const orders = profiles
    .flatMap((profile) => (profile.orders || []).map((order) => adminOrderSummary(profile, order)))
    .sort((left, right) => (right.createdAt || 0) - (left.createdAt || 0));
  const rooms = allRooms().map(adminRoomSummary).sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0));
  return {
    generatedAt: Date.now(),
    totals: {
      profiles: registeredProfiles.length,
      rooms: rooms.length,
      activeRooms: rooms.filter((room) => room.onlineCount > 0).length,
      orders: orders.length,
      pendingOrders: orders.filter((order) => order.status === 'pending').length,
      paidOrders: orders.filter((order) => order.status === 'paid').length,
      revenueRub: orders.filter((order) => order.status === 'paid').reduce((sum, order) => sum + (order.amountRub || 0), 0),
    },
    analytics: analyticsSnapshot(),
    rooms,
    orders,
    products: {
      dictionaries: listSpyDictionaries().filter((dictionary) => !dictionary.free).map(({ id, name, priceRub }) => ({ id, name, priceRub })),
      bundles: listSpyBundles().map(({ id, name, priceRub }) => ({ id, name, priceRub })),
      subscriptions: [
        { id: 'pro', name: 'PRO на месяц', priceRub: 299 },
      ],
      gamePasses: [
        { id: 'spy_pass', name: 'Spy Pass на месяц', gameId: 'spy', priceRub: 99 },
        { id: 'alias_pass', name: 'Alias Pass на месяц', gameId: 'alias', priceRub: 99 },
        { id: 'bunker_pass', name: 'Bunker Pass на месяц', gameId: 'bunker', priceRub: 99 },
      ],
      extras: [
        { type: 'custom_dictionary', id: 'custom_dictionary', name: 'Конструктор словарей', priceRub: 199 },
        { type: 'party_pass', id: 'party_pass_24h', name: 'WeekendPass 24 часа', priceRub: 149 },
      ],
      themes: roomThemes,
    },
    profiles: registeredProfiles.map(adminProfileSummary).sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0)),
  };
}

function cleanPlayerId(value) {
  const id = String(value || '').trim();
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new Error('Некорректный идентификатор игрока');
  return id;
}

async function replyWith(callback, action) {
  try {
    callback?.({ ok: true, ...(await action()) });
  } catch (error) {
    callback?.({ ok: false, error: error.message || 'Ошибка' });
  }
}

function emitRoom(room) {
  touchRoom(room);
  scheduleRoomSnapshot(allRooms);
  const adPolicy = getRoomAdPolicy(room);
  for (const player of room.players) {
    io.to(`player:${player.id}`).emit('room_updated', publicRoom(room, player.id, { adPolicy }));
  }
}

function getRoomAdPolicy(room) {
  const sponsor = room.players.find((player) => hasAdFreeAccess(getOrCreateProfile(player.id, player.name), Date.now(), room.gameId));
  return {
    enabled: !sponsor,
    adFree: Boolean(sponsor),
    sponsorPlayerId: sponsor?.id || null,
    sponsorName: sponsor?.name || '',
    provider: 'adsterra',
    placements: sponsor ? [] : ['pre_round', 'post_round', 'lobby_player_banner'],
  };
}

function resetRoomGame(room, gameId) {
  if (!['spy', 'alias', 'bunker'].includes(gameId) || room.gameId === gameId) return;
  room.gameId = gameId;
  room.settings = gameId === 'alias'
    ? { ...aliasDefinition.defaultSettings }
    : gameId === 'bunker'
      ? { ...bunkerDefinition.defaultSettings }
      : { ...spyDefinition.defaultSettings };
  room.scores = gameId === 'alias'
    ? { team_1: 0, team_2: 0 }
    : gameId === 'bunker'
      ? { saved: 0, eliminated: 0 }
      : { civilians: 0, spies: 0 };
  room.aliasTeams = [];
  room.usedAliasWords = [];
  room.round = null;
  room.matchHistory = [];
  room.players.forEach((player) => { player.ready = player.id === room.hostId; });
}

const roomThemes = [
  { id: 'ghp', name: 'GHP Classic', priceRub: 0, free: true },
  { id: 'partyhub', name: 'PartyHub', priceRub: 149, free: false },
];

function ownedThemeIds(playerId) {
  const profile = getOrCreateProfile(playerId);
  return new Set(['ghp', ...(profile.ownedThemeIds || [])]);
}

function assertThemeAvailable(playerId, themeId) {
  const safeThemeId = String(themeId || 'ghp').trim();
  if (!roomThemes.some((theme) => theme.id === safeThemeId)) throw new Error('Тема не найдена');
  if (!ownedThemeIds(playerId).has(safeThemeId)) throw new Error('Сначала купите эту тему');
  return safeThemeId;
}

function persistProfiles() {
  scheduleProfileSnapshot(allProfiles);
}

function persistRooms() {
  scheduleRoomSnapshot(allRooms);
}

function checkRate(socket, key, limit, windowMs) {
  const now = Date.now();
  const identity = `${socket.handshake.address}:${socket.data.playerId || 'anonymous'}:${key}`;
  const bucket = rateLimits.get(identity) || { startedAt: now, count: 0 };
  if (now - bucket.startedAt >= windowMs) {
    bucket.startedAt = now;
    bucket.count = 0;
  }
  bucket.count += 1;
  rateLimits.set(identity, bucket);
  if (bucket.count > limit) throw new Error('Слишком много действий. Подождите немного.');
}

function checkHttpRate(request, key, limit, windowMs) {
  const now = Date.now();
  const identity = `${request.ip}:${key}`;
  const bucket = rateLimits.get(identity) || { startedAt: now, count: 0 };
  if (now - bucket.startedAt >= windowMs) {
    bucket.startedAt = now;
    bucket.count = 0;
  }
  bucket.count += 1;
  rateLimits.set(identity, bucket);
  if (bucket.count > limit) {
    const error = new Error('Слишком много сообщений. Попробуйте чуть позже.');
    error.status = 429;
    throw error;
  }
}

function setRoundResult(room, winner, reason, extra = {}) {
  if (!room.round || room.round.phase === 'result') return;
  const subjectType = room.round.subjectType || room.settings.subjectType || 'location';
  room.round.phase = 'result';
  room.round.result = {
    winner,
    reason,
    locationName: room.round.locationName,
    subjectType,
    spyId: room.round.spyId,
    spyIds: room.round.spyIds || [room.round.spyId],
    ...extra,
  };
  room.scores[winner] += 1;
  room.matchHistory ??= [];
  room.matchHistory.unshift({ round: room.round.number, winner, reason, locationName: room.round.locationName, subjectType, at: Date.now() });
  room.matchHistory = room.matchHistory.slice(0, 20);
  room.state = room.scores[winner] >= room.settings.targetScore ? 'match_result' : 'round_result';
  track('round_finished', { gameId: room.gameId || 'spy', winner, reason, roomId: room.id });
  recordGame(room);
  persistProfiles();
  emitRoom(room);
}

function activePlayers(room) {
  return room.players.filter((player) => player.online);
}

function requireRoomPlayer(room, playerId) {
  const player = room?.players.find((item) => item.id === playerId);
  if (!room || !player) throw new Error('Вы не состоите в этой комнате');
  return player;
}

function finishVote(room) {
  const counts = {};
  for (const targetId of Object.values(room.round.votes)) counts[targetId] = (counts[targetId] || 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const tied = sorted.length < 1 || (sorted[1] && sorted[0][1] === sorted[1][1]);
  if (tied) {
    if (room.round.voteRound >= 2) return setRoundResult(room, 'spies', 'vote_tie');
    const topCount = sorted[0]?.[1] || 0;
    room.round.voteRound += 1;
    room.round.voteCandidateIds = sorted.filter(([, count]) => count === topCount).map(([id]) => id);
    room.round.votes = {};
    room.round.votingEndsAt = Date.now() + room.settings.votingSeconds * 1000;
    emitRoom(room);
    return;
  }
  const votedOutId = sorted[0][0];
  const spyIds = room.round.spyIds || [room.round.spyId];
  setRoundResult(room, spyIds.includes(votedOutId) ? 'civilians' : 'spies', spyIds.includes(votedOutId) ? 'spy_found' : 'civilian_accused', { votedOutId, voteCounts: counts });
}

function civilianPlayers(room) {
  const spyIds = room.round?.spyIds || [room.round?.spyId];
  return activePlayers(room).filter((player) => !spyIds.includes(player.id));
}

function finishSpyGuessReview(room) {
  const votes = room.round.spyGuessVotes || {};
  const yes = Object.values(votes).filter(Boolean).length;
  const no = Object.values(votes).filter((vote) => vote === false).length;
  const accepted = yes > no;
  setRoundResult(room, accepted ? 'spies' : 'civilians', accepted ? 'spy_guess_accepted' : 'spy_guess_rejected', {
    spyGuessVotes: { yes, no },
  });
}

function finishAliasTurn(room) {
  if (!room.round || room.round.phase !== 'alias_turn') return;
  const gained = Number(room.round.correct || 0);
  room.scores[room.round.teamId] = (room.scores[room.round.teamId] || 0) + gained;
  room.usedAliasWords = [...new Set([...(room.usedAliasWords || []), ...(room.round.wordsSeen || [])])].slice(-80);
  room.round.phase = 'result';
  room.round.result = {
    winner: room.round.teamId,
    teamId: room.round.teamId,
    teamName: room.round.teamName,
    correct: room.round.correct || 0,
    skipped: room.round.skipped || 0,
    gained,
  };
  room.matchHistory ??= [];
  room.matchHistory.unshift({ round: room.round.number, winner: room.round.teamId, teamName: room.round.teamName, gained, at: Date.now() });
  room.matchHistory = room.matchHistory.slice(0, 20);
  room.state = room.scores[room.round.teamId] >= room.settings.targetScore ? 'match_result' : 'round_result';
  track('round_finished', { gameId: 'alias', winner: room.round.teamId, reason: 'turn_finished', roomId: room.id });
  emitRoom(room);
}

function finishBunkerVote(room) {
  const contestants = bunkerActiveContestants(room);
  const counts = {};
  for (const targetId of Object.values(room.round.votes)) counts[targetId] = (counts[targetId] || 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const tied = sorted.length < 1 || (sorted[1] && sorted[0][1] === sorted[1][1]);
  if (tied) {
    if (room.round.voteRound >= 2) {
      room.round.phase = 'result';
      room.round.result = { reason: 'vote_tie', eliminatedId: null, voteCounts: counts, savedIds: contestants.map((player) => player.id) };
      room.state = 'round_result';
      track('round_finished', { gameId: 'bunker', reason: 'vote_tie', roomId: room.id });
      emitRoom(room);
      return;
    }
    const topCount = sorted[0]?.[1] || 0;
    room.round.voteRound += 1;
    room.round.voteCandidateIds = sorted.filter(([, count]) => count === topCount).map(([id]) => id);
    room.round.votes = {};
    room.round.votingEndsAt = Date.now() + room.settings.votingSeconds * 1000;
    emitRoom(room);
    return;
  }
  const eliminatedId = sorted[0][0];
  if (!room.round.eliminatedIds.includes(eliminatedId)) room.round.eliminatedIds.push(eliminatedId);
  const savedIds = bunkerActiveContestants(room).map((player) => player.id);
  room.scores = { saved: savedIds.length, eliminated: room.round.eliminatedIds.length };
  room.round.phase = 'result';
  room.round.result = { reason: 'voted_out', eliminatedId, voteCounts: counts, savedIds };
  room.matchHistory ??= [];
  room.matchHistory.unshift({ round: room.round.number, eliminatedId, savedCount: savedIds.length, at: Date.now() });
  room.matchHistory = room.matchHistory.slice(0, 20);
  room.state = savedIds.length <= room.round.shelterCapacity ? 'match_result' : 'round_result';
  track('round_finished', { gameId: 'bunker', reason: 'voted_out', roomId: room.id });
  emitRoom(room);
}

function finishBunkerByCapacity(room) {
  const savedIds = bunkerActiveContestants(room).map((player) => player.id);
  room.scores = { saved: savedIds.length, eliminated: room.round.eliminatedIds?.length || 0 };
  room.round.phase = 'result';
  room.round.result = { reason: 'capacity_reached', eliminatedId: null, voteCounts: {}, savedIds };
  room.state = 'match_result';
  track('round_finished', { gameId: 'bunker', reason: 'capacity_reached', roomId: room.id });
  emitRoom(room);
}

function startBunkerDiscussion(room) {
  room.round.phase = 'discussion';
  room.round.startedAt = Date.now();
  room.round.endsAt = Date.now() + room.settings.roundSeconds * 1000;
  room.round.voteStartRequestIds = [];
  emitRoom(room);
}

function startVoting(room) {
  if (!room.round || room.round.phase !== 'discussion') return;
  room.round.phase = 'voting';
  room.round.votes = {};
  room.round.voteRound = 1;
  room.round.voteCandidateIds = null;
  room.round.voteStartRequestIds = [];
  room.round.votingEndsAt = Date.now() + room.settings.votingSeconds * 1000;
  emitRoom(room);
}

function maybeAdvanceRound(room) {
  if (!room.round) return;
  if (room.gameId === 'alias') {
    if (room.round.phase === 'alias_turn' && room.round.endsAt <= Date.now()) finishAliasTurn(room);
    return;
  }
  if (room.gameId === 'bunker') {
    const activeIds = bunkerActiveContestants(room).map((player) => player.id);
    if (room.round.phase === 'briefing' && activeIds.every((id) => room.round.acceptedRuleIds?.includes(id))) {
      startBunkerAfterBriefing(room);
      emitRoom(room);
    } else if (room.round.phase === 'role_reveal' && activeIds.every((id) => room.round.seenIds.includes(id))) {
      startBunkerDiscussion(room);
    } else if (room.round.phase === 'voting' && activeIds.every((id) => room.round.votes[id])) {
      finishBunkerVote(room);
    }
    return;
  }
  const activeIds = activePlayers(room).map((player) => player.id);
  if (room.round.phase === 'role_reveal' && activeIds.every((id) => room.round.seenIds.includes(id))) {
    room.round.phase = 'discussion';
    room.round.startedAt = Date.now();
    room.round.endsAt = Date.now() + room.settings.roundSeconds * 1000;
    emitRoom(room);
  } else if (room.round.phase === 'voting' && activeIds.every((id) => room.round.votes[id])) {
    finishVote(room);
  } else if (room.round.phase === 'guess_review' && civilianPlayers(room).every((player) => room.round.spyGuessVotes?.[player.id] !== undefined)) {
    finishSpyGuessReview(room);
  }
}

function cancelRound(room) {
  room.round = null;
  room.state = 'lobby';
  room.players.forEach((player) => { player.ready = player.id === room.hostId; });
  emitRoom(room);
}

io.on('connection', (socket) => {
  socket.on('identify', ({ playerId }) => {
    if (!playerId) return;
    socket.data.playerId = String(playerId);
    socket.join(`player:${playerId}`);
    getOrCreateProfile(playerId);
    const room = allRooms().find((item) => item.players.some((player) => player.id === String(playerId)));
    const player = room?.players.find((item) => item.id === String(playerId));
    if (room && player) {
      socket.data.roomId = room.id;
      player.online = true;
      emitRoom(room);
    }
  });

  socket.on('create_room', (payload, callback) => replyWith(callback, () => {
    checkRate(socket, 'create_room', 3, 60000);
    const playerId = cleanPlayerId(payload.playerId);
    const gameId = ['alias', 'bunker'].includes(payload.gameId) ? payload.gameId : 'spy';
    const room = createRoom({ hostId: playerId, hostName: cleanName(payload.name), gameId });
    track('room_created', { gameId, playerId, roomId: room.id });
    updateProfileName(playerId, room.players[0].name);
    persistProfiles();
    socket.data.playerId = playerId;
    socket.data.roomId = room.id;
    socket.join(`player:${playerId}`);
    emitRoom(room);
    return { room: publicRoom(room, playerId, { adPolicy: getRoomAdPolicy(room) }) };
  }));

  socket.on('join_room', (payload, callback) => replyWith(callback, () => {
    checkRate(socket, 'join_room', 15, 60000);
    const room = getRoomByCode(payload.code);
    if (!room) throw new Error('Комната не найдена');
    const playerId = cleanPlayerId(payload.playerId);
    addPlayer(room, { playerId, name: cleanName(payload.name) });
    track('room_joined', { gameId: room.gameId || 'spy', playerId, roomId: room.id });
    updateProfileName(playerId, room.players.find((player) => player.id === playerId).name);
    persistProfiles();
    socket.data.playerId = playerId;
    socket.data.roomId = room.id;
    socket.join(`player:${playerId}`);
    emitRoom(room);
    return { room: publicRoom(room, playerId, { adPolicy: getRoomAdPolicy(room) }) };
  }));

  socket.on('resume_room', (payload, callback) => replyWith(callback, () => {
    const room = getRoom(payload.roomId);
    if (!room || !room.players.some((player) => player.id === payload.playerId)) throw new Error('Комната недоступна');
    const player = room.players.find((item) => item.id === payload.playerId);
    player.online = true;
    socket.data.playerId = payload.playerId;
    socket.data.roomId = room.id;
    socket.join(`player:${payload.playerId}`);
    emitRoom(room);
    return { room: publicRoom(room, payload.playerId, { adPolicy: getRoomAdPolicy(room) }) };
  }));

  socket.on('set_ready', ({ roomId, ready }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    const player = room?.players.find((item) => item.id === socket.data.playerId);
    if (!room || !player || room.state !== 'lobby') throw new Error('Действие недоступно');
    player.ready = player.id === room.hostId ? true : Boolean(ready);
    emitRoom(room);
    return {};
  }));

  socket.on('rename_player', ({ roomId, name }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    const player = room?.players.find((item) => item.id === socket.data.playerId);
    if (!room || !player || room.state !== 'lobby') throw new Error('Имя можно менять только в лобби');
    player.name = uniquePlayerName(room, cleanName(name), player.id);
    updateProfileName(player.id, player.name);
    persistProfiles();
    emitRoom(room);
    return { name: player.name };
  }));

  socket.on('change_game', ({ roomId, gameId }, callback) => replyWith(callback, () => {
    checkRate(socket, 'change_game', 12, 10000);
    const room = getRoom(roomId);
    if (!room || room.hostId !== socket.data.playerId || room.state !== 'lobby') throw new Error('Только хост может менять игру в лобби');
    resetRoomGame(room, String(gameId || 'spy'));
    emitRoom(room);
    return { room: publicRoom(room, socket.data.playerId, { adPolicy: getRoomAdPolicy(room) }) };
  }));

  socket.on('update_settings', ({ roomId, settings }, callback) => replyWith(callback, () => {
    checkRate(socket, 'settings', 20, 10000);
    const room = getRoom(roomId);
    if (!room || room.hostId !== socket.data.playerId || room.state !== 'lobby') throw new Error('Только хост может менять настройки');
    if (room.gameId === 'spy' && settings.dictionaryIds) {
      const profile = getOrCreateProfile(socket.data.playerId);
      const hasPartyPass = profile.partyPasses?.some((pass) => pass.activeUntil > Date.now());
      const freeDictionaryIds = listSpyDictionaries().filter((dictionary) => dictionary.free).map((dictionary) => dictionary.id);
      const hasSpyAccess = hasTimedGameAccess(profile, 'spy') || hasPartyPass;
      const allowed = new Set(hasSpyAccess ? listSpyDictionaries().map((dictionary) => dictionary.id) : [...(profile.ownedDictionaryIds || []), ...freeDictionaryIds]);
      if (settings.dictionaryIds.some((id) => !allowed.has(id))) throw new Error('Сначала приобретите этот словарь');
    }
    if (room.gameId === 'spy' && settings.mode === 'duo') {
      const profile = getOrCreateProfile(socket.data.playerId);
      const hasPartyPass = profile.partyPasses?.some((pass) => pass.activeUntil > Date.now());
      if (!hasTimedGameAccess(profile, 'spy') && !hasPartyPass) throw new Error('Режим «Два шпиона» доступен в PRO, Spy Pass или WeekendPass');
    }
    if (room.gameId === 'alias' && settings.dictionaryIds) {
      const profile = getOrCreateProfile(socket.data.playerId);
      const hasPartyPass = profile.partyPasses?.some((pass) => pass.activeUntil > Date.now());
      const hasAliasAccess = hasTimedGameAccess(profile, 'alias') || hasPartyPass;
      const freeIds = aliasDictionaryPreview.filter((dictionary) => dictionary.free).map((dictionary) => dictionary.id);
      const allowed = new Set(hasAliasAccess ? aliasDictionaryPreview.map((dictionary) => dictionary.id) : freeIds);
      if (settings.dictionaryIds.some((id) => !allowed.has(id))) throw new Error('Этот набор Alias доступен в Alias Pass, WeekendPass или PRO');
    }
    if (room.gameId === 'bunker' && settings.contentPackId) {
      const profile = getOrCreateProfile(socket.data.playerId);
      const hasPartyPass = profile.partyPasses?.some((pass) => pass.activeUntil > Date.now());
      const hasBunkerAccess = hasTimedGameAccess(profile, 'bunker') || hasPartyPass;
      const pack = bunkerContentPacks.find((item) => item.id === settings.contentPackId);
      if (pack && !pack.free && pack.tier !== 'free' && !hasBunkerAccess) throw new Error('Этот сценарий Бункера доступен в Bunker Pass, WeekendPass или PRO');
    }
    updateRoomSettings(room, settings);
    emitRoom(room);
    return {};
  }));

  socket.on('apply_room_theme', ({ roomId, themeId }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    if (!room || room.hostId !== socket.data.playerId || room.state !== 'lobby') throw new Error('Только хост может менять тему');
    const safeThemeId = assertThemeAvailable(socket.data.playerId, themeId);
    room.themeId = safeThemeId;
    room.themeSuggestions = (room.themeSuggestions || []).filter((suggestion) => suggestion.themeId !== safeThemeId);
    emitRoom(room);
    return {};
  }));

  socket.on('suggest_room_theme', ({ roomId, themeId }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    const player = room?.players.find((item) => item.id === socket.data.playerId);
    if (!room || !player || room.state !== 'lobby') throw new Error('Тему можно предложить только в лобби');
    const safeThemeId = assertThemeAvailable(socket.data.playerId, themeId);
    if (room.themeId === safeThemeId) return {};
    room.themeSuggestions = [
      ...(room.themeSuggestions || []).filter((suggestion) => suggestion.playerId !== player.id && suggestion.themeId !== safeThemeId),
      { playerId: player.id, playerName: player.name, themeId: safeThemeId, createdAt: Date.now() },
    ].slice(-5);
    emitRoom(room);
    return {};
  }));

  socket.on('accept_room_theme', ({ roomId, playerId, themeId }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    if (!room || room.hostId !== socket.data.playerId || room.state !== 'lobby') throw new Error('Только хост может принять тему');
    const suggestion = (room.themeSuggestions || []).find((item) => item.playerId === playerId && item.themeId === themeId);
    if (!suggestion) throw new Error('Предложение не найдено');
    assertThemeAvailable(playerId, themeId);
    room.themeId = suggestion.themeId;
    room.themeSuggestions = (room.themeSuggestions || []).filter((item) => item !== suggestion);
    emitRoom(room);
    return {};
  }));

  socket.on('start_round', ({ roomId }, callback) => replyWith(callback, () => {
    checkRate(socket, 'start_round', 5, 10000);
    const room = getRoom(roomId);
    if (!room || room.hostId !== socket.data.playerId) throw new Error('Только хост может начать раунд');
    if (room.state !== 'lobby') throw new Error('Раунд уже идёт');
    room.players = room.players.filter((player) => player.online);
    if (room.gameId === 'alias') {
      if (room.players.length < aliasDefinition.minPlayers) throw new Error('Нужно минимум 4 игрока');
      if (!room.players.every((player) => player.ready)) throw new Error('Не все игроки готовы');
      room.aliasTeams = createAliasTeams(room.players);
      room.round = createAliasRound(room);
      track('round_started', { gameId: 'alias', roomId: room.id, playersCount: room.players.length });
      room.state = 'playing';
      emitRoom(room);
      return {};
    }
    if (room.gameId === 'bunker') {
      if (room.players.length < bunkerDefinition.minPlayers) throw new Error('Нужно минимум 4 игрока');
      if (!room.players.every((player) => player.ready)) throw new Error('Не все игроки готовы');
      room.round = createBunkerRound(room);
      room.scores = { saved: room.players.length, eliminated: 0 };
      track('round_started', { gameId: 'bunker', roomId: room.id, playersCount: room.players.length });
      room.state = 'playing';
      emitRoom(room);
      return {};
    }
    if (room.players.length < spyDefinition.minPlayers) throw new Error('Нужно минимум 3 игрока');
    if (!room.players.every((player) => player.ready)) throw new Error('Не все игроки готовы');
    room.customLocations = getOrCreateProfile(room.hostId).customLocations || [];
    room.round = createSpyRound(room);
    track('round_started', { gameId: 'spy', mode: room.settings.mode, roomId: room.id, playersCount: room.players.length });
    room.lastLocations = [...room.lastLocations, room.round.locationId].slice(-5);
    room.state = 'playing';
    emitRoom(room);
    return {};
  }));

  socket.on('get_role', ({ roomId }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    requireRoomPlayer(room, socket.data.playerId);
    if (!room?.round) throw new Error('Раунд не найден');
    if (room.gameId === 'bunker') return { card: getBunkerPlayerCard(room, socket.data.playerId) };
    return { card: getSpyPlayerCard(room, socket.data.playerId) };
  }));

  socket.on('role_seen', ({ roomId }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    if (!room?.round || room.round.phase !== 'role_reveal') throw new Error('Действие недоступно');
    requireRoomPlayer(room, socket.data.playerId);
    if (room.gameId === 'bunker' && room.round.eliminatedIds?.includes(socket.data.playerId)) throw new Error('Исключённый игрок уже не открывает карточку');
    if (!room.round.seenIds.includes(socket.data.playerId)) room.round.seenIds.push(socket.data.playerId);
    maybeAdvanceRound(room);
    if (room.round.phase === 'role_reveal') emitRoom(room);
    return {};
  }));

  socket.on('bunker_accept_rules', ({ roomId }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    requireRoomPlayer(room, socket.data.playerId);
    if (room?.gameId !== 'bunker' || room.round?.phase !== 'briefing') throw new Error('Действие недоступно');
    room.round.acceptedRuleIds ??= [];
    if (!room.round.acceptedRuleIds.includes(socket.data.playerId)) room.round.acceptedRuleIds.push(socket.data.playerId);
    maybeAdvanceRound(room);
    if (room.round.phase === 'briefing') emitRoom(room);
    return {};
  }));

  socket.on('bunker_reveal_field', ({ roomId, fieldId, revealed }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    requireRoomPlayer(room, socket.data.playerId);
    if (room?.gameId !== 'bunker' || room.round?.phase !== 'public_reveal') throw new Error('Вскрытие карточек сейчас не идёт');
    if (currentBunkerRevealPlayer(room) !== socket.data.playerId) throw new Error('Сейчас вскрывается другой игрок');
    if (!bunkerCardFields.some((field) => field.id === fieldId)) throw new Error('Поле карточки не найдено');
    room.round.bunkerReveals ??= {};
    room.round.bunkerReveals[socket.data.playerId] ??= {};
    room.round.bunkerReveals[socket.data.playerId][fieldId] = Boolean(revealed);
    emitRoom(room);
    return {};
  }));

  socket.on('bunker_finish_reveal_turn', ({ roomId }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    requireRoomPlayer(room, socket.data.playerId);
    if (room?.gameId !== 'bunker' || room.round?.phase !== 'public_reveal') throw new Error('Вскрытие карточек сейчас не идёт');
    if (currentBunkerRevealPlayer(room) !== socket.data.playerId) throw new Error('Сейчас вскрывается другой игрок');
    const order = room.round.revealOrder || [];
    room.round.currentRevealIndex = (room.round.currentRevealIndex || 0) + 1;
    if (room.round.currentRevealIndex >= order.length) startBunkerDiscussion(room);
    else emitRoom(room);
    return {};
  }));

  socket.on('start_vote', ({ roomId }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    if (!room || room.hostId !== socket.data.playerId) throw new Error('Только хост начинает голосование');
    startVoting(room);
    return {};
  }));

  socket.on('request_vote', ({ roomId }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    requireRoomPlayer(room, socket.data.playerId);
    if (!room.round || room.round.phase !== 'discussion') throw new Error('Действие недоступно');
    room.round.voteStartRequestIds ??= [];
    if (!room.round.voteStartRequestIds.includes(socket.data.playerId)) room.round.voteStartRequestIds.push(socket.data.playerId);
    if (room.round.voteStartRequestIds.length > activePlayers(room).length / 2) startVoting(room);
    else emitRoom(room);
    return {};
  }));

  socket.on('get_profile', (_payload, callback) => replyWith(callback, () => ({
    profile: publicProfile(getOrCreateProfile(socket.data.playerId)),
  })));

  socket.on('update_profile', ({ name, avatarDataUrl }, callback) => replyWith(callback, () => {
    checkRate(socket, 'update_profile', 20, 60000);
    let profile = getOrCreateProfile(socket.data.playerId);
    if (name !== undefined) profile = updateProfileName(socket.data.playerId, cleanName(name));
    if (avatarDataUrl !== undefined) profile = updateProfileAvatar(socket.data.playerId, cleanAvatarDataUrl(avatarDataUrl));
    persistProfiles();
    return { profile: publicProfile(profile) };
  }));

  socket.on('create_order', ({ type, productId, months }, callback) => replyWith(callback, async () => {
    checkRate(socket, 'create_order', 20, 60000);
    const currentProfile = getOrCreateProfile(socket.data.playerId);
    if (currentProfile.accountType === 'guest') throw new Error('Войдите или зарегистрируйтесь, чтобы оформить покупку.');
    if (!yooKassaConfig().enabled && !demoCheckoutEnabled()) throw new Error('Оплата временно недоступна. Напишите в поддержку, если покупка нужна сейчас.');
    const { profile, order } = createOrder(socket.data.playerId, { type, productId, months });
    const payment = await createYooKassaPayment(profile, order);
    if (payment) attachOrderPayment(socket.data.playerId, order.id, {
      provider: 'yookassa',
      paymentId: payment.id,
      paymentUrl: payment.confirmationUrl,
      paymentStatus: payment.status,
    });
    track('order_created', { type, productId, playerId: profile.id, amountRub: order.amountRub, provider: payment ? 'yookassa' : 'demo' });
    persistProfiles();
    return {
      profile: publicProfile(profile),
      order,
      payment: payment ? { provider: 'yookassa', id: payment.id, confirmationUrl: payment.confirmationUrl } : null,
    };
  }));

  socket.on('confirm_demo_order', ({ orderId }, callback) => replyWith(callback, () => {
    checkRate(socket, 'confirm_demo_order', 20, 60000);
    if (!demoCheckoutEnabled()) throw new Error('Тестовое подтверждение заказов отключено на продакшене.');
    const { profile, order } = confirmDemoOrder(socket.data.playerId, orderId);
    track('order_paid', { type: order.type, productId: order.productId, playerId: profile.id, amountRub: order.amountRub, provider: 'demo' });
    persistProfiles();
    const room = socket.data.roomId ? getRoom(socket.data.roomId) : null;
    if (room) emitRoom(room);
    return { profile: publicProfile(profile), order };
  }));

  socket.on('sync_order', ({ orderId }, callback) => replyWith(callback, async () => {
    checkRate(socket, 'sync_order', 20, 60000);
    const { profile, order } = await syncYooKassaOrder(socket.data.playerId, orderId);
    const room = socket.data.roomId ? getRoom(socket.data.roomId) : null;
    if (room) emitRoom(room);
    return { profile: publicProfile(profile), order };
  }));

  socket.on('unlock_demo_dictionary', ({ dictionaryId }, callback) => replyWith(callback, () => {
    const dictionary = getSpyDictionary(dictionaryId);
    if (!dictionary) throw new Error('Набор не найден');
    const profile = unlockDemoDictionary(socket.data.playerId, dictionary);
    persistProfiles();
    return { profile: publicProfile(profile) };
  }));

  socket.on('unlock_bundle', ({ bundleId }, callback) => replyWith(callback, () => {
    const bundle = getSpyBundle(bundleId);
    if (!bundle) throw new Error('Пак не найден');
    const profile = unlockBundle(socket.data.playerId, bundle);
    persistProfiles();
    return { profile: publicProfile(profile) };
  }));

  socket.on('activate_demo_pro', (_payload, callback) => replyWith(callback, () => {
    const profile = activateDemoPro(socket.data.playerId);
    persistProfiles();
    const room = socket.data.roomId ? getRoom(socket.data.roomId) : null;
    if (room) emitRoom(room);
    return { profile: publicProfile(profile) };
  }));

  socket.on('activate_demo_plan', ({ plan, months }, callback) => replyWith(callback, () => {
    const profile = activateDemoPlan(socket.data.playerId, plan, months);
    persistProfiles();
    const room = socket.data.roomId ? getRoom(socket.data.roomId) : null;
    if (room) emitRoom(room);
    return { profile: publicProfile(profile) };
  }));

  socket.on('add_custom_location', ({ location }, callback) => replyWith(callback, () => {
    const profile = addCustomLocation(socket.data.playerId, location);
    persistProfiles();
    return { profile: publicProfile(profile) };
  }));

  socket.on('unlock_custom_dictionary', (_payload, callback) => replyWith(callback, () => {
    const profile = unlockCustomDictionary(socket.data.playerId);
    persistProfiles();
    return { profile: publicProfile(profile) };
  }));

  socket.on('activate_party_pass', ({ hours }, callback) => replyWith(callback, () => {
    const profile = activatePartyPass(socket.data.playerId, hours);
    persistProfiles();
    const room = socket.data.roomId ? getRoom(socket.data.roomId) : null;
    if (room) emitRoom(room);
    return { profile: publicProfile(profile) };
  }));

  socket.on('vote', ({ roomId, targetId }, callback) => replyWith(callback, () => {
    checkRate(socket, 'vote', 10, 10000);
    const room = getRoom(roomId);
    requireRoomPlayer(room, socket.data.playerId);
    if (!room?.round || room.round.phase !== 'voting') throw new Error('Голосование не идёт');
    if (targetId === socket.data.playerId) throw new Error('Нельзя голосовать за себя');
    if (!room.players.some((player) => player.id === targetId)) throw new Error('Игрок не найден');
    if (room.gameId === 'bunker') {
      const contestantIds = bunkerActiveContestants(room).map((player) => player.id);
      if (!contestantIds.includes(socket.data.playerId)) throw new Error('Исключённые игроки не голосуют');
      if (!contestantIds.includes(targetId)) throw new Error('За этого игрока уже нельзя голосовать');
      if (room.round.voteCandidateIds && !room.round.voteCandidateIds.includes(targetId)) throw new Error('В переголосовании доступны только лидеры');
      room.round.votes[socket.data.playerId] = targetId;
      if (Object.keys(room.round.votes).length === contestantIds.length) finishBunkerVote(room);
      else emitRoom(room);
      return {};
    }
    if (room.round.voteCandidateIds && !room.round.voteCandidateIds.includes(targetId)) throw new Error('В переголосовании доступны только лидеры');
    room.round.votes[socket.data.playerId] = targetId;
    if (Object.keys(room.round.votes).length === activePlayers(room).length) finishVote(room);
    else emitRoom(room);
    return {};
  }));

  socket.on('spy_guess', ({ roomId }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    requireRoomPlayer(room, socket.data.playerId);
    const subjectType = room?.settings.subjectType || 'location';
    const subjectName = subjectType === 'item' ? 'предмета' : 'локации';
    if (!room?.settings.allowSpyGuess) throw new Error(`Угадывание ${subjectName} выключено в настройках комнаты`);
    if (!room?.round || room.round.phase !== 'discussion' || !(room.round.spyIds || [room.round.spyId]).includes(socket.data.playerId)) throw new Error('Действие недоступно');
    room.round.phase = 'guess_review';
    room.round.spyGuess = { spyId: socket.data.playerId, at: Date.now() };
    room.round.spyGuessVotes = {};
    room.round.votingEndsAt = Date.now() + room.settings.votingSeconds * 1000;
    emitRoom(room);
    return {};
  }));

  socket.on('spy_guess_vote', ({ roomId, accepted }, callback) => replyWith(callback, () => {
    checkRate(socket, 'spy_guess_vote', 10, 10000);
    const room = getRoom(roomId);
    requireRoomPlayer(room, socket.data.playerId);
    if (!room?.round || room.round.phase !== 'guess_review') throw new Error('Проверка ответа не идёт');
    if ((room.round.spyIds || [room.round.spyId]).includes(socket.data.playerId)) throw new Error('Шпион не голосует за свой ответ');
    room.round.spyGuessVotes ??= {};
    room.round.spyGuessVotes[socket.data.playerId] = Boolean(accepted);
    if (civilianPlayers(room).every((player) => room.round.spyGuessVotes[player.id] !== undefined)) finishSpyGuessReview(room);
    else emitRoom(room);
    return {};
  }));

  socket.on('get_guess_locations', ({ roomId }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    requireRoomPlayer(room, socket.data.playerId);
    return { locations: getSpyLocations(room.settings.dictionaryIds, room.customLocations, room.settings.subjectType || 'location').map(({ id, name }) => ({ id, name })) };
  }));

  socket.on('alias_mark_word', ({ roomId, result }, callback) => replyWith(callback, () => {
    checkRate(socket, 'alias_mark_word', 80, 10000);
    const room = getRoom(roomId);
    requireRoomPlayer(room, socket.data.playerId);
    if (room?.gameId !== 'alias' || room.round?.phase !== 'alias_turn') throw new Error('Ход Alias не идёт');
    if (result === 'correct') room.round.correct += 1;
    else if (result === 'skip') room.round.skipped += 1;
    else throw new Error('Непонятный результат слова');
    nextAliasWord(room);
    emitRoom(room);
    return {};
  }));

  socket.on('alias_finish_turn', ({ roomId }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    if (!room || room.gameId !== 'alias' || room.hostId !== socket.data.playerId) throw new Error('Только хост может завершить ход');
    finishAliasTurn(room);
    return {};
  }));

  socket.on('next_round', ({ roomId }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    if (!room || room.hostId !== socket.data.playerId || room.state !== 'round_result') throw new Error('Действие недоступно');
    room.players.forEach((player) => { player.ready = player.id === room.hostId; });
    if (room.gameId === 'alias') room.round = createAliasRound(room);
    else if (room.gameId === 'bunker') continueBunkerRound(room);
    else room.round = null;
    room.state = 'lobby';
    if (room.gameId === 'alias' || room.gameId === 'bunker') room.state = 'playing';
    emitRoom(room);
    return {};
  }));

  socket.on('cancel_round', ({ roomId }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    if (!room || room.hostId !== socket.data.playerId || room.state !== 'playing') throw new Error('Только хост может завершить раунд');
    cancelRound(room);
    return {};
  }));

  socket.on('new_match', ({ roomId }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    if (!room || room.hostId !== socket.data.playerId || room.state !== 'match_result') throw new Error('Действие недоступно');
    room.scores = room.gameId === 'alias' ? { team_1: 0, team_2: 0 } : room.gameId === 'bunker' ? { saved: 0, eliminated: 0 } : { civilians: 0, spies: 0 };
    if (room.gameId === 'alias') {
      room.aliasTeams = createAliasTeams(room.players.filter((player) => player.online));
      room.usedAliasWords = [];
      room.aliasTurnIndex = -1;
    }
    room.players.forEach((player) => { player.ready = player.id === room.hostId; });
    room.round = null;
    room.state = 'lobby';
    emitRoom(room);
    return {};
  }));

  socket.on('leave_room', ({ roomId }, callback) => replyWith(callback, () => {
    const room = getRoom(roomId);
    if (room) {
      const leavingWasSpy = (room.round?.spyIds || [room.round?.spyId]).includes(socket.data.playerId);
      removePlayer(room, socket.data.playerId);
      if (room.players.length && room.state === 'playing') {
        if (room.gameId === 'alias') {
          if (room.players.length < aliasDefinition.minPlayers) cancelRound(room);
          else emitRoom(room);
        } else if (room.gameId === 'bunker') {
          if (bunkerActiveContestants(room).length <= room.round.shelterCapacity) finishBunkerByCapacity(room);
          else if (bunkerActiveContestants(room).length < bunkerDefinition.minPlayers - 1) cancelRound(room);
          else maybeAdvanceRound(room);
        } else if (leavingWasSpy) setRoundResult(room, 'civilians', 'spy_left');
        else if (room.players.length < spyDefinition.minPlayers) cancelRound(room);
        else maybeAdvanceRound(room);
      } else if (room.players.length) emitRoom(room);
      else persistRooms();
    }
    socket.data.roomId = null;
    return {};
  }));

  socket.on('disconnect', () => {
    const room = getRoom(socket.data.roomId);
    const player = room?.players.find((item) => item.id === socket.data.playerId);
    if (player) {
      player.online = false;
      maybeAdvanceRound(room);
      emitRoom(room);
    }
  });
});

setInterval(() => {
  const now = Date.now();
  for (const room of allRooms()) {
    if (room.gameId === 'alias' && room.round?.phase === 'alias_turn' && room.round.endsAt <= now) finishAliasTurn(room);
    if (room.round?.phase === 'discussion' && room.round.endsAt <= now) startVoting(room);
    if (room.round?.phase === 'voting' && room.round.votingEndsAt <= now) {
      if (room.gameId === 'bunker') finishBunkerVote(room);
      else finishVote(room);
    }
  }
}, 500);

setInterval(() => {
  if (cleanupInactiveRooms(inactiveRoomTtlMs).length) persistRooms();
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [key, bucket] of rateLimits) if (bucket.startedAt < cutoff) rateLimits.delete(key);
}, 60000);

await connectRoomPersistence();
restoreRooms(await loadRoomSnapshot());
await connectProfilePersistence();
restoreProfiles(await loadProfileSnapshot());
await connectAnalyticsPersistence();
await restoreAnalyticsSnapshot();
server.listen(port, '0.0.0.0', () => console.log(`GameHubParty server: http://localhost:${port}`));

