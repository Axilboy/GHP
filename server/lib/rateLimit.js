const rateLimits = new Map();

export function checkRate(socket, key, limit, windowMs) {
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

export function checkHttpRate(request, key, limit, windowMs) {
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

export function cleanupExpiredRateLimits(maxAgeMs) {
  const cutoff = Date.now() - maxAgeMs;
  for (const [key, bucket] of rateLimits) if (bucket.startedAt < cutoff) rateLimits.delete(key);
}
