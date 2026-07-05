import { Router } from 'express';
import { allRooms } from '../roomStore.js';
import {
  adminGrantAccess,
  adminRemovePurchase,
  adminRevokeAccess,
  allProfiles,
  confirmDemoOrder,
  publicProfile,
} from '../profileStore.js';
import { analyticsSnapshot, track } from '../analyticsStore.js';
import { listSpyBundles, listSpyDictionaries } from '../games/spy/index.js';
import { persistProfiles } from '../lib/persist.js';
import { roomThemes } from '../lib/roomThemes.js';

export function requireAdmin(request, response, next) {
  const expectedPin = String(process.env.ADMIN_PIN || '1973');
  const providedPin = String(request.get('x-admin-pin') || request.query.pin || request.body?.pin || '');
  if (providedPin !== expectedPin) {
    response.status(403).json({ ok: false, error: 'Admin access denied' });
    return;
  }
  next();
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

export const adminRouter = Router();

adminRouter.get('/overview', requireAdmin, (_request, response) => {
  response.json({ ok: true, overview: adminOverview() });
});

adminRouter.post('/orders/:playerId/:orderId/confirm', requireAdmin, (request, response) => {
  try {
    const { profile, order } = confirmDemoOrder(request.params.playerId, request.params.orderId);
    track('admin_order_paid', { type: order.type, productId: order.productId, playerId: profile.id });
    persistProfiles();
    response.json({ ok: true, order: adminOrderSummary(profile, order), overview: adminOverview() });
  } catch (error) {
    response.status(404).json({ ok: false, error: error.message || 'Order not found' });
  }
});

adminRouter.post('/profiles/:playerId/grants', requireAdmin, (request, response) => {
  try {
    const { profile, purchase } = adminGrantAccess(request.params.playerId, request.body || {});
    track('admin_grant', { type: purchase.type, productId: purchase.productId, playerId: profile.id });
    persistProfiles();
    response.json({ ok: true, profile: adminProfileSummary(profile), purchase, overview: adminOverview() });
  } catch (error) {
    response.status(400).json({ ok: false, error: error.message || 'Grant failed' });
  }
});

adminRouter.post('/profiles/:playerId/revoke', requireAdmin, (request, response) => {
  try {
    const profile = adminRevokeAccess(request.params.playerId, request.body || {});
    track('admin_revoke', { type: request.body?.type, productId: request.body?.productId, playerId: profile.id });
    persistProfiles();
    response.json({ ok: true, profile: adminProfileSummary(profile), overview: adminOverview() });
  } catch (error) {
    response.status(400).json({ ok: false, error: error.message || 'Revoke failed' });
  }
});

adminRouter.delete('/profiles/:playerId/purchases/:purchaseId', requireAdmin, (request, response) => {
  try {
    const profile = adminRemovePurchase(request.params.playerId, request.params.purchaseId);
    track('admin_purchase_removed', { playerId: profile.id });
    persistProfiles();
    response.json({ ok: true, profile: adminProfileSummary(profile), overview: adminOverview() });
  } catch (error) {
    response.status(400).json({ ok: false, error: error.message || 'Remove purchase failed' });
  }
});
