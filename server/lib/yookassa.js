import {
  cancelOrder,
  confirmPaidOrder,
  findOrderByPaymentId,
  getOrCreateProfile,
  publicProfile,
} from '../profileStore.js';
import { track } from '../analyticsStore.js';
import { sendSystemEmail } from './mailer.js';
import { persistProfiles } from './persist.js';

const port = Number(process.env.PORT || 3100);

export function yooKassaConfig() {
  const shopId = String(process.env.YOOKASSA_SHOP_ID || process.env.YOOKASSA_SHOPID || '').trim();
  const secretKey = String(process.env.YOOKASSA_SECRET_KEY || '').trim();
  return {
    shopId,
    secretKey,
    enabled: Boolean(shopId && secretKey),
    apiUrl: String(process.env.YOOKASSA_API_URL || 'https://api.yookassa.ru/v3').replace(/\/+$/, ''),
  };
}

export function demoCheckoutEnabled() {
  return process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEMO_CHECKOUT === '1';
}

export function publicBaseUrl() {
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

export async function createYooKassaPayment(profile, order) {
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

export async function handleYooKassaWebhook(notification) {
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

export async function syncYooKassaOrder(playerId, orderId) {
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
