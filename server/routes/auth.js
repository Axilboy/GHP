import crypto from 'node:crypto';
import { Router } from 'express';
import { checkHttpRate } from '../lib/rateLimit.js';
import { cleanEmail, cleanFeedbackText } from '../lib/validators.js';
import { sendSystemEmail } from '../lib/mailer.js';
import { persistProfiles } from '../lib/persist.js';
import { allProfiles, getOrCreateProfile, publicProfile } from '../profileStore.js';

const authCodes = new Map();

function attachEmailAccount(playerId, email, name) {
  const existing = allProfiles().find((profile) => profile.email === email);
  const profile = existing || getOrCreateProfile(playerId || `email-${crypto.randomUUID()}`, name || email.split('@')[0]);
  profile.email = email;
  profile.accountType = 'email';
  if (name) profile.name = cleanFeedbackText(name, 24) || profile.name;
  profile.updatedAt = Date.now();
  return profile;
}

export const authRouter = Router();

authRouter.post('/request-code', async (request, response) => {
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

authRouter.post('/verify-code', (request, response) => {
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
