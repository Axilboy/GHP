import crypto from 'node:crypto';
import path from 'node:path';
import { appendFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import { checkHttpRate } from '../lib/rateLimit.js';
import { cleanFeedbackText } from '../lib/validators.js';
import { sendSystemEmail } from '../lib/mailer.js';
import { track } from '../analyticsStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const feedbackDir = process.env.FEEDBACK_DIR || path.join(__dirname, '..', '..', 'artifacts', 'feedback');

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
  const allowed = new Set(['page_view', 'open_store', 'start_checkout', 'payment_success', 'payment_failed', 'feedback_opened', 'game_started', 'registration', 'return_visit', 'pro_purchase']);
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
      content: cleanFeedbackText(details.content || details.utmContent, 120),
      term: cleanFeedbackText(details.term || details.utmTerm, 120),
      productId: cleanFeedbackText(details.productId, 80),
      type: cleanFeedbackText(details.type, 80),
      game_type: cleanFeedbackText(details.game_type, 40),
      players_count: Math.max(0, Math.min(100, Number(details.players_count) || 0)),
      room_id_hash: cleanFeedbackText(details.room_id_hash, 32),
      method: cleanFeedbackText(details.method, 40),
      amount_rub: Math.max(0, Number(details.amount_rub) || 0),
      months: Math.max(0, Math.min(120, Number(details.months) || 0)),
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

export const feedbackRouter = Router();

feedbackRouter.post('/analytics/track', (request, response) => {
  try {
    checkHttpRate(request, 'analytics', 80, 60 * 1000);
    const event = normalizeAnalyticsEvent(request);
    track(event.name, event.details);
    response.json({ ok: true });
  } catch (error) {
    response.status(error.status || 400).json({ ok: false, error: error.message || 'Analytics failed' });
  }
});

feedbackRouter.post('/feedback', async (request, response) => {
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
