export function formatEntitlementUntil(activeUntil) {
  if (!activeUntil) return 'активно';
  return new Date(activeUntil).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getSubscriptionStatus(profile, now = Date.now()) {
  const subscriptionUntil = Number(profile?.subscription?.activeUntil || 0);
  const subscriptionActive = subscriptionUntil > now;
  const plan = profile?.proPlus || profile?.subscription?.plan === 'pro_plus'
    ? 'PRO+'
    : profile?.pro || profile?.subscription?.plan === 'pro'
      ? 'PRO'
      : '';
  const active = Boolean(plan && (subscriptionActive || profile?.pro || profile?.proPlus));
  return {
    active,
    plan: active ? plan : 'FREE',
    activeUntil: subscriptionActive ? subscriptionUntil : null,
    untilText: active ? formatEntitlementUntil(subscriptionActive ? subscriptionUntil : null) : 'подписка не активна',
  };
}

export function hasPremiumAccess(profile) {
  return getSubscriptionStatus(profile).active;
}
