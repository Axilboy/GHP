const profiles = new Map();

const productPrices = {
  dictionary: { city: 99, travel: 149, secret: 149, pop: 129, fantasy: 149, after_dark: 179, couples: 149, drinks: 149, office_party: 129, memes: 129, items_gadgets: 129, items_couples: 149, items_after_dark: 179, items_weird: 129, items_alcohol: 179, items_computer_games: 149 },
  bundle: { starter: 199, adventure: 249, party_pack: 349, items_pack: 499, all_spy: 1099 },
  subscription: { pro: 299 },
  game_pass: { spy_pass: 99, alias_pass: 99, bunker_pass: 99 },
  custom_dictionary: { custom_dictionary: 199 },
  party_pass: { party_pass_24h: 149 },
  theme: { partyhub: 149 },
};

const productTitles = {
  city: 'Городская жизнь',
  travel: 'Путешествия',
  secret: 'Совершенно секретно',
  pop: 'Кино и поп-культура',
  fantasy: 'Магия и легенды',
  after_dark: '18+ После полуночи',
  couples: 'Для влюбленных',
  drinks: 'Пьянка и бар',
  office_party: 'Корпоратив',
  memes: 'Мемы и интернет',
  items_gadgets: 'Гаджеты',
  items_couples: 'Предметы для влюбленных',
  items_after_dark: '18+ намёки',
  items_weird: 'Странные вещи',
  items_alcohol: 'Виды алкоголя',
  items_computer_games: 'Компьютерные игры',
  starter: 'Стартовый пак',
  adventure: 'Пак приключений',
  party_pack: 'Пак для вечеринки',
  items_pack: 'Предметы Шпиона',
  all_spy: 'Архив Шпиона 2026',
  pro: 'PRO на месяц',
  pro_plus: 'PRO+ на месяц (архив)',
  spy_pass: 'Spy Pass на месяц',
  alias_pass: 'Alias Pass на месяц',
  bunker_pass: 'Bunker Pass на месяц',
  custom_dictionary: 'Конструктор словарей',
  party_pass_24h: 'WeekendPass на 24 часа',
  partyhub: 'Тема PartyHub',
};

const gamePassGameIds = {
  spy_pass: 'spy',
  alias_pass: 'alias',
  bunker_pass: 'bunker',
};

const bundleDictionaryIds = {
  starter: ['city', 'travel'],
  adventure: ['secret', 'fantasy'],
  party_pack: ['after_dark', 'couples', 'drinks'],
  items_pack: ['items_gadgets', 'items_couples', 'items_after_dark', 'items_weird', 'items_alcohol', 'items_computer_games'],
  all_spy: ['city', 'travel', 'secret', 'pop', 'fantasy', 'after_dark', 'couples', 'drinks', 'office_party', 'memes', 'items_gadgets', 'items_couples', 'items_after_dark', 'items_weird', 'items_alcohol', 'items_computer_games'],
};

function newTasks() {
  return [
    { id: 'play', title: 'Сыграть один матч', target: 1, progress: 0, completed: false },
    { id: 'win', title: 'Победить один раз', target: 1, progress: 0, completed: false },
  ];
}

function cleanProductType(type) {
  if (['dictionary', 'bundle', 'subscription', 'game_pass', 'custom_dictionary', 'party_pass', 'theme'].includes(type)) return type;
  throw new Error('Неизвестный тип товара');
}

function cleanProductId(type, id) {
  const value = String(id || '').trim();
  if (!value || !productPrices[type]?.[value]) throw new Error('Товар не найден');
  return value;
}

function orderTitle(order) {
  if (order.productId === 'pro' && Number(order.months) >= 12) return 'PRO на год';
  if (order.productId === 'pro' && Number(order.months) > 1) return `PRO на ${order.months} месяца`;
  return productTitles[order.productId] || order.productId;
}

function orderAmountRub(type, productId, months, basePrice) {
  if (type === 'subscription' && productId === 'pro' && Number(months) >= 12) return 2990;
  return months ? basePrice * months : basePrice;
}

function migrate(profile) {
  profile.email ??= '';
  profile.avatarDataUrl ??= '';
  profile.accountType ??= profile.email ? 'email' : 'guest';
  profile.proPlus ??= false;
  profile.subscription ??= null;
  profile.gamePasses ??= [];
  profile.partyPasses ??= [];
  profile.customLocations ??= [];
  profile.customDictionaryOwned ??= false;
  profile.ownedThemeIds ??= ['ghp'];
  if (!profile.ownedThemeIds.includes('ghp')) profile.ownedThemeIds.unshift('ghp');
  profile.achievements ??= [];
  profile.dailyTasks ??= newTasks();
  profile.level ??= Math.floor((profile.xp || 0) / 500) + 1;
  profile.orders ??= [];
  profile.purchases ??= [];
  return profile;
}

export function getOrCreateProfile(playerId, name = 'Гость') {
  const id = String(playerId);
  if (!profiles.has(id)) {
    profiles.set(id, {
      id,
      name: String(name || 'Гость').trim().slice(0, 24) || 'Гость',
      accountType: 'guest',
      email: '',
      avatarDataUrl: '',
      xp: 0,
      level: 1,
      pro: false,
      proPlus: false,
      subscription: null,
      gamePasses: [],
      partyPasses: [],
      ownedDictionaryIds: ['base'],
      customDictionaryOwned: false,
      ownedThemeIds: ['ghp'],
      customLocations: [],
      achievements: [],
      dailyTasks: newTasks(),
      stats: { games: 0, wins: 0, spyGames: 0, spyWins: 0 },
      recentGames: [],
      orders: [],
      purchases: [],
      updatedAt: Date.now(),
    });
  }
  return migrate(profiles.get(id));
}

export function publicProfile(profile) { return structuredClone(migrate(profile)); }

export function hasAdFreeAccess(profile, now = Date.now(), gameId = '') {
  const data = migrate(profile);
  const activeSubscription = data.subscription?.activeUntil > now;
  const activePartyPass = data.partyPasses?.some((pass) => pass.activeUntil > now);
  const safeGameId = String(gameId || '').trim();
  const activeGamePass = safeGameId ? hasActiveGamePass(data, safeGameId, now) : false;
  return Boolean(data.pro || data.proPlus || activeSubscription || activePartyPass || activeGamePass);
}

export function hasActiveGamePass(profile, gameId, now = Date.now()) {
  const data = migrate(profile);
  const safeGameId = String(gameId || '').trim();
  return data.gamePasses?.some((pass) => pass.gameId === safeGameId && pass.activeUntil > now) || false;
}

export function hasTimedGameAccess(profile, gameId, now = Date.now()) {
  const data = migrate(profile);
  const activeSubscription = data.subscription?.activeUntil > now;
  const activePartyPass = data.partyPasses?.some((pass) => pass.activeUntil > now);
  return Boolean(data.pro || data.proPlus || activeSubscription || activePartyPass || hasActiveGamePass(data, gameId, now));
}

export function updateProfileName(playerId, name) {
  const profile = getOrCreateProfile(playerId, name);
  profile.name = String(name).trim().slice(0, 24);
  profile.updatedAt = Date.now();
  return profile;
}

export function updateProfileAvatar(playerId, avatarDataUrl) {
  const profile = getOrCreateProfile(playerId);
  profile.avatarDataUrl = String(avatarDataUrl || '').trim();
  profile.updatedAt = Date.now();
  return profile;
}

export function createOrder(playerId, input = {}) {
  const profile = getOrCreateProfile(playerId);
  const type = cleanProductType(input.type);
  const productId = cleanProductId(type, input.productId);
  const months = ['subscription', 'game_pass'].includes(type) ? Math.min(12, Math.max(1, Number(input.months) || 1)) : null;
  const basePrice = productPrices[type][productId];
  const amountRub = orderAmountRub(type, productId, months, basePrice);
  const order = {
    id: `order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    productId,
    title: orderTitle({ productId, months }),
    amountRub,
    months,
    status: 'pending',
    provider: 'demo',
    createdAt: Date.now(),
  };
  profile.orders.unshift(order);
  profile.orders = profile.orders.slice(0, 30);
  profile.updatedAt = Date.now();
  return { profile, order };
}

export function attachOrderPayment(playerId, orderId, payment = {}) {
  const profile = getOrCreateProfile(playerId);
  const order = profile.orders.find((item) => item.id === orderId);
  if (!order) throw new Error('Order not found');
  order.provider = payment.provider || order.provider || 'demo';
  order.paymentId = payment.paymentId || order.paymentId || null;
  order.paymentUrl = payment.paymentUrl || order.paymentUrl || null;
  order.paymentStatus = payment.paymentStatus || order.paymentStatus || null;
  order.paymentAttachedAt = Date.now();
  profile.updatedAt = Date.now();
  return { profile, order };
}

export function cancelOrder(playerId, orderId, reason = '') {
  const profile = getOrCreateProfile(playerId);
  const order = profile.orders.find((item) => item.id === orderId);
  if (!order) throw new Error('Order not found');
  if (order.status !== 'paid') {
    order.status = 'canceled';
    order.canceledAt = Date.now();
    order.cancelReason = String(reason || '').slice(0, 200);
    profile.updatedAt = Date.now();
  }
  return { profile, order };
}

export function findOrderByPaymentId(paymentId) {
  const id = String(paymentId || '').trim();
  if (!id) return null;
  for (const profile of profiles.values()) {
    const order = migrate(profile).orders.find((item) => item.paymentId === id);
    if (order) return { profile, order };
  }
  return null;
}

export function confirmPaidOrder(playerId, orderId, provider = 'demo', paymentId = null) {
  const profile = getOrCreateProfile(playerId);
  const order = profile.orders.find((item) => item.id === orderId);
  if (!order) throw new Error('Заказ не найден');
  if (order.status === 'paid') return { profile, order };
  order.status = 'paid';
  order.provider = provider || order.provider || 'demo';
  if (paymentId) order.paymentId = paymentId;
  order.paidAt = Date.now();

  if (order.type === 'dictionary') unlockDictionary(profile, order.productId);
  if (order.type === 'bundle') applyBundle(profile, order.productId);
  if (order.type === 'subscription') applyPlan(profile, order.productId, order.months || 1);
  if (order.type === 'game_pass') applyGamePass(profile, order.productId, order.months || 1);
  if (order.type === 'custom_dictionary') profile.customDictionaryOwned = true;
  if (order.type === 'party_pass') applyPartyPass(profile, 24);
  if (order.type === 'theme') unlockTheme(profile, order.productId);

  profile.purchases.unshift({
    id: `purchase-${Date.now()}-${order.productId}`,
    orderId: order.id,
    type: order.type,
    productId: order.productId,
    title: order.title,
    amountRub: order.amountRub,
    provider: order.provider || 'demo',
    paymentId: order.paymentId || null,
    createdAt: Date.now(),
    activeUntil: order.type === 'subscription' ? profile.subscription?.activeUntil : order.type === 'game_pass' ? profile.gamePasses?.find((pass) => pass.productId === order.productId)?.activeUntil : order.type === 'party_pass' ? profile.partyPasses[0]?.activeUntil : null,
  });
  profile.purchases = profile.purchases.slice(0, 30);
  profile.updatedAt = Date.now();
  return { profile, order };
}

export function confirmDemoOrder(playerId, orderId) {
  return confirmPaidOrder(playerId, orderId, 'demo');
}

function unlockDictionary(profile, dictionaryId) {
  if (dictionaryId !== 'base' && !profile.ownedDictionaryIds.includes(dictionaryId)) profile.ownedDictionaryIds.push(dictionaryId);
}

function applyBundle(profile, bundleId) {
  profile.ownedDictionaryIds = [...new Set([...profile.ownedDictionaryIds, ...(bundleDictionaryIds[bundleId] || [])])];
}

function applyPlan(profile, plan = 'pro', months = 1) {
  const safeMonths = Math.min(12, Math.max(1, Number(months) || 1));
  profile.pro = true;
  profile.proPlus = plan === 'pro_plus';
  profile.subscription = {
    plan: profile.proPlus ? 'pro_plus' : 'pro',
    months: safeMonths,
    activeUntil: Date.now() + safeMonths * 30 * 24 * 60 * 60 * 1000,
  };
}

function applyGamePass(profile, productId, months = 1) {
  const safeMonths = Math.min(12, Math.max(1, Number(months) || 1));
  const gameId = gamePassGameIds[productId];
  if (!gameId) throw new Error('Игра для Game Pass не найдена');
  const activeUntil = Date.now() + safeMonths * 30 * 24 * 60 * 60 * 1000;
  profile.gamePasses = [
    { id: `game-pass-${Date.now()}`, productId, gameId, months: safeMonths, activeUntil },
    ...(profile.gamePasses || []).filter((pass) => pass.gameId !== gameId),
  ].slice(0, 10);
}

function applyPartyPass(profile, hours = 24) {
  const safeHours = Math.min(72, Math.max(3, Number(hours) || 24));
  profile.partyPasses.unshift({ id: `party-${Date.now()}`, activeUntil: Date.now() + safeHours * 60 * 60 * 1000 });
  profile.partyPasses = profile.partyPasses.slice(0, 5);
}

function unlockTheme(profile, themeId) {
  profile.ownedThemeIds = [...new Set([...(profile.ownedThemeIds || ['ghp']), 'ghp', themeId])];
}

export function unlockDemoDictionary(playerId, dictionary) {
  const profile = getOrCreateProfile(playerId);
  if (!dictionary.free) unlockDictionary(profile, dictionary.id);
  profile.updatedAt = Date.now();
  return profile;
}

export function unlockBundle(playerId, bundle) {
  const profile = getOrCreateProfile(playerId);
  profile.ownedDictionaryIds = [...new Set([...profile.ownedDictionaryIds, ...bundle.dictionaryIds])];
  profile.updatedAt = Date.now();
  return profile;
}

export function activateDemoPro(playerId) { return activateDemoPlan(playerId, 'pro', 1); }

export function activateDemoPlan(playerId, plan = 'pro', months = 1) {
  const profile = getOrCreateProfile(playerId);
  applyPlan(profile, plan, months);
  profile.updatedAt = Date.now();
  return profile;
}

export function addCustomLocation(playerId, input = {}) {
  const profile = getOrCreateProfile(playerId);
  if (!hasTimedGameAccess(profile, 'spy') && !profile.customDictionaryOwned) throw new Error('Сначала откройте Spy Pass, WeekendPass, PRO или конструктор собственных словарей');
  const name = String(input.name || '').trim().slice(0, 40);
  const roles = [...new Set((input.roles || []).map((role) => String(role).trim().slice(0, 30)).filter(Boolean))].slice(0, 12);
  if (!name || roles.length < 3) throw new Error('Укажите название и минимум 3 роли');
  profile.customLocations.push({ id: `custom-${Date.now()}`, name, roles });
  profile.customLocations = profile.customLocations.slice(-30);
  profile.updatedAt = Date.now();
  return profile;
}

export function unlockCustomDictionary(playerId) {
  const profile = getOrCreateProfile(playerId);
  profile.customDictionaryOwned = true;
  profile.updatedAt = Date.now();
  return profile;
}

export function activatePartyPass(playerId, hours = 24) {
  const profile = getOrCreateProfile(playerId);
  applyPartyPass(profile, hours);
  profile.updatedAt = Date.now();
  return profile;
}

function addAdminPurchase(profile, type, productId, amountRub = 0, activeUntil = null) {
  const purchase = {
    id: `admin-purchase-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    orderId: null,
    type,
    productId,
    title: productTitles[productId] || productId,
    amountRub,
    provider: 'admin',
    createdAt: Date.now(),
    activeUntil,
  };
  profile.purchases.unshift(purchase);
  profile.purchases = profile.purchases.slice(0, 30);
  return purchase;
}

export function adminGrantAccess(playerId, input = {}) {
  const profile = getOrCreateProfile(playerId);
  const type = cleanProductType(input.type);
  const productId = cleanProductId(type, input.productId);
  let activeUntil = null;

  if (type === 'dictionary') unlockDictionary(profile, productId);
  if (type === 'bundle') applyBundle(profile, productId);
  if (type === 'subscription') {
    const months = Math.min(12, Math.max(1, Number(input.months) || 1));
    applyPlan(profile, productId, months);
    activeUntil = profile.subscription?.activeUntil || null;
  }
  if (type === 'game_pass') {
    const months = Math.min(12, Math.max(1, Number(input.months) || 1));
    applyGamePass(profile, productId, months);
    activeUntil = profile.gamePasses?.find((pass) => pass.productId === productId)?.activeUntil || null;
  }
  if (type === 'custom_dictionary') profile.customDictionaryOwned = true;
  if (type === 'party_pass') {
    const hours = Math.min(72, Math.max(3, Number(input.hours) || 24));
    applyPartyPass(profile, hours);
    activeUntil = profile.partyPasses[0]?.activeUntil || null;
  }
  if (type === 'theme') unlockTheme(profile, productId);

  const purchase = addAdminPurchase(profile, type, productId, 0, activeUntil);
  profile.updatedAt = Date.now();
  return { profile, purchase };
}

export function adminRevokeAccess(playerId, input = {}) {
  const profile = getOrCreateProfile(playerId);
  const type = cleanProductType(input.type);
  const productId = cleanProductId(type, input.productId);

  if (type === 'dictionary' && productId !== 'base') {
    profile.ownedDictionaryIds = (profile.ownedDictionaryIds || ['base']).filter((id) => id === 'base' || id !== productId);
  }
  if (type === 'bundle') {
    const toRemove = new Set(bundleDictionaryIds[productId] || []);
    profile.ownedDictionaryIds = (profile.ownedDictionaryIds || ['base']).filter((id) => id === 'base' || !toRemove.has(id));
  }
  if (type === 'subscription') {
    profile.pro = false;
    profile.proPlus = false;
    profile.subscription = null;
  }
  if (type === 'game_pass') {
    const gameId = gamePassGameIds[productId];
    profile.gamePasses = (profile.gamePasses || []).filter((pass) => pass.gameId !== gameId);
  }
  if (type === 'custom_dictionary') profile.customDictionaryOwned = false;
  if (type === 'party_pass') profile.partyPasses = [];
  if (type === 'theme' && productId !== 'ghp') profile.ownedThemeIds = (profile.ownedThemeIds || ['ghp']).filter((id) => id === 'ghp' || id !== productId);

  profile.purchases = (profile.purchases || []).filter((purchase) => !(purchase.type === type && purchase.productId === productId));
  profile.updatedAt = Date.now();
  return profile;
}

export function adminRemovePurchase(playerId, purchaseId) {
  const profile = getOrCreateProfile(playerId);
  const id = String(purchaseId || '').trim();
  profile.purchases = (profile.purchases || []).filter((purchase) => purchase.id !== id);
  profile.updatedAt = Date.now();
  return profile;
}

function refreshProgress(profile) {
  profile.level = Math.floor(profile.xp / 500) + 1;
  const unlocked = [profile.stats.games >= 1 && 'first_game', profile.stats.wins >= 1 && 'first_win', profile.stats.spyWins >= 1 && 'spy_win', profile.stats.games >= 10 && 'party_regular'].filter(Boolean);
  profile.achievements = [...new Set([...(profile.achievements || []), ...unlocked])];
  for (const task of profile.dailyTasks) {
    task.progress = task.id === 'play' ? Math.min(task.target, profile.stats.games) : Math.min(task.target, profile.stats.wins);
    task.completed = task.progress >= task.target;
  }
}

export function recordGame(room) {
  if (!room.round?.result || room.round.profileRewarded) return;
  const winner = room.round.result.winner;
  for (const player of room.players) {
    const profile = getOrCreateProfile(player.id, player.name);
    const isSpy = (room.round.spyIds || [room.round.spyId]).includes(player.id);
    const won = (isSpy && winner === 'spies') || (!isSpy && winner === 'civilians');
    profile.stats.games += 1;
    profile.stats.wins += won ? 1 : 0;
    profile.stats.spyGames += isSpy ? 1 : 0;
    profile.stats.spyWins += isSpy && won ? 1 : 0;
    profile.xp += won ? 120 : 40;
    profile.recentGames.unshift({ gameId: 'spy', won, role: isSpy ? 'spy' : 'civilian', mode: room.settings.mode, at: Date.now() });
    profile.recentGames = profile.recentGames.slice(0, 10);
    profile.updatedAt = Date.now();
    refreshProgress(profile);
  }
  room.round.profileRewarded = true;
}

export function allProfiles() { return [...profiles.values()]; }
export function restoreProfiles(snapshot = []) { for (const profile of snapshot) if (profile?.id) profiles.set(profile.id, migrate(profile)); }
