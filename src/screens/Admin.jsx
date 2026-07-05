import { useEffect, useState } from 'react';
import { sessionStore } from '../browserStorage';
import { Header } from '../shared/Header';
import { ErrorText } from '../shared/ui';
import { APP_VERSION } from '../version';
import { screenshotFolders } from './releaseNotes';

export function AdminPage({ navigate }) {
  const [pin, setPin] = useState(() => {
    try {
      return sessionStore.getItem('gamehub_admin_pin_value') || '';
    } catch (_) {
      return '';
    }
  });
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return sessionStore.getItem('gamehub_admin_pin_ok') === '1';
    } catch (_) {
      return false;
    }
  });
  const [error, setError] = useState('');
  const [adminData, setAdminData] = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const readAdminPin = () => {
    try {
      return pin || sessionStore.getItem('gamehub_admin_pin_value') || '1973';
    } catch (_) {
      return pin || '1973';
    }
  };
  const loadAdminData = async () => {
    setAdminLoading(true);
    setAdminError('');
    try {
      const response = await fetch('/api/admin/overview', { headers: { 'x-admin-pin': readAdminPin() } });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Админ-данные недоступны');
      setAdminData(data.overview);
    } catch (loadError) {
      setAdminError(loadError.message || 'Не удалось загрузить админку');
    } finally {
      setAdminLoading(false);
    }
  };
  const confirmAdminOrder = async (order) => {
    setAdminMessage('');
    setAdminError('');
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(order.playerId)}/${encodeURIComponent(order.id)}/confirm`, {
        method: 'POST',
        headers: { 'x-admin-pin': readAdminPin() },
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Заказ не подтвержден');
      setAdminData(data.overview);
      setAdminMessage(`Заказ ${order.title} подтвержден`);
    } catch (confirmError) {
      setAdminError(confirmError.message || 'Не удалось подтвердить заказ');
    }
  };
  const manageAdminAccess = async (profile, mode, payload) => {
    setAdminMessage('');
    setAdminError('');
    try {
      const response = await fetch(`/api/admin/profiles/${encodeURIComponent(profile.id)}/${mode === 'grant' ? 'grants' : 'revoke'}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-pin': readAdminPin() },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Доступ не изменён');
      setAdminData(data.overview);
      setAdminMessage(`${mode === 'grant' ? 'Выдано' : 'Забрано'}: ${profile.name}`);
    } catch (accessError) {
      setAdminError(accessError.message || 'Не удалось изменить доступ');
    }
  };
  const removeAdminPurchase = async (profile, purchase) => {
    setAdminMessage('');
    setAdminError('');
    try {
      const response = await fetch(`/api/admin/profiles/${encodeURIComponent(profile.id)}/purchases/${encodeURIComponent(purchase.id)}`, {
        method: 'DELETE',
        headers: { 'x-admin-pin': readAdminPin() },
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Покупка не удалена');
      setAdminData(data.overview);
      setAdminMessage(`Покупка удалена: ${purchase.title}`);
    } catch (removeError) {
      setAdminError(removeError.message || 'Не удалось удалить покупку');
    }
  };
  useEffect(() => {
    if (unlocked) loadAdminData();
  }, [unlocked]);
  const submit = (event) => {
    event.preventDefault();
    if (pin.trim() !== '1973') {
      setError('Неверный PIN');
      return;
    }
    try {
      sessionStore.setItem('gamehub_admin_pin_ok', '1');
      sessionStore.setItem('gamehub_admin_pin_value', pin.trim());
    } catch (_) {}
    setUnlocked(true);
    setError('');
  };

  if (!unlocked) {
    return <main className="app-screen admin-page">
      <Header navigate={navigate} right={<span className="badge">Админ</span>} />
      <section className="section wrap">
        <span className="eyebrow">Закрытый раздел</span>
        <h1>Админка</h1>
        <p>Введите PIN-код, чтобы открыть админ-раздел.</p>
        <form className="admin-pin-card" onSubmit={submit}>
          <label>PIN</label>
          <input autoFocus inputMode="numeric" type="password" value={pin} onChange={(event) => { setPin(event.target.value.replace(/\D/g, '')); setError(''); }} placeholder="Введите PIN" />
          {error && <ErrorText text={error} />}
          <button className="button primary full" type="submit">Войти</button>
        </form>
      </section>
    </main>;
  }

  return <main className="app-screen admin-page">
    <Header navigate={navigate} right={<span className="badge">Админ</span>} />
    <section className="section wrap">
      <span className="eyebrow">GameHubParty</span>
      <h1>Админка</h1>
      <p>Вход работает. Здесь будем хранить служебные ссылки, папки скриншотов и инструменты проверки.</p>
      <div className="demo-links"><button onClick={() => navigate('demo')}>Статус и обновления</button><button onClick={() => navigate('store')}>Магазин</button><button onClick={() => navigate('profile')}>Профиль</button><button onClick={() => navigate('vk')}>VK</button></div>
    </section>
    <section className="section wrap">
      <div className="section-title"><h2>Статус проекта</h2><span className="badge live">v{APP_VERSION}</span></div>
      <div className="admin-status-grid">
        <article><b>Шпион</b><span>Лобби, роли, таймер, голосование, угадывание, результат и профиль.</span></article>
        <article><b>Платежка</b><span>YooKassa, возврат после оплаты, webhook, выдача доступа и история покупок.</span></article>
        <article><b>Админка</b><span>Закрытый вход по прямому URL, папки скринов, чеклисты проверки.</span></article>
        <article><b>Тесты</b><span>Серверные тесты, автотесты сценариев и production-сборка перед деплоем.</span></article>
      </div>
    </section>
    <section className="section wrap">
      <div className="section-title"><h2>Чеклист проверки</h2><span>до деплоя</span></div>
      <div className="admin-checklist">
        <label><input type="checkbox" checked readOnly /> В магазине создаётся заказ и подтверждается цифровой доступ</label>
        <label><input type="checkbox" checked readOnly /> Покупки отображаются в профиле</label>
        <label><input type="checkbox" checked readOnly /> Раунд Шпиона завершается экраном результата</label>
        <label><input type="checkbox" checked readOnly /> Новая папка скринов добавлена в админку и демо</label>
      </div>
    </section>
    <AdminOpsPanel data={adminData} loading={adminLoading} error={adminError} message={adminMessage} reload={loadAdminData} confirmOrder={confirmAdminOrder} manageAccess={manageAdminAccess} removePurchase={removeAdminPurchase} />
    <section className="section wrap">
      <div className="section-title"><h2>Папки скриншотов</h2><span>{screenshotFolders.length}</span></div>
      <div className="screenshot-folders">{screenshotFolders.map((folder) => <article className="screenshot-folder-card" key={folder.title}>
        <div className="screenshot-folder-head"><div><b>{folder.title}</b><p>{folder.description}</p></div><span>{folder.shots.length} скринов</span></div>
        <div className="screenshot-carousel">{folder.shots.map((shot) => <a key={shot.file} href={shot.file} target="_blank" rel="noreferrer"><img src={shot.file} alt={shot.title} loading="lazy" /><small>{shot.title}</small></a>)}</div>
      </article>)}</div>
    </section>
  </main>;
}

function AdminOpsPanel({ data, loading, error, message, reload, confirmOrder, manageAccess, removePurchase }) {
  const totals = data?.totals || {};
  return <section className="section wrap admin-ops">
    <div className="section-title"><h2>Операционная панель</h2><button className="link" onClick={reload} disabled={loading}>{loading ? 'Обновляем...' : 'Обновить'}</button></div>
    {error && <ErrorText text={error} />}
    {message && <p className="admin-success">{message}</p>}
    <div className="admin-metrics">
      <article><b>{totals.activeRooms ?? 0}</b><span>активных комнат</span></article>
      <article><b>{totals.pendingOrders ?? 0}</b><span>заказов ждут</span></article>
      <article><b>{totals.paidOrders ?? 0}</b><span>оплачено</span></article>
      <article><b>{totals.revenueRub ?? 0} ₽</b><span>выручка</span></article>
    </div>
    <AdminFunnels analytics={data?.analytics} />
    <AdminOrders orders={data?.orders || []} confirmOrder={confirmOrder} />
    <AdminRooms rooms={data?.rooms || []} />
    <AdminPlayers profiles={data?.profiles || []} products={data?.products || {}} manageAccess={manageAccess} removePurchase={removePurchase} />
  </section>;
}

function AdminFunnels({ analytics }) {
  const windows = analytics?.windows || [];
  const byWindow = analytics?.byWindow || {};
  return <div className="admin-subpanel admin-funnels">
    <div className="section-title"><h3>Аналитические воронки</h3><span>{analytics ? 'live' : 'нет данных'}</span></div>
    {windows.length ? <div className="admin-funnel-windows">{windows.map((window) => {
      const data = byWindow[window.id] || {};
      return <article key={window.id} className="admin-funnel-window">
        <div className="admin-funnel-head">
          <b>{window.label}</b>
          <small>{data.uniquePlayers || 0} игроков · {data.totalEvents || 0} событий</small>
        </div>
        <FunnelList title="Игра" steps={data.gameFunnel || []} />
        <FunnelList title="Магазин" steps={data.storeFunnel || []} />
        <TopPages pages={data.pages || {}} />
      </article>;
    })}</div> : <p className="guest-name-note">События появятся после первых просмотров страниц, комнат и покупок.</p>}
  </div>;
}

function FunnelList({ title, steps }) {
  const max = Math.max(1, ...steps.map((step) => step.count || 0));
  return <div className="admin-funnel-list">
    <strong>{title}</strong>
    {steps.map((step) => <div key={step.key} className="admin-funnel-step">
      <span><b>{step.count || 0}</b><small>{step.title}</small></span>
      <i><em style={{ width: `${Math.max(4, Math.round(((step.count || 0) / max) * 100))}%` }} /></i>
      <mark>{step.conversion ?? 0}%</mark>
    </div>)}
  </div>;
}

function TopPages({ pages }) {
  const entries = Object.entries(pages).sort((left, right) => right[1] - left[1]).slice(0, 4);
  if (!entries.length) return null;
  return <div className="admin-top-pages"><strong>Страницы</strong>{entries.map(([page, count]) => <span key={page}>{page}<b>{count}</b></span>)}</div>;
}

function adminProductOptions(products = {}) {
  return [
    ...(products.dictionaries || []).map((item) => ({ value: `dictionary:${item.id}`, label: `Словарь · ${item.name}` })),
    ...(products.bundles || []).map((item) => ({ value: `bundle:${item.id}`, label: `Пак · ${item.name}` })),
    ...(products.themes || []).filter((item) => !item.free).map((item) => ({ value: `theme:${item.id}`, label: `Тема · ${item.name}` })),
    ...(products.subscriptions || []).map((item) => ({ value: `subscription:${item.id}`, label: `Подписка · ${item.name}` })),
    ...(products.gamePasses || []).map((item) => ({ value: `game_pass:${item.id}`, label: `Game Pass · ${item.name}` })),
    ...(products.extras || []).map((item) => ({ value: `${item.type}:${item.id}`, label: `Дополнительно · ${item.name}` })),
  ];
}

function AdminPlayers({ profiles, products, manageAccess, removePurchase }) {
  const options = adminProductOptions(products);
  const defaultValue = options[0]?.value || 'subscription:pro';
  const [selected, setSelected] = useState({});
  const [duration, setDuration] = useState({});
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const filteredProfiles = normalizedQuery
    ? profiles.filter((profile) => `${profile.id} ${profile.name} ${profile.email || ''}`.toLowerCase().includes(normalizedQuery))
    : profiles;
  const visibleProfiles = filteredProfiles.slice(0, 12);
  const buildPayload = (profile) => {
    const value = selected[profile.id] || defaultValue;
    const [type, productId] = value.split(':');
    const payload = { type, productId };
    if (type === 'subscription' || type === 'game_pass') payload.months = Number(duration[profile.id]) || 1;
    if (type === 'party_pass') payload.hours = Number(duration[profile.id]) || 24;
    return payload;
  };
  return <div className="admin-subpanel admin-players">
    <div className="section-title"><h3>Зарегистрированные игроки</h3><span>{filteredProfiles.length}/{profiles.length}</span></div>
    <input className="admin-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по ID, почте или имени" />
    {visibleProfiles.length ? <div className="admin-player-list">{visibleProfiles.map((profile) => {
      const value = selected[profile.id] || defaultValue;
      const [type] = value.split(':');
      const activePass = profile.partyPasses?.find((pass) => pass.activeUntil > Date.now());
      return <article key={profile.id}>
        <div className="admin-player-head">
          <div><b>{profile.name}</b><small>{profile.email || 'email не указан'} · {profile.id}</small></div>
          <span>{profile.pro ? 'PRO' : profile.gamePasses?.some((pass) => pass.activeUntil > Date.now()) ? 'Game Pass' : 'Free'}</span>
        </div>
        <div className="admin-access-tags">
          <span>{profile.ownedDictionaryCount} словарей</span>
          <span>{profile.ownedThemeIds?.length || 1} тем</span>
          {profile.subscription?.activeUntil && <span>до {formatAdminDate(profile.subscription.activeUntil)}</span>}
          {profile.customDictionaryOwned && <span>свой словарь</span>}
          {profile.gamePasses?.filter((pass) => pass.activeUntil > Date.now()).map((pass) => <span key={pass.id}>{pass.gameId} до {formatAdminDate(pass.activeUntil)}</span>)}
          {activePass && <span>WeekendPass до {formatAdminDate(activePass.activeUntil)}</span>}
        </div>
        <div className="admin-access-form">
          <select value={value} onChange={(event) => setSelected((current) => ({ ...current, [profile.id]: event.target.value }))}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          {(type === 'subscription' || type === 'game_pass' || type === 'party_pass') && <input type="number" min="1" max={type === 'party_pass' ? '72' : '12'} value={duration[profile.id] || (type === 'party_pass' ? 24 : 1)} onChange={(event) => setDuration((current) => ({ ...current, [profile.id]: event.target.value }))} aria-label={type === 'party_pass' ? 'Часы' : 'Месяцы'} />}
          <button onClick={() => manageAccess(profile, 'grant', buildPayload(profile))}>Выдать</button>
          <button className="danger" onClick={() => manageAccess(profile, 'revoke', buildPayload(profile))}>Забрать</button>
        </div>
        <div className="admin-bulk-actions">
          <button onClick={() => manageAccess(profile, 'grant', { type: 'game_pass', productId: 'spy_pass', months: 1 })}>Выдать Spy Pass</button>
          <button className="danger" onClick={() => manageAccess(profile, 'revoke', { type: 'game_pass', productId: 'spy_pass' })}>Забрать Spy Pass</button>
        </div>
        {profile.purchases?.length ? <div className="admin-purchase-list">{profile.purchases.slice(0, 4).map((purchase) => <div key={purchase.id}>
          <span><b>{purchase.title}</b><small>{purchase.provider === 'admin' ? 'выдано админом' : `${purchase.amountRub} ₽`} · {formatAdminDate(purchase.createdAt)}</small></span>
          <button onClick={() => removePurchase(profile, purchase)}>Удалить</button>
        </div>)}</div> : <p className="guest-name-note">Покупок пока нет.</p>}
      </article>;
    })}</div> : <p className="guest-name-note">Игроки появятся после входа на сайт или создания комнаты.</p>}
  </div>;
}

function AdminOrders({ orders, confirmOrder }) {
  const visibleOrders = orders.slice(0, 12);
  return <div className="admin-subpanel">
    <div className="section-title"><h3>Заказы</h3><span>{orders.length}</span></div>
    {visibleOrders.length ? <div className="admin-table">{visibleOrders.map((order) => <article key={order.id} className={order.status === 'paid' ? 'paid' : ''}>
      <div><b>{order.title}</b><small>{order.playerName} · {formatAdminDate(order.createdAt)}</small></div>
      <span>{order.amountRub} ₽</span>
      <em>{order.status === 'paid' ? 'paid' : 'pending'}</em>
      {order.status === 'pending' ? <button onClick={() => confirmOrder(order)}>Подтвердить</button> : <strong>Открыто</strong>}
    </article>)}</div> : <p className="guest-name-note">Заказов пока нет. Первый заказ появится после покупки в магазине.</p>}
  </div>;
}

function AdminRooms({ rooms }) {
  const visibleRooms = rooms.slice(0, 10);
  return <div className="admin-subpanel">
    <div className="section-title"><h3>Комнаты</h3><span>{rooms.length}</span></div>
    {visibleRooms.length ? <div className="admin-room-list">{visibleRooms.map((room) => <article key={room.id}>
      <div className="admin-room-head"><b>#{room.code}</b><span>{adminRoomState(room)}</span></div>
      <p>{room.hostName || 'Без хоста'} · онлайн {room.onlineCount}/{room.playersCount} · {formatAdminDate(room.updatedAt)}</p>
      <div>{room.players.slice(0, 6).map((player) => <small key={player.id} className={player.online ? 'online' : ''}>{player.name}</small>)}</div>
    </article>)}</div> : <p className="guest-name-note">Активных комнат пока нет.</p>}
  </div>;
}

function adminRoomState(room) {
  const states = { lobby: 'лобби', round: 'раунд', round_result: 'итог раунда', match_result: 'итог матча' };
  if (room.roundPhase) return `${states[room.state] || room.state} · ${room.roundPhase}`;
  return states[room.state] || room.state;
}

function formatAdminDate(value) {
  if (!value) return 'нет даты';
  return new Date(value).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
