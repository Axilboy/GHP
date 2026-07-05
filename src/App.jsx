import { useEffect, useMemo, useState } from 'react';
import { useRef } from 'react';
import QRCode from 'qrcode';
import { socket, emit } from './socket';
import { getAccount, getOrCreateDisplayName, getPlayerId, getSessionKey, saveAccount, saveGuestDisplayName } from './identity';
import { AdvancedSpySettings, AuthModal, Storefront } from './RoadmapPanels';
import { localStore, sessionStore } from './browserStorage';
import { getSubscriptionStatus } from './profileStatus';
import { getSavedVkLaunch, initVkBridge, isVkRuntime, readVkLaunchParams, saveVkLaunch, verifyVkLaunch, vkSummary } from './vk';
import { APP_RELEASE_DATE, APP_RELEASE_NAME, APP_VERSION } from './version';
import { initYandexMetrika, reachMetrikaGoal, trackMetrikaPageView } from './yandexMetrika';

function formatTime(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function useAutoScrollCarousel(ref, deps = []) {
  useEffect(() => {
    const node = ref.current;
    if (!node || node.scrollWidth <= node.clientWidth) return undefined;
    const timer = window.setInterval(() => {
      const step = Math.max(260, Math.round(node.clientWidth * 0.82));
      const atEnd = node.scrollLeft + node.clientWidth >= node.scrollWidth - 8;
      node.scrollTo({ left: atEnd ? 0 : node.scrollLeft + step, behavior: 'smooth' });
    }, 4500);
    return () => window.clearInterval(timer);
  }, deps);
}

function CarouselControls({ target }) {
  const move = (direction) => {
    const node = target.current;
    if (!node) return;
    node.scrollBy({ left: direction * Math.max(260, Math.round(node.clientWidth * 0.82)), behavior: 'smooth' });
  };
  return <div className="carousel-controls"><button type="button" aria-label="Назад" onClick={() => move(-1)}>‹</button><button type="button" aria-label="Вперёд" onClick={() => move(1)}>›</button></div>;
}

function CarouselFrame({ target, children }) {
  const move = (direction) => {
    const node = target.current;
    if (!node) return;
    const firstCard = node.children?.[0];
    const gap = Number.parseFloat(getComputedStyle(node).gap || '0') || 0;
    const step = firstCard ? firstCard.getBoundingClientRect().width + gap : Math.max(260, Math.round(node.clientWidth * 0.82));
    node.scrollBy({ left: direction * step, behavior: 'smooth' });
  };
  return <div className="carousel-frame game-showcase-frame"><button className="carousel-card-arrow left" type="button" aria-label="Назад" onClick={() => move(-1)}>‹</button>{children}<button className="carousel-card-arrow right" type="button" aria-label="Вперёд" onClick={() => move(1)}>›</button></div>;
}

const spyModeNames = {
  classic: 'Классический',
  quick: 'Быстрый раунд',
  duo: 'Два шпиона',
};

function spySubjectCopy(subjectType = 'location') {
  if (subjectType === 'item') {
    return {
      typeValue: 'Предметы',
      dictionaryTitle: 'Словари предметов',
      defaultDictionary: 'Дом и быт',
      yourSecret: 'Ваш предмет',
      secretName: 'предмет',
      guessAction: 'Назвать предмет',
      spyHint: 'Узнайте предмет по ответам игроков и не выдайте себя.',
      discussionHint: 'Задавайте друг другу вопросы о предмете. Не называйте его напрямую.',
      guessHint: 'Остановите игру, назовите предмет вслух, а мирные решат, засчитать ответ или нет.',
      resultLabel: 'Предмет',
      matchLabel: 'Последний предмет',
      reviewTitle: 'Верно ли Шпион назвал предмет?',
      modeTipTitle: 'Режим предметов',
      modeTip: 'Здесь угадывают не место, а конкретную вещь. Вопросы лучше строить вокруг формы, материала, ситуации и того, кто этим пользуется.',
    };
  }
  return {
    typeValue: 'Места',
    dictionaryTitle: 'Словари мест',
    defaultDictionary: 'Базовые места',
    yourSecret: 'Ваша локация',
    secretName: 'место',
    guessAction: 'Назвать локацию',
    spyHint: 'Узнайте локацию по ответам игроков и не выдайте себя.',
    discussionHint: 'Задавайте друг другу вопросы о месте. Не называйте его напрямую.',
    guessHint: 'Остановите игру, назовите место вслух, а мирные решат, засчитать ответ или нет.',
    resultLabel: 'Локация',
    matchLabel: 'Последняя локация',
    reviewTitle: 'Верно ли Шпион назвал локацию?',
    modeTipTitle: 'Режим мест',
    modeTip: 'Классический Шпион: мирные знают место, шпион слушает ответы и пытается вычислить локацию.',
  };
}

function dictionaryCount(dictionary) {
  return `${dictionary.locationCount || 0} ${dictionary.countLabel || (dictionary.subjectType === 'item' ? 'предметов' : 'локаций')}`;
}

const bunkerFieldMeta = [
  { id: 'profession', label: 'Профессия' },
  { id: 'age', label: 'Возраст' },
  { id: 'biology', label: 'Биология' },
  { id: 'health', label: 'Здоровье' },
  { id: 'skill', label: 'Навык' },
  { id: 'baggage', label: 'Багаж' },
  { id: 'goal', label: 'Цель' },
  { id: 'fact', label: 'Факт' },
  { id: 'special', label: 'Спец-карта' },
];

const bunkerRevealModeNames = {
  private_table: 'Личная карточка на стол',
  public_turns: 'Вскрытие по очереди',
};

const bunkerContentPackOptions = [
  { id: 'classic', name: 'Классический бункер', badge: 'включён' },
  { id: 'hard_medical', name: 'Жёсткие болезни', badge: 'пак' },
  { id: 'party18', name: '18+ вечеринка', badge: 'пак' },
  { id: 'corporate', name: 'Корпоратив', badge: 'пак' },
  { id: 'space', name: 'Космос', badge: 'пак' },
  { id: 'mystic', name: 'Мистика', badge: 'пак' },
  { id: 'wasteland', name: 'Постапокалипсис', badge: 'пак' },
];

function hasGamePass(profile, gameId) {
  return profile?.gamePasses?.some((pass) => pass.gameId === gameId && pass.activeUntil > Date.now());
}

function hasRoomContentAccess(profile, gameId) {
  const subscription = getSubscriptionStatus(profile);
  const partyPass = profile?.partyPasses?.some((pass) => pass.activeUntil > Date.now());
  return subscription.active || partyPass || hasGamePass(profile, gameId);
}

function isVkHost() {
  return isVkRuntime();
}

function currentPath() {
  const path = location.pathname.replace(/\/+$/, '');
  return path || '/';
}

function analyticsSessionId() {
  const key = 'gamehubparty_analytics_session';
  try {
    const saved = sessionStore.getItem(key);
    if (saved) return saved;
    const next = `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStore.setItem(key, next);
    return next;
  } catch (_) {
    return '';
  }
}

function trackClientEvent(name, details = {}) {
  const params = new URLSearchParams(location.search);
  const payload = {
    name,
    details: {
      page: details.page,
      path: location.pathname,
      playerId: getPlayerId(),
      sessionId: analyticsSessionId(),
      referrer: document.referrer,
      source: params.get('utm_source') || '',
      medium: params.get('utm_medium') || '',
      campaign: params.get('utm_campaign') || '',
      ...details,
    },
  };
  fetch('/api/analytics/track', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
  if (name === 'page_view') trackMetrikaPageView(details.page);
  else reachMetrikaGoal(name, details);
}

const SESSION_GRACE_MS = 5 * 60 * 1000;

function readSavedSession(sessionKey) {
  try {
    return JSON.parse(localStore.getItem(sessionKey) || 'null');
  } catch {
    localStore.removeItem(sessionKey);
    return null;
  }
}

function normalizePausedSession(sessionKey, playerId, sourceRoom = null) {
  const saved = sourceRoom ? { roomId: sourceRoom.id, code: sourceRoom.code } : readSavedSession(sessionKey);
  if (!saved?.roomId) return null;
  const pausedUntil = saved.status === 'paused' && saved.pausedUntil ? saved.pausedUntil : Date.now() + SESSION_GRACE_MS;
  if (pausedUntil <= Date.now()) {
    localStore.removeItem(sessionKey);
    return null;
  }
  const session = {
    roomId: saved.roomId,
    code: sourceRoom?.code || saved.code || '',
    playerId,
    status: 'paused',
    pausedAt: saved.pausedAt || Date.now(),
    pausedUntil,
  };
  localStore.setItem(sessionKey, JSON.stringify(session));
  return session;
}

function saveActiveSession(sessionKey, playerId, nextRoom) {
  if (!nextRoom?.id) return;
  localStore.setItem(sessionKey, JSON.stringify({
    roomId: nextRoom.id,
    code: nextRoom.code || '',
    playerId,
    status: 'active',
    updatedAt: Date.now(),
  }));
}

export default function App() {
  const playerId = useMemo(getPlayerId, []);
  const sessionKey = useMemo(getSessionKey, []);
  const [room, setRoom] = useState(null);
  const [card, setCard] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [profile, setProfile] = useState(null);
  const [joinOpen, setJoinOpen] = useState(() => Boolean(new URLSearchParams(location.search).get('room')));
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [pausedSession, setPausedSession] = useState(() => normalizePausedSession(getSessionKey(), getPlayerId()));
  const [exitIntent, setExitIntent] = useState(null);
  const [vkLaunch, setVkLaunch] = useState(() => getSavedVkLaunch());
  const [view, setView] = useState(() => {
    const path = currentPath();
    if (path === '/games/spy') return 'spy';
    if (path === '/games/alias') return 'alias';
    if (path === '/games/bunker') return 'bunker';
    if (path === '/profile') return 'profile';
    if (path === '/store') return 'store';
    if (path === '/vk') return 'vk';
    if (path === '/admin') return 'admin';
    if (path === '/demo') return 'demo';
    if (path === '/privacy') return 'privacy';
    if (path === '/terms') return 'terms';
    if (path === '/contacts') return 'contacts';
    if (path === '/refund') return 'refund';
    if (isVkHost()) return 'vk';
    return 'home';
  });

  const isHost = room?.hostId === playerId;
  const me = room?.players.find((player) => player.id === playerId);

  useEffect(() => {
    initYandexMetrika();
  }, []);

  useEffect(() => {
    fetch('/api/games/spy/catalog').then((response) => response.json()).then(setCatalog).catch(() => {});
    const identify = () => {
      socket.emit('identify', { playerId });
      setTimeout(() => emit('get_profile').then((result) => setProfile(result.profile)).catch(() => {}), 50);
    };
    identify();
    socket.on('connect', identify);
    const onRoom = (nextRoom) => {
      const savedSession = readSavedSession(sessionKey);
      if (savedSession?.status === 'paused' && savedSession.roomId === nextRoom.id) {
        const nextPaused = { ...savedSession, code: nextRoom.code || savedSession.code || '' };
        localStore.setItem(sessionKey, JSON.stringify(nextPaused));
        setPausedSession(nextPaused);
        return;
      }
      setRoom(nextRoom);
      if (!nextRoom.round) setCard(null);
      if (nextRoom.state === 'round_result' || nextRoom.state === 'match_result') {
        emit('get_profile').then((result) => setProfile(result.profile)).catch(() => {});
      }
      saveActiveSession(sessionKey, playerId, nextRoom);
      setPausedSession(null);
    };
    socket.on('room_updated', onRoom);
    const session = normalizePausedSession(sessionKey, playerId);
    if (session?.roomId) setPausedSession(session);
    return () => {
      socket.off('connect', identify);
      socket.off('room_updated', onRoom);
    };
  }, [playerId, sessionKey]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    initVkBridge();
    const params = readVkLaunchParams();
    if (!params) return;
    verifyVkLaunch(params).then((launch) => {
      saveVkLaunch(launch);
      setVkLaunch(launch);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const titles = {
      home: 'GameHubParty — игры для компании без подготовки',
      spy: 'Игра Шпион онлайн бесплатно — GameHubParty',
      alias: 'Alias онлайн для компании — GameHubParty',
      bunker: 'Бункер онлайн для компании — GameHubParty',
      profile: 'Профиль игрока — GameHubParty',
      store: 'Магазин игр — GameHubParty',
      vk: 'GameHubParty во ВКонтакте',
      admin: 'Админка — GameHubParty',
      demo: 'Статус и обновления — GameHubParty',
      privacy: 'Политика конфиденциальности — GameHubParty',
      terms: 'Пользовательское соглашение — GameHubParty',
      contacts: 'Контакты и реквизиты — GameHubParty',
      refund: 'Возвраты — GameHubParty',
    };
    document.title = titles[view] || titles.home;
    const descriptions = {
      home: 'Игры для компании без подготовки: создайте комнату и пригласите друзей по коду или QR.',
      spy: 'Играйте в Шпиона онлайн бесплатно с друзьями. Без карточек и ведущего: роли, локации, таймер и голосование уже внутри.',
      alias: 'Alias онлайн для компании: объясняйте слова, собирайте команды и играйте без карточек и подготовки.',
      bunker: 'Играйте в Бункер онлайн: карточки выживших, катастрофа, убежище, обсуждение и голосование без ведущего.',
      profile: 'Профиль игрока GameHubParty.',
      store: 'Дополнительные наборы и локации для игр GameHubParty.',
      vk: 'Подготовка GameHubParty к запуску в VK Mini Apps.',
      admin: 'Закрытая админка GameHubParty.',
      demo: 'Страница статуса GameHubParty с историей обновлений, проверками и актуальными скриншотами.',
      privacy: 'Политика конфиденциальности GameHubParty.',
      terms: 'Пользовательское соглашение GameHubParty.',
      contacts: 'Контакты, поддержка и реквизиты GameHubParty для покупателей и платежной модерации.',
      refund: 'Условия возврата цифровых товаров и доступа GameHubParty.',
    };
    let description = document.querySelector('meta[name="description"]');
    if (!description) {
      description = document.createElement('meta');
      description.name = 'description';
      document.head.append(description);
    }
    description.content = descriptions[view] || descriptions.home;
  }, [view]);

  useEffect(() => {
    trackClientEvent('page_view', { page: view });
    if (view === 'store') trackClientEvent('open_store', { page: 'store' });
  }, [view]);

  async function action(name, payload = {}) {
    setError('');
    try {
      return await emit(name, { roomId: room?.id, ...payload });
    } catch (nextError) {
      setError(nextError.message);
      throw nextError;
    }
  }

  async function create(name, gameId = 'spy') {
    const result = await emit('create_room', { playerId, name, gameId });
    setRoom(result.room);
    saveActiveSession(sessionKey, playerId, result.room);
    setPausedSession(null);
    reachMetrikaGoal('room_created', { gameId });
  }

  useEffect(() => {
    const startRoom = () => create(getOrCreateDisplayName()).catch((nextError) => setError(nextError.message));
    window.addEventListener('gamehubparty:create-room', startRoom);
    return () => window.removeEventListener('gamehubparty:create-room', startRoom);
  }, [playerId, sessionKey]);

  async function join({ code, name }) {
    const result = await emit('join_room', { playerId, code, name });
    setRoom(result.room);
    saveActiveSession(sessionKey, playerId, result.room);
    setPausedSession(null);
    setJoinOpen(false);
    history.replaceState({}, '', location.pathname);
    reachMetrikaGoal('room_joined', { gameId: result.room?.gameId || 'spy' });
  }

  function pauseRoomSession(targetView = 'home') {
    const nextSession = normalizePausedSession(sessionKey, playerId, room);
    setPausedSession(nextSession);
    setRoom(null);
    setCard(null);
    goToView(targetView);
  }

  function requestLeave(targetView = 'home') {
    setExitIntent({ targetView });
  }

  function confirmLeaveIntent() {
    const targetView = exitIntent?.targetView || 'home';
    setExitIntent(null);
    pauseRoomSession(targetView);
  }

  async function returnToSession() {
    const session = readSavedSession(sessionKey);
    if (!session?.roomId) {
      setPausedSession(null);
      return;
    }
    try {
      const result = await emit('resume_room', { roomId: session.roomId, playerId });
      setRoom(result.room);
      saveActiveSession(sessionKey, playerId, result.room);
      setPausedSession(null);
      setError('');
    } catch (nextError) {
      localStore.removeItem(sessionKey);
      setPausedSession(null);
      setError(nextError.message);
    }
  }

  async function closeSavedSession() {
    const session = readSavedSession(sessionKey);
    if (session?.roomId) {
      await emit('leave_room', { roomId: session.roomId }).catch(() => {});
    }
    localStore.removeItem(sessionKey);
    setPausedSession(null);
    setRoom(null);
    setCard(null);
  }

  async function revealRole() {
    const result = await action('get_role');
    setCard(result.card);
  }

  function goToView(nextView) {
    const paths = { home: '/', spy: '/games/spy', alias: '/games/alias', bunker: '/games/bunker', profile: '/profile', store: '/store', vk: '/vk', admin: '/admin', demo: '/demo', privacy: '/privacy', terms: '/terms', contacts: '/contacts', refund: '/refund' };
    history.pushState({}, '', paths[nextView] || '/');
    setView(nextView);
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  function navigate(nextView) {
    if (room) {
      requestLeave(nextView);
      return;
    }
    goToView(nextView);
  }

  const sessionOverlay = <>
    {!room && pausedSession?.pausedUntil > now && <SessionReturnBanner session={pausedSession} now={now} returnToSession={returnToSession} closeSavedSession={closeSavedSession} />}
    {exitIntent && <SessionExitModal close={() => setExitIntent(null)} confirm={confirmLeaveIntent} />}
  </>;
  const withSessionOverlay = (screen) => <>{screen}{sessionOverlay}</>;

  if (!room) {
    if (view === 'profile') return withSessionOverlay(<ProfileScreen navigate={navigate} profile={profile} setProfile={setProfile} />);
    if (view === 'store') return withSessionOverlay(<StoreScreen navigate={navigate} profile={profile} setProfile={setProfile} catalog={catalog} />);
    if (view === 'vk') return withSessionOverlay(<VkMiniAppPage navigate={navigate} vkLaunch={vkLaunch} />);
    if (view === 'admin') return withSessionOverlay(<AdminPage navigate={navigate} />);
    if (view === 'demo') return withSessionOverlay(<DemoPage navigate={navigate} />);
    if (view === 'privacy') return withSessionOverlay(<LegalPage type="privacy" navigate={navigate} />);
    if (view === 'terms') return withSessionOverlay(<LegalPage type="terms" navigate={navigate} />);
    if (view === 'contacts') return withSessionOverlay(<LegalPage type="contacts" navigate={navigate} />);
    if (view === 'refund') return withSessionOverlay(<LegalPage type="refund" navigate={navigate} />);
    if (view === 'spy') return withSessionOverlay(<SpyLanding create={create} join={() => setJoinOpen(true)} joinOpen={joinOpen} closeJoin={() => setJoinOpen(false)} onJoin={join} error={error} navigate={navigate} vkLaunch={vkLaunch} profile={profile} />);
    if (view === 'alias') return withSessionOverlay(<AliasLanding create={create} join={() => setJoinOpen(true)} joinOpen={joinOpen} closeJoin={() => setJoinOpen(false)} onJoin={join} error={error} navigate={navigate} profile={profile} />);
    if (view === 'bunker') return withSessionOverlay(<BunkerLanding create={create} join={() => setJoinOpen(true)} joinOpen={joinOpen} closeJoin={() => setJoinOpen(false)} onJoin={join} error={error} navigate={navigate} profile={profile} />);
    return withSessionOverlay(<ProjectLanding create={create} navigate={navigate} join={() => setJoinOpen(true)} joinOpen={joinOpen} closeJoin={() => setJoinOpen(false)} onJoin={join} vkLaunch={vkLaunch} profile={profile} />);
  }

  if (room.state === 'lobby') {
    return withSessionOverlay(<Lobby room={room} me={me} isHost={isHost} catalog={catalog} profile={profile} action={action} leave={() => requestLeave('home')} navigate={navigate} error={error} />);
  }

  return withSessionOverlay(<Game room={room} me={me} isHost={isHost} card={card} revealRole={revealRole} action={action} leave={() => requestLeave('home')} navigate={navigate} catalog={catalog} now={now} error={error} />);
}

function SessionReturnBanner({ session, now, returnToSession, closeSavedSession }) {
  const timeLeft = session.pausedUntil - now;
  if (timeLeft <= 0) return null;
  const code = session.code ? `${session.code.slice(0, 3)} ${session.code.slice(3)}` : 'сессия';
  return <aside className="session-return-banner" aria-live="polite">
    <div className="session-return-glow" />
    <div className="session-return-copy">
      <span>Активная игра</span>
      <b>Вернуться в комнату {code}</b>
      <small>Мы держим место ещё {formatTime(timeLeft)}. Можно уйти окончательно или одним нажатием вернуться к компании.</small>
    </div>
    <div className="session-return-actions">
      <button className="button primary small" onClick={returnToSession}>Вернуться</button>
      <button className="button secondary small" onClick={closeSavedSession}>Выйти</button>
    </div>
  </aside>;
}

function SessionExitModal({ close, confirm }) {
  return <div className="backdrop session-exit-backdrop" onMouseDown={close}>
    <section className="modal session-exit-modal" onMouseDown={(event) => event.stopPropagation()}>
      <h2>Выйти в меню?</h2>
      <p>Комната сохранится на 5 минут. Вернуться можно будет без кода.</p>
      <div className="actions">
        <button className="button primary full" onClick={confirm}>Выйти в меню</button>
        <button className="button secondary full" onClick={close}>Остаться в игре</button>
      </div>
    </section>
  </div>;
}

function FeedbackModal({ close }) {
  const [topic, setTopic] = useState('idea');
  const [message, setMessage] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const topics = [
    { id: 'idea', label: 'Предложение' },
    { id: 'bug', label: 'Баг' },
    { id: 'payment', label: 'Оплата' },
    { id: 'other', label: 'Другое' },
  ];
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (message.trim().length < 8) {
      setError('Напишите чуть подробнее, чтобы мы поняли ситуацию.');
      return;
    }
    setStatus('sending');
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic,
          message,
          contactEmail,
          playerId: getPlayerId(),
          playerName: getOrCreateDisplayName(),
          page: location.href,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Не получилось отправить обращение');
      setStatus('sent');
    } catch (sendError) {
      setStatus('idle');
      setError(sendError.message || 'Не получилось отправить обращение');
    }
  };
  return <div className="backdrop feedback-backdrop" onMouseDown={close}>
    <section className="modal feedback-modal" onMouseDown={(event) => event.stopPropagation()}>
      <button className="modal-close" type="button" aria-label="Закрыть обратную связь" onClick={close}>×</button>
      {status === 'sent' ? <>
        <div className="feedback-orb">✓</div>
        <span className="eyebrow">Обратная связь</span>
        <h2>Спасибо, сообщение ушло в поддержку</h2>
        <p>Если оставили почту, мы сможем ответить. Если нет — все равно разберем обращение и поправим продукт.</p>
        <button className="button primary full" type="button" onClick={close}>Готово</button>
      </> : <form onSubmit={submit}>
        <span className="eyebrow">Обратная связь</span>
        <h2>Что случилось?</h2>
        <p>Можно написать идею, баг, вопрос по оплате или просто что мешает нормально играть.</p>
        <label className="field">
          <span>Тип обращения</span>
          <select value={topic} onChange={(event) => setTopic(event.target.value)}>
            {topics.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Сообщение</span>
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} maxLength={2000} placeholder="Например: в комнате не запускается раунд, оплата зависла или есть идея для Шпиона..." />
        </label>
        <label className="field">
          <span>Почта для ответа <small>необязательно</small></span>
          <input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} maxLength={120} placeholder="you@example.com" />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="feedback-submit-bar">
          <button className="button primary full" type="submit" disabled={status === 'sending'}>{status === 'sending' ? 'Отправляем...' : 'Отправить в поддержку'}</button>
          <small className="feedback-note">Адрес поддержки: support@gamehubparty.ru</small>
        </div>
      </form>}
    </section>
  </div>;
}

function Header({ right, navigate, gameTitle, brandTheme = 'ghp' }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [menuProfile, setMenuProfile] = useState(null);
  const [touchStartX, setTouchStartX] = useState(null);
  const name = getOrCreateDisplayName();
  useEffect(() => {
    if (menuOpen) emit('get_profile').then((result) => setMenuProfile(result.profile)).catch(() => {});
  }, [menuOpen]);
  const go = (nextView) => {
    setMenuOpen(false);
    if (navigate) navigate(nextView);
    else location.assign({ home: '/', spy: '/games/spy', alias: '/games/alias', bunker: '/games/bunker', profile: '/profile', store: '/store', vk: '/vk', admin: '/admin', demo: '/demo', privacy: '/privacy', terms: '/terms', contacts: '/contacts', refund: '/refund' }[nextView]);
  };
  const menuStatus = getSubscriptionStatus(menuProfile);
  const openFeedback = () => {
    setMenuOpen(false);
    trackClientEvent('feedback_opened', { page: currentPath() });
    setFeedbackOpen(true);
  };
  const createRoom = () => {
    setMenuOpen(false);
    window.dispatchEvent(new CustomEvent('gamehubparty:create-room'));
  };
  const logo = <><i>G</i><span>GameHub</span><mark>Party</mark></>;
  return <><header className="header wrap"><button className="brand project-logo ghp-logo" onClick={() => go('home')}>{logo}{gameTitle && <small>| {gameTitle}</small>}</button><div className="header-actions">{right}<button className="menu-button" aria-label="Открыть меню" onClick={() => setMenuOpen(true)}><span /><span /><span /></button></div></header>{menuOpen && <div className="backdrop menu-backdrop" onMouseDown={() => setMenuOpen(false)}><aside className="menu-sheet" onMouseDown={(event) => event.stopPropagation()} onTouchStart={(event) => setTouchStartX(event.touches[0].clientX)} onTouchEnd={(event) => { if (touchStartX !== null && touchStartX - event.changedTouches[0].clientX > 55) setMenuOpen(false); setTouchStartX(null); }}><button className="menu-profile" onClick={() => go('profile')}><div className={`menu-avatar ${menuStatus.active ? 'premium-avatar' : ''}`}>{name[0]?.toUpperCase()}{menuStatus.active && <span className="avatar-crown">♛</span>}</div><div><b>{menuProfile?.name || name}</b><small>{menuStatus.active ? `${menuStatus.plan} до ${menuStatus.untilText}` : 'Гостевой профиль'}</small></div><strong className={menuStatus.active ? 'premium-menu-badge' : ''}>{menuStatus.active ? menuStatus.plan : 'FREE'}</strong></button><nav><button onClick={() => go('store')}>Магазин и наборы</button><button onClick={openFeedback}>Обратная связь</button></nav><button className="button primary full" onClick={createRoom}>Создать комнату</button></aside></div>}{feedbackOpen && <FeedbackModal close={() => setFeedbackOpen(false)} />}</>;
}

function VersionBadge() {
  return <span className="badge version-badge">v{APP_VERSION}</span>;
}

function SubscriptionBadge({ profile }) {
  const status = getSubscriptionStatus(profile);
  if (!status.active) return null;
  return <span className="badge premium-badge">♛ {status.plan}</span>;
}

const roomThemesFallback = [
  { id: 'ghp', name: 'GHP Classic', free: true, priceRub: 0, description: 'Светлая базовая тема GameHubParty.' },
  { id: 'partyhub', name: 'PartyHub', free: false, priceRub: 149, description: 'Тёмная клубная тема с тёплым акцентом и контрастными кнопками.' },
];

function getRoomThemeName(themeId, themes = roomThemesFallback) {
  return themes.find((theme) => theme.id === themeId)?.name || 'GHP Classic';
}

function getOwnedThemeSet(profile) {
  return new Set(['ghp', ...(profile?.ownedThemeIds || [])]);
}

function hasActiveGamePass(profile, gameId) {
  return Boolean(getActiveGamePass(profile, gameId));
}

function getActiveGamePass(profile, gameId) {
  return profile?.gamePasses?.find((pass) => pass.gameId === gameId && pass.activeUntil > Date.now()) || null;
}

function formatAccessDate(activeUntil) {
  if (!activeUntil) return '';
  return new Date(activeUntil).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function profileAccessList(profile) {
  const now = Date.now();
  const items = [];
  const subscription = getSubscriptionStatus(profile);
  if (subscription.active) {
    items.push({
      id: 'subscription',
      title: `${subscription.plan} подписка`,
      label: 'Вся платформа',
      until: profile?.subscription?.activeUntil,
      note: 'Игры, стандартные библиотеки и отключение рекламы на срок подписки.',
    });
  }
  for (const pass of profile?.gamePasses || []) {
    if (pass.activeUntil <= now) continue;
    const names = { spy: 'Spy Pass', alias: 'Alias Pass', bunker: 'Bunker Pass' };
    items.push({
      id: pass.id || pass.productId,
      title: names[pass.gameId] || 'Game Pass',
      label: pass.gameId === 'spy' ? 'Шпион' : pass.gameId === 'alias' ? 'Alias' : pass.gameId === 'bunker' ? 'Бункер' : 'Игра',
      until: pass.activeUntil,
      note: 'Расширения и отключение рекламы только в этой игре.',
    });
  }
  for (const pass of profile?.partyPasses || []) {
    if (pass.activeUntil <= now) continue;
    items.push({
      id: pass.id,
      title: 'WeekendPass',
      label: 'Вечер для комнаты',
      until: pass.activeUntil,
      note: 'Все доступные игры и без рекламных пауз для комнаты.',
    });
  }
  return items;
}

function hasTimedGameAccess(profile, gameId) {
  const subscriptionActive = Number(profile?.subscription?.activeUntil || 0) > Date.now();
  const partyPassActive = profile?.partyPasses?.some((pass) => pass.activeUntil > Date.now());
  return Boolean(profile?.pro || profile?.proPlus || subscriptionActive || partyPassActive || hasGamePass(profile, gameId));
}

const demoScreenshots = [
  { title: 'Демо-страница', file: '/demo/screenshots/00-demo.png' },
  { title: 'Магазин и подписки', file: '/demo/screenshots/01-store.png' },
  { title: 'Профиль и покупки', file: '/demo/screenshots/02-profile-custom-dictionary.png' },
  { title: 'Лобби хоста', file: '/demo/screenshots/03-host-lobby-settings.png' },
  { title: 'Раздача роли', file: '/demo/screenshots/04-role-reveal.png' },
  { title: 'Обсуждение', file: '/demo/screenshots/05-discussion.png' },
];

const screenshotFolders = [
  {
    title: '30.06.2026 - релиз v0.4.0: MVP Бункера',
    description: 'Добавлен первый играбельный MVP "Бункера": лендинг, комната, карточки выживших, катастрофа, убежище, обсуждение, голосование и итог исключения.',
    shots: [
      { title: 'Лендинг Бункера', file: '/demo/screenshots/2026-06-30-v040-bunker-mvp/01-bunker-landing.png' },
      { title: 'Лобби и настройки хоста', file: '/demo/screenshots/2026-06-30-v040-bunker-mvp/02-bunker-lobby-settings.png' },
      { title: 'Принятие правил и цель партии', file: '/demo/screenshots/2026-06-30-v040-bunker-mvp/03-bunker-briefing.png' },
      { title: 'Режим “телефон на стол”', file: '/demo/screenshots/2026-06-30-v040-bunker-mvp/04-bunker-private-card.png' },
      { title: 'Обсуждение катастрофы и цели', file: '/demo/screenshots/2026-06-30-v040-bunker-mvp/05-bunker-discussion.png' },
      { title: 'Голосование совета', file: '/demo/screenshots/2026-06-30-v040-bunker-mvp/06-bunker-voting.png' },
      { title: 'Режим “вскрытие по очереди”', file: '/demo/screenshots/2026-06-30-v040-bunker-mvp/07-bunker-public-reveal.png' },
      { title: 'Общие раскрытые карточки', file: '/demo/screenshots/2026-06-30-v040-bunker-mvp/08-bunker-public-discussion.png' },
    ],
  },
  {
    title: '30.06.2026 - релиз v0.3.21: фикс цветов тем',
    description: 'Базовая GHP-тема снова использует синий цвет проекта, а жёлтый акцент оставлен только для PartyHub-карточки и комнаты с активной PartyHub-темой.',
    shots: [
      { title: 'GHP синий, PartyHub жёлтый', file: '/demo/screenshots/2026-06-30-v0321-theme-color-fix/01-theme-color-fix.png' },
    ],
  },
  {
    title: '28.06.2026 - релиз v0.3.20: темы комнаты',
    description: 'В магазине появилась косметика комнаты: базовая тема GHP и платная PartyHub. Хост может применить свою тему, игрок может предложить купленную тему, а хост принять её для всей комнаты.',
    shots: [
      { title: 'Темы в магазине и выбор темы в лобби', file: '/demo/screenshots/2026-06-28-v0320-room-themes/01-room-themes.png' },
    ],
  },
  {
    title: '28.06.2026 - релиз v0.3.19: лобби и админка',
    description: 'Лобби стало понятнее: PartyHub в шапке показывает текущую игру, реклама стоит под кодом комнаты, игроки не видят настройки, а хост управляет игрой через компактные сворачиваемые блоки. В админке добавлены быстрые действия для всех наборов.',
    shots: [
      { title: 'Лобби и панель хоста', file: '/demo/screenshots/2026-06-28-v0319-lobby-admin/01-lobby-host-controls.png' },
    ],
  },
  {
    title: '28.06.2026 - релиз v0.3.18: база рекламы',
    description: 'Реклама вынесена в базовые внутренние слоты: маленький баннер в лобби для нехоста и 5-секундная пауза перед стартом/следующим раундом. Если внешняя сеть не подключена, показывается аккуратная внутренняя пауза с предложением отключить рекламу подпиской.',
    shots: [
      { title: 'Внутренние рекламные слоты', file: '/demo/screenshots/2026-06-28-v0318-ad-base/01-ad-base-slots.png' },
    ],
  },
  {
    title: '28.06.2026 - релиз v0.3.17: редактор аватара',
    description: 'После выбора картинки открывается редактор аватарки: круглый предпросмотр, зум и сдвиг по горизонтали/вертикали. В профиль сохраняется уже аккуратно кадрированное изображение.',
    shots: [
      { title: 'Редактор кадра аватарки', file: '/demo/screenshots/2026-06-28-v0317-avatar-editor/01-avatar-crop-editor.png' },
    ],
  },
  {
    title: '28.06.2026 - релиз v0.3.16: личный кабинет и админ-поиск',
    description: 'В профиле можно выйти из аккаунта, поменять имя и аватар с устройства, а ID игрока показан тихой служебной строкой. Админка показывает только зарегистрированных игроков и умеет искать по ID, почте или имени.',
    shots: [
      { title: 'Личный кабинет с ID и редактированием профиля', file: '/demo/screenshots/2026-06-28-v0316-account-admin/01-profile-account-edit.png' },
      { title: 'Админка: зарегистрированные игроки и поиск', file: '/demo/screenshots/2026-06-28-v0316-account-admin/02-admin-registered-search.png' },
    ],
  },
  {
    title: '28.06.2026 - релиз v0.3.15: вход по почте',
    description: 'Покупки больше не оформляются гостем: магазин показывает аккуратную плашку входа, а регистрация, вход и восстановление доступа идут через код на почту без пароля.',
    shots: [
      { title: 'Магазин предлагает войти перед покупкой', file: '/demo/screenshots/2026-06-28-v0315-email-auth/01-store-auth-nudge.png' },
      { title: 'Окно входа по почте', file: '/demo/screenshots/2026-06-28-v0315-email-auth/02-email-auth-modal.png' },
    ],
  },
  {
    title: '28.06.2026 - релиз v0.3.14: обратная связь в меню',
    description: 'Боковое меню стало чище: внутренние ссылки убраны, вместо них добавлена форма обратной связи для идей, багов и вопросов по оплате. Сообщения уходят на сервер, сохраняются и готовы к SMTP-отправке на поддержку.',
    shots: [
      { title: 'Окно обратной связи из бокового меню', file: '/demo/screenshots/2026-06-28-v0314-feedback/01-feedback-modal.png' },
      { title: 'Заполненное обращение с почтой для ответа', file: '/demo/screenshots/2026-06-28-v0314-feedback/02-feedback-filled.png' },
    ],
  },
  {
    title: '28.06.2026 - релиз v0.3.13: красивая подготовка к платежам',
    description: 'Магазин получил отдельную витрину готовности к подключению платежей: товары, цены, цифровая выдача, документы, возвраты и поддержка показаны понятными карточками. Юридические страницы стали аккуратнее и доверительнее.',
    shots: [
      { title: 'Витрина платежной готовности в магазине', file: '/demo/screenshots/2026-06-28-v0313-payment-polish/01-store-payment-polish.png' },
      { title: 'Контакты и реквизиты в красивой подаче', file: '/demo/screenshots/2026-06-28-v0313-payment-polish/02-contacts-polish.png' },
      { title: 'Возвраты и условия покупки', file: '/demo/screenshots/2026-06-28-v0313-payment-polish/03-refund-polish.png' },
    ],
  },
  {
    title: '27.06.2026 - релиз v0.3.12: карточка роли лицом вниз',
    description: 'Раздача роли в Шпионе теперь начинается с единой закрытой карточки: игрок нажимает на нее, смотрит роль без отличий по цвету или форме, затем скрывает карту. Старые кнопки "Показать роль" и "Открыть карту" убраны.',
    shots: [
      { title: 'Карточка роли лицом вниз', file: '/demo/screenshots/2026-06-27-v0312-role-card/01-role-card-back.png' },
      { title: 'Карточка после нажатия', file: '/demo/screenshots/2026-06-27-v0312-role-card/02-role-card-revealed.png' },
    ],
  },
  {
    title: '27.06.2026 - релиз v0.3.11: упрощенный раунд Шпиона',
    description: 'Экран обсуждения очищен от лишних подсказок и ручных кнопок: остался таймер, цель раунда и одна кнопка ответа для Шпиона. Голосование за шпиона включается по таймеру, служебные кнопки хоста убраны из раунда.',
    shots: [
      { title: 'Чистое обсуждение', file: '/demo/screenshots/2026-06-27-v0311-spy-clean-round/01-clean-discussion.png' },
      { title: 'Ответ Шпиона вслух', file: '/demo/screenshots/2026-06-27-v0311-spy-clean-round/02-spy-answer-modal.png' },
    ],
  },
  {
    title: '27.06.2026 - релиз v0.3.10: мягкий выход из сессии',
    description: 'Игрока больше не затягивает обратно в лобби автоматически: при уходе появляется красивая модалка, сессия ставится на паузу на 5 минут, а на страницах показывается плашка возврата или окончательного выхода.',
    shots: [
      { title: 'Подтверждение ухода из комнаты', file: '/demo/screenshots/2026-06-27-v0310-session-return/01-exit-confirm-modal.png' },
      { title: 'Плашка возврата на странице магазина', file: '/demo/screenshots/2026-06-27-v0310-session-return/02-return-banner-store.png' },
      { title: 'Возврат в комнату без кода', file: '/demo/screenshots/2026-06-27-v0310-session-return/03-returned-to-room.png' },
    ],
  },
  {
    title: '27.06.2026 - релиз v0.3.9: ответ Шпиона и лендинги',
    description: 'Шпион теперь останавливает игру и отвечает вслух, а мирные голосуют, засчитывать ответ или нет. Предметный режим получил отдельные подсказки, главная и лендинги Шпиона/Alias усилены.',
    shots: [
      { title: 'Проверка ответа Шпиона', file: '/demo/screenshots/2026-06-27-v039-spy-answer-landings/01-spy-answer-review.png' },
      { title: 'Предметный режим в настройках', file: '/demo/screenshots/2026-06-27-v039-spy-answer-landings/02-item-mode-settings.png' },
      { title: 'Главный лендинг', file: '/demo/screenshots/2026-06-27-v039-spy-answer-landings/03-home-landing.png' },
      { title: 'Лендинг Шпиона', file: '/demo/screenshots/2026-06-27-v039-spy-answer-landings/04-spy-landing.png' },
      { title: 'Лендинг Alias', file: '/demo/screenshots/2026-06-27-v039-spy-answer-landings/05-alias-landing.png' },
    ],
  },
  {
    title: '22.06.2026 - релиз v0.3.8: единая стилистика обложек',
    description: 'Перерисованы спорные обложки предметных наборов и "Мемов" в общей painterly-стилистике GameHubParty; плоские иконки больше не используем как магазинные карточки.',
    shots: [
      { title: 'Магазин с обновленными обложками', file: '/demo/screenshots/2026-06-22-v038-cover-style-fix/01-store-cover-style.png' },
      { title: 'Проверка визуальной серии', file: '/demo/screenshots/2026-06-22-v038-cover-style-fix/02-cover-style-board.png' },
    ],
  },
  {
    title: '21.06.2026 - релиз v0.3.7: предметные наборы и чистые обложки',
    description: 'Добавлены платные наборы "Виды алкоголя" и "Компьютерные игры", расширен пак предметов, а проблемная обложка с UI-артефактами заменена чистой PNG-иллюстрацией.',
    shots: [
      { title: 'Новые платные предметные наборы', file: '/demo/screenshots/2026-06-21-v037-spy-item-packs/01-store-new-item-packs.png' },
      { title: 'Чистые обложки без артефактов', file: '/demo/screenshots/2026-06-21-v037-spy-item-packs/02-clean-covers.png' },
    ],
  },
  {
    title: '21.06.2026 - релиз v0.3.6: Шпион с предметами',
    description: 'В Шпион добавлен режим предметов: бесплатные наборы Дом и быт / Вещи вечеринки, платные Гаджеты / Для влюбленных / 18+ намёки / Странные вещи, отдельные подписи в игре и магазине.',
    shots: [
      { title: 'Настройки режима предметов', file: '/demo/screenshots/2026-06-21-v036-spy-items/01-items-settings.png' },
      { title: 'Наборы предметов в магазине', file: '/demo/screenshots/2026-06-21-v036-spy-items/02-store-item-dictionaries.png' },
      { title: 'Карточка предмета в игре', file: '/demo/screenshots/2026-06-21-v036-spy-items/03-item-role-card.png' },
    ],
  },
  {
    title: '20.06.2026 - релиз v0.3.5: обложки словарей Шпиона',
    description: 'Для новых тематических словарей добавлены отдельные PNG-обложки и подключены к карточкам магазина, мини-превью и модалкам товара.',
    shots: [
      { title: 'Новые обложки в магазине', file: '/demo/screenshots/2026-06-20-v035-spy-covers/01-store-new-covers.png' },
      { title: 'Модалка тематического словаря', file: '/demo/screenshots/2026-06-20-v035-spy-covers/02-dictionary-cover-modal.png' },
    ],
  },
  {
    title: '20.06.2026 - релиз v0.3.4: админ-доступы',
    description: 'В админке можно выдавать и забирать покупки, словари, пакеты, PRO/PRO+, пропуск компании и удалять записи покупок у игроков.',
    shots: [
      { title: 'Игроки и доступы в админке', file: '/demo/screenshots/2026-06-20-v034-admin-access/01-admin-access.png' },
      { title: 'Выдача доступа игроку', file: '/demo/screenshots/2026-06-20-v034-admin-access/02-admin-grant-access.png' },
    ],
  },
  {
    title: '20.06.2026 - релиз v0.3.3: Alias и словари Шпиона',
    description: 'Alias получил отдельный красивый лендинг, а Шпион - новые тематические словари для 18+, пар, пьянок, корпоративов и интернет-компаний.',
    shots: [
      { title: 'Лендинг Alias', file: '/demo/screenshots/2026-06-20-v033-alias-spy-packs/01-alias-landing.png' },
      { title: 'Новые словари Шпиона в магазине', file: '/demo/screenshots/2026-06-20-v033-alias-spy-packs/02-store-spy-packs.png' },
      { title: 'Детали тематического набора', file: '/demo/screenshots/2026-06-20-v033-alias-spy-packs/03-spy-pack-details.png' },
    ],
  },
  {
    title: '20.06.2026 - релиз v0.3.2: интерфейс без XP',
    description: 'XP скрыт из шапки, меню, профиля, магазина и недавних игр, пока у прогресса нет понятной ценности для игрока.',
    shots: [
      { title: 'Профиль без XP', file: '/demo/screenshots/2026-06-20-v032-no-xp/01-profile-no-xp.png' },
      { title: 'Магазин без XP в шапке', file: '/demo/screenshots/2026-06-20-v032-no-xp/02-store-no-xp.png' },
    ],
  },
  {
    title: '20.06.2026 - релиз v0.3.1: PRO-статус и лендинг Шпиона',
    description: 'Добавлены видимые PRO/PRO+ статусы с датой, корона у аватара, магазин скрывает PRO-предложения при активной подписке, а лендинг Шпиона стал самостоятельнее для продвижения.',
    shots: [
      { title: 'Лендинг Шпиона для продвижения', file: '/demo/screenshots/2026-06-20-v031-pro-spy/01-spy-landing-v031.png' },
      { title: 'Профиль с PRO-короной', file: '/demo/screenshots/2026-06-20-v031-pro-spy/02-profile-pro-crown.png' },
      { title: 'Магазин при активной подписке', file: '/demo/screenshots/2026-06-20-v031-pro-spy/03-store-active-pro.png' },
      { title: 'Карточки магазина с ценой', file: '/demo/screenshots/2026-06-20-v031-pro-spy/04-store-price-buttons.png' },
    ],
  },
  {
    title: '20.06.2026 - релиз v0.3.0: Шпион, главная и магазин',
    description: 'Публичные страницы выглядят как готовый продукт: версия в интерфейсе, обновленная главная, понятный Шпион, аккуратный магазин и мягкая рекламная пауза.',
    shots: [
      { title: 'Главная v0.3.0', file: '/demo/screenshots/2026-06-20-v030-polish/01-home-v030.png' },
      { title: 'Страница Шпиона', file: '/demo/screenshots/2026-06-20-v030-polish/02-spy-polish.png' },
      { title: 'Магазин наборов', file: '/demo/screenshots/2026-06-20-v030-polish/03-store-polish.png' },
      { title: 'Статус и история обновлений', file: '/demo/screenshots/2026-06-20-v030-polish/04-status-updates.png' },
    ],
  },
  {
    title: '20.06.2026 - рекламная модель Free/PRO',
    description: 'Добавлены рекламные паузы для Free-комнат и правило: любой PRO, PRO+ или пропуск компании убирает рекламу для всей комнаты.',
    shots: [
      { title: 'Free-комната с рекламными паузами', file: '/demo/screenshots/2026-06-20-ad-mvp/01-free-lobby-ads.png' },
      { title: 'Рекламная пауза перед стартом', file: '/demo/screenshots/2026-06-20-ad-mvp/02-pre-round-ad.png' },
      { title: 'PRO-игрок убрал рекламу для всех', file: '/demo/screenshots/2026-06-20-ad-mvp/03-pro-adfree-room.png' },
      { title: 'Демо-папка с отчетом', file: '/demo/screenshots/2026-06-20-ad-mvp/04-demo-folder.png' },
    ],
  },
  {
    title: '20.06.2026 - подготовка к YooKassa',
    description: 'Добавлены публичные страницы контактов, возвратов, расширенная оферта и понятная выдача цифрового заказа в магазине.',
    shots: [
      { title: 'Магазин и получение цифрового заказа', file: '/demo/screenshots/2026-06-20-yookassa-ready/01-store-delivery.png' },
      { title: 'Контакты и реквизиты', file: '/demo/screenshots/2026-06-20-yookassa-ready/02-contacts.png' },
      { title: 'Возвраты и условия', file: '/demo/screenshots/2026-06-20-yookassa-ready/03-refund-terms.png' },
      { title: 'Демо-папка с отчетом', file: '/demo/screenshots/2026-06-20-yookassa-ready/04-demo-folder.png' },
    ],
  },
  {
    title: '20.06.2026 - админка заказов и комнат',
    description: 'Добавлена операционная панель: метрики, активные комнаты, demo-заказы и подтверждение pending-заказов из админки.',
    shots: [
      { title: 'Операционная панель админки', file: '/demo/screenshots/2026-06-20-admin-ops/01-admin-ops.png' },
      { title: 'Демо-страница с новой папкой', file: '/demo/screenshots/2026-06-20-admin-ops/02-demo-folder.png' },
    ],
  },
  {
    title: '19.06.2026 - админка, платежка и результат Шпиона',
    description: 'Доработаны чеклисты админки, оформление заказа, магазин с нормальными текстами и экран результата Шпиона. После правок прогоняются тесты и деплой.',
    shots: [
      { title: 'Админка с чеклистами и описанием релиза', file: '/demo/screenshots/2026-06-19-mvp-payment-admin/01-admin-release.png' },
      { title: 'Магазин и оформление заказа', file: '/demo/screenshots/2026-06-19-mvp-payment-admin/02-store-payment.png' },
      { title: 'Результат Шпиона', file: '/demo/screenshots/2026-06-19-mvp-payment-admin/03-spy-result.png' },
      { title: 'Демо-страница с новой папкой', file: '/demo/screenshots/2026-06-19-mvp-payment-admin/04-demo-folder.png' },
    ],
  },
  {
    title: '18.06.2026 22:10 - админка и папки скриншотов',
    description: 'Убрана публичная кнопка Админ из шапки, скрыта подсказка PIN, скриншоты сгруппированы в папку с каруселью.',
    shots: [
      { title: 'Вход в админку без публичного PIN', file: '/demo/screenshots/2026-06-18-2210-admin-screenshots/01-admin-login.png' },
      { title: 'Демо-страница с папками скриншотов', file: '/demo/screenshots/2026-06-18-2210-admin-screenshots/02-demo-folders.png' },
      { title: 'Шапка без кнопки Админ', file: '/demo/screenshots/2026-06-18-2210-admin-screenshots/03-header-no-admin-button.png' },
    ],
  },
  {
    title: '18.06.2026 22:10',
    description: 'Срез текущего состояния: демо-страница, магазин, профиль, лобби и игровой процесс Шпиона.',
    shots: demoScreenshots,
  },
];

function AdminPage({ navigate }) {
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

function GameFunnelStrip({ game = 'home', navigate }) {
  const copy = {
    home: {
      eyebrow: 'Быстрый путь',
      title: 'Сначала игра, потом усиления',
      steps: [
        ['1', 'Создайте комнату', 'Хост запускает игру и получает код.'],
        ['2', 'Позовите друзей', 'Ссылка, код или QR открываются с телефона.'],
        ['3', 'Откройте наборы', 'После первой партии легко докупить темы и словари.'],
      ],
    },
    spy: {
      eyebrow: 'Игровая воронка',
      title: 'Запуск Шпиона без паузы',
      steps: [
        ['1', 'Комната за минуту', 'Базовые места доступны сразу.'],
        ['2', 'Вопросы вслух', 'Телефон хранит роль и ведёт таймер.'],
        ['3', 'Больше партий', 'Spy Pass открывает полную библиотеку и свои локации.'],
      ],
    },
    alias: {
      eyebrow: 'Игровая воронка',
      title: 'Alias быстро разогревает компанию',
      steps: [
        ['1', 'Команды', 'Игроки делятся и сразу видят очередь.'],
        ['2', 'Ход по таймеру', 'На экране только слово и крупные действия.'],
        ['3', 'Наборы позже', 'Словари под компании станут естественной покупкой.'],
      ],
    },
    bunker: {
      eyebrow: 'Игровая воронка',
      title: 'Бункер держит драму на телефонах',
      steps: [
        ['1', 'Карточка игрока', 'Каждый видит свои факты и решает, что раскрыть.'],
        ['2', 'Спор вслух', 'Сайт показывает цель, бункер и время.'],
        ['3', 'Сценарии', 'Новые катастрофы и паки дают повод сыграть ещё.'],
      ],
    },
  }[game];
  return <section className="funnel-strip wrap">
    <span className="eyebrow">{copy.eyebrow}</span>
    <h2>{copy.title}</h2>
    <div className="funnel-steps">{copy.steps.map(([num, title, text]) => <article key={num}><b>{num}</b><span>{title}</span><small>{text}</small></article>)}</div>
    <button className="button secondary full" onClick={() => navigate('store')}>Посмотреть доступы и наборы</button>
  </section>;
}

function LandingPlaybook({ game = 'spy' }) {
  const copy = {
    spy: {
      eyebrow: 'Как играется',
      title: 'Роли на телефонах, спор за столом',
      items: [
        ['Секрет у мирных', 'Место или предмет видят все, кроме Шпиона.'],
        ['Вопросы вслух', 'Игроки отвечают так, чтобы помочь своим и не раскрыться чужому.'],
        ['Финальное решение', 'Шпион может рискнуть с ответом, а компания голосует.'],
      ],
    },
    alias: {
      eyebrow: 'Как играется',
      title: 'Быстрые ходы без карточек и ведущего',
      items: [
        ['Команды готовы', 'Хост выбирает время и счёт до победы.'],
        ['Слово на экране', 'Объясняйте ассоциациями, примерами и ситуациями.'],
        ['Счёт сам ведётся', 'Отмечайте угаданные и пропущенные слова одним нажатием.'],
      ],
    },
    bunker: {
      eyebrow: 'Как играется',
      title: 'Выживание на телефонах, драма вслух',
      items: [
        ['Карточка персонажа', 'Профессия, здоровье, навык, багаж и факт остаются под рукой.'],
        ['Убежище на виду', 'Катастрофа, цель и условия бункера видны всей комнате.'],
        ['Совет решает', 'После обсуждения компания голосует, кто остаётся снаружи.'],
      ],
    },
  }[game];
  return <section className="landing-section landing-playbook wrap"><span className="eyebrow">{copy.eyebrow}</span><h2>{copy.title}</h2><div>{copy.items.map(([title, text]) => <article key={title}><b>{title}</b><span>{text}</span></article>)}</div></section>;
}

function LandingAccessShowcase({ game = 'spy', navigate, profile }) {
  const gameNames = { home: 'все игры', spy: 'Шпиона', alias: 'Alias', bunker: 'Бункер' };
  const passNames = { home: 'PRO', spy: 'Spy Pass', alias: 'Alias Pass', bunker: 'Bunker Pass' };
  const hasAccess = game === 'home' ? hasTimedGameAccess(profile, 'spy') && hasTimedGameAccess(profile, 'alias') && hasTimedGameAccess(profile, 'bunker') : hasTimedGameAccess(profile, game);
  const cards = {
    home: [
      ['cover-city', 'Больше сценариев', 'Дополнительные наборы для разных компаний.'],
      ['cover-after_dark', 'Комнаты без рекламы', 'Активный доступ хоста убирает паузы у всех.'],
      ['cover-party', 'Один профиль', 'Покупки и сроки доступа остаются в профиле.'],
    ],
    spy: [
      ['cover-city', 'Полная библиотека', 'Локации, предметы и тематические наборы.'],
      ['cover-drinks', 'Режимы для компании', 'Два шпиона, быстрые раунды и больше поводов спорить.'],
      ['cover-memes', 'Свои локации', 'Добавляйте места под вашу компанию.'],
    ],
    alias: [
      ['cover-party', 'Словари под вечер', 'Домашние, офисные и вечериночные темы.'],
      ['cover-pop', 'Больше темпа', 'Новые наборы быстро освежают повторные партии.'],
      ['cover-office_party', 'Для хоста', 'Одна покупка открывает комнату без рекламы.'],
    ],
    bunker: [
      ['cover-secret', 'Новые катастрофы', 'Медицинские, космические и суровые сценарии.'],
      ['cover-fantasy', 'Больше ролей', 'Спецкарты и цели, которые меняют аргументы игроков.'],
      ['cover-after_dark', 'Без рекламных пауз', 'Game Pass этой игры убирает рекламу в комнате.'],
    ],
  }[game];
  return <section className="landing-section landing-access wrap"><div className="landing-access-head"><span className="eyebrow">Что откроется</span><h2>{passNames[game]} или PRO для {gameNames[game]}</h2><p>{hasAccess ? 'Доступ уже активен. Можно сразу создавать комнату и пользоваться расширениями.' : 'Начните бесплатно, а когда компания втянется — откройте расширения и уберите рекламу в комнате.'}</p></div><div className="landing-access-grid">{cards.map(([cover, title, text]) => <article key={title}><div className={`cover mini ${cover}`} /><b>{title}</b><span>{text}</span></article>)}</div><button className="button secondary full" onClick={() => navigate('store')}>{hasAccess ? 'Посмотреть мои доступы' : 'Открыть магазин'}</button></section>;
}

function ProjectLanding({ create, navigate, join, joinOpen, closeJoin, onJoin, vkLaunch, profile }) {
  const name = getOrCreateDisplayName();
  const gamesRef = useRef(null);
  useAutoScrollCarousel(gamesRef, []);
  return <main className="project-landing">
    <Header navigate={navigate} right={<SubscriptionBadge profile={profile} />} />
    <VkStatus launch={vkLaunch} />
    <section className="project-hero wrap upgraded-hero"><div className="landing-art hub-art" /><h1>Игры для компании в телефоне</h1><p>Создайте комнату, выберите игру и позовите друзей по коду. GameHubParty сам ведёт роли, таймер и голосование.</p><div className="actions"><button className="button primary" onClick={() => create(name)}>Начать игру</button><button className="button secondary" onClick={join}>Войти по коду</button></div></section>
    <section className="landing-section game-showcase-section wrap"><div className="section-title carousel-title"><div><span className="eyebrow">Игры для компании</span><h2>Витрина игр</h2></div></div><CarouselFrame target={gamesRef}><div className="landing-games game-showcase" ref={gamesRef}><button onClick={() => navigate('spy')}><div className="landing-game-art spy-art" /><span className="badge live">Готово</span><h3>Шпион</h3><p>Секретное место или предмет, вопросы вслух и голосование за подозреваемого.</p><strong>Открыть игру</strong></button><button onClick={() => navigate('alias')}><div className="landing-game-art alias-art" /><span className="badge live">Готово</span><h3>Alias</h3><p>Команды объясняют слова на скорость, а телефон ведёт таймер и счёт.</p><strong>Открыть Alias</strong></button><button onClick={() => navigate('bunker')}><div className="landing-game-art bunker-art" /><span className="badge live">Готово</span><h3>Бункер</h3><p>Катастрофа, карточки выживших и спор за место в убежище.</p><strong>Открыть Бункер</strong></button></div></CarouselFrame></section>
    <LandingAccessShowcase game="home" navigate={navigate} profile={profile} />
    <section className="landing-cta wrap"><h2>Готовы играть?</h2><p>Начните с комнаты для Шпиона или выберите игру в витрине.</p><button className="button primary full" onClick={() => create(name)}>Начать игру</button></section>
    <SeoLinks />
    {joinOpen && <JoinModal initialName={name} close={closeJoin} join={onJoin} />}
  </main>;
}

function SpyLanding({ create, join, joinOpen, closeJoin, onJoin, error, navigate, vkLaunch, profile }) {
  const name = getOrCreateDisplayName();
  return (
    <main className="spy-landing">
      <Header navigate={navigate} right={<><SubscriptionBadge profile={profile} /><VersionBadge /><span className="badge">Шпион</span></>} />
      <VkStatus launch={vkLaunch} />
      <section className="hero wrap spy-hero">
        <div className="landing-art spy-art" />
        <span className="eyebrow">Онлайн-игра для компании от 3 человек</span>
        <h1>Шпион онлайн: места, предметы и живой спор</h1>
        <p>Мирные знают секрет, Шпион слушает ответы. Если он готов рискнуть, он останавливает игру, называет ответ вслух, а компания голосует, засчитать или нет.</p>
        <div className="actions">
          <button className="button primary" onClick={() => create(name)}>Начать игру</button>
          <button className="button secondary join-button" onClick={join}><ScanIcon />Присоединиться</button>
        </div>
        {error && <ErrorText text={error} />}
      </section>
      <LandingPlaybook game="spy" />
      <LandingAccessShowcase game="spy" navigate={navigate} profile={profile} />
      <SeoLinks />
      {joinOpen && <JoinModal initialName={name} close={closeJoin} join={onJoin} />}
    </main>
  );
}

function AliasLanding({ create, join, joinOpen, closeJoin, onJoin, error, navigate, profile }) {
  const name = getOrCreateDisplayName();
  return <main className="alias-landing">
    <Header navigate={navigate} right={<><SubscriptionBadge profile={profile} /><VersionBadge /><span className="badge live">Alias</span></>} />
    <section className="alias-hero wrap">
      <div className="landing-art alias-hero-art" />
      <span className="eyebrow">Alias онлайн для компании</span>
      <h1>Объясняйте слова, пока таймер горит</h1>
      <p>Команды, таймер, счёт и быстрые слова уже внутри. Открывайте комнату, делитесь кодом и играйте без карточек, ведущего и лишних переключателей.</p>
      <div className="actions">
        <button className="button primary" onClick={() => create(getOrCreateDisplayName(), 'alias')}>Начать Alias</button>
        <button className="button secondary join-button" onClick={join}>Войти по коду</button>
      </div>
      {error && <ErrorText text={error} />}
    </section>
    <LandingPlaybook game="alias" />
    <LandingAccessShowcase game="alias" navigate={navigate} profile={profile} />
    <section className="landing-cta wrap">
      <h2>Готовы объяснять?</h2>
      <p>Создайте комнату и зовите команды.</p>
      <button className="button primary full" onClick={() => create(getOrCreateDisplayName(), 'alias')}>Начать Alias</button>
    </section>
    {joinOpen && <JoinModal initialName={name} close={closeJoin} join={onJoin} error={error} />}
    <SeoLinks />
  </main>;
}

function BunkerLanding({ create, join, joinOpen, closeJoin, onJoin, error, navigate, profile }) {
  const name = getOrCreateDisplayName();
  return <main className="bunker-landing app-screen">
    <Header navigate={navigate} right={<><SubscriptionBadge profile={profile} /><VersionBadge /></>} />
    <section className="alias-hero bunker-hero wrap">
      <div className="landing-art bunker-hero-art" />
      <span className="eyebrow">Бункер онлайн</span>
      <h1>Кого пустят в убежище?</h1>
      <p>Катастрофа уже случилась. У каждого игрока есть профессия, здоровье, навык, багаж и тайный факт. Спорьте и выбирайте, кто нужен бункеру.</p>
      <div className="actions"><button className="button primary" onClick={() => create(name, 'bunker')}>Начать Бункер</button><button className="button secondary join-button" onClick={join}>Войти по коду</button></div>
      {error && <ErrorText text={error} />}
    </section>
    <LandingPlaybook game="bunker" />
    <LandingAccessShowcase game="bunker" navigate={navigate} profile={profile} />
    <section className="landing-cta wrap"><h2>Готовы спорить за место?</h2><p>Создайте комнату и начинайте отбор.</p><button className="button primary full" onClick={() => create(getOrCreateDisplayName(), 'bunker')}>Начать Бункер</button></section>
    {joinOpen && <JoinModal initialName={name} close={closeJoin} join={onJoin} error={error} />}
    <SeoLinks />
  </main>;
}

function VkStatus({ launch }) {
  const summary = vkSummary(launch);
  if (!summary) return null;
  return <section className="vk-status wrap"><b>VK Mini Apps</b><span>{summary.verified ? 'Запуск проверен' : 'VK-режим найден'} · {summary.platform || 'платформа не указана'}</span></section>;
}

function VkMiniAppPage({ navigate, vkLaunch }) {
  const summary = vkSummary(vkLaunch);
  return <main className="app-screen vk-page">
    <Header navigate={navigate} right={<span className="badge">VK</span>} />
    <section className="legal-hero wrap">
      <span className="eyebrow">VK Mini Apps</span>
      <h1>GameHubParty готовится к запуску во ВКонтакте</h1>
      <p>Эта страница нужна для проверки мини-приложения, модерации и будущей отдельной сборки под VK.</p>
      <button className="button primary full" onClick={() => navigate('spy')}>Открыть Шпиона</button>
    </section>
    <section className="section wrap">
      <h2>Статус запуска</h2>
      <div className="vk-checks">
        <article><b>HTTPS-домен</b><span>Для VK нужно указать адрес приложения, например vk.gamehubparty.ru.</span></article>
        <article><b>Параметры VK</b><span>{summary ? `Пользователь: ${summary.userId || 'не передан'}, платформа: ${summary.platform || 'не передана'}` : 'Откройте страницу из VK, чтобы увидеть launch-параметры.'}</span></article>
        <article><b>Проверка подписи</b><span>{summary?.verified ? 'Подпись проверена сервером.' : 'Подпись будет проверяться после добавления VK_APP_SECRET на сервер.'}</span></article>
      </div>
    </section>
    <section className="section wrap">
      <h2>Документы для модерации</h2>
      <div className="actions"><button className="button secondary" onClick={() => navigate('privacy')}>Политика конфиденциальности</button><button className="button secondary" onClick={() => navigate('terms')}>Пользовательское соглашение</button></div>
    </section>
  </main>;
}

function DemoPage({ navigate }) {
  const [status, setStatus] = useState(null);
  const [updatedAt] = useState(() => new Date().toLocaleString('ru-RU'));
  useEffect(() => {
    fetch('/api/status').then((response) => response.json()).then(setStatus).catch(() => setStatus({ ok: false }));
  }, []);
  return <main className="app-screen demo-page">
    <Header navigate={navigate} right={<VersionBadge />} />
    <section className="legal-hero wrap">
      <span className="eyebrow">Статус и обновления</span>
      <h1>GameHubParty v{APP_VERSION}</h1>
      <p>{APP_RELEASE_NAME}: актуальная версия от {APP_RELEASE_DATE}. Здесь собраны быстрые ссылки, состояние сервера и история визуальных обновлений.</p>
      <div className="actions"><button className="button primary" onClick={() => navigate('spy')}>Играть в Шпиона</button><button className="button secondary" onClick={() => navigate('store')}>Открыть магазин</button></div>
    </section>
    <section className="section wrap demo-status">
      <div className="section-title"><h2>Статус</h2><span className={`badge ${status?.ok ? 'live' : ''}`}>{status ? status.ok ? 'Онлайн' : 'Ошибка' : 'Проверяем'}</span></div>
      <div className="purchase-status-grid"><article><b>{status?.activeRooms ?? '...'}</b><span>активных комнат</span></article><article><b>{status?.games?.length ?? '...'}</b><span>игры в каталоге</span></article><article><b>v{APP_VERSION}</b><span>текущая версия</span></article><article><b>{updatedAt}</b><span>время открытия</span></article></div>
    </section>
    <section className="section wrap">
      <h2>Быстрый просмотр</h2>
      <div className="demo-links"><button onClick={() => navigate('home')}>Главная</button><button onClick={() => navigate('spy')}>Лендинг Шпиона</button><button onClick={() => navigate('store')}>Магазин</button><button onClick={() => navigate('profile')}>Профиль</button><button onClick={() => navigate('contacts')}>Контакты</button><button onClick={() => navigate('refund')}>Возвраты</button><button onClick={() => navigate('alias')}>Alias</button><button onClick={() => navigate('vk')}>VK-страница</button></div>
    </section>
    <section className="section wrap">
      <div className="section-title"><h2>История обновлений</h2><span>{screenshotFolders.length}</span></div>
      <div className="screenshot-folders">{screenshotFolders.map((folder) => <article className="screenshot-folder-card" key={folder.title}>
        <div className="screenshot-folder-head"><div><b>{folder.title}</b><p>{folder.description}</p></div><span>{folder.shots.length} скринов</span></div>
        <div className="screenshot-carousel">{folder.shots.map((shot) => <a key={shot.file} href={shot.file} target="_blank" rel="noreferrer"><img src={shot.file} alt={shot.title} loading="lazy" /><small>{shot.title}</small></a>)}</div>
      </article>)}</div>
      <p className="guest-name-note">Каждая папка содержит описание правок и скриншоты для проверки после релиза.</p>
    </section>
  </main>;
}

function LegalPage({ type, navigate }) {
  const pages = {
    privacy: {
      badge: 'Privacy',
      title: 'Политика конфиденциальности',
      lead: 'Как GameHubParty хранит и использует данные профилей, комнат, покупок и VK Mini Apps.',
      content: <PrivacyText />,
    },
    terms: {
      badge: 'Offer',
      title: 'Пользовательское соглашение и оферта',
      lead: 'Правила использования сайта, комнат, магазина и цифровых товаров GameHubParty.',
      content: <TermsText />,
    },
    contacts: {
      badge: 'Contacts',
      title: 'Контакты и реквизиты',
      lead: 'Куда писать по заказам, доступу, возвратам и вопросам подключения платежей.',
      content: <ContactsText />,
    },
    refund: {
      badge: 'Refund',
      title: 'Возвраты',
      lead: 'Условия возврата цифровых товаров, подписок и пропусков GameHubParty.',
      content: <RefundText />,
    },
  };
  const page = pages[type] || pages.terms;
  return <main className="app-screen legal-page">
    <Header navigate={navigate} right={<span className="badge">{page.badge}</span>} />
    <section className="legal-hero wrap">
      <span className="eyebrow">GameHubParty</span>
      <h1>{page.title}</h1>
      <p>{page.lead}</p>
      <div className="legal-nav">
        <button onClick={() => navigate('terms')}>Оферта</button>
        <button onClick={() => navigate('contacts')}>Контакты</button>
        <button onClick={() => navigate('refund')}>Возвраты</button>
        <button onClick={() => navigate('privacy')}>Политика</button>
      </div>
    </section>
    <section className="legal-content wrap">
      <LegalTrustStrip type={type} />
      {page.content}
    </section>
    <SeoLinks />
  </main>;
}

function LegalTrustStrip({ type }) {
  const cards = type === 'refund'
    ? [
      ['10 дней', 'срок рассмотрения заявки'],
      ['Email', 'support@gamehubparty.ru'],
      ['Цифровой доступ', 'словарь, PRO или пропуск'],
    ]
    : type === 'contacts'
      ? [
        ['Поддержка', 'заказы, доступ, возвраты'],
        ['Документы', 'оферта, политика, возвраты'],
        ['Реквизиты', 'самозанятый продавец указан'],
      ]
      : [
        ['Покупка', 'цена видна до заказа'],
        ['Выдача', 'автоматически в профиль'],
        ['Без карт', 'данные карты хранит провайдер'],
      ];
  return <div className="legal-trust-strip">{cards.map(([title, text]) => <article key={title}><b>{title}</b><span>{text}</span></article>)}</div>;
}

function PrivacyText() {
  return <><h2>1. Какие данные используются</h2><p>GameHubParty сохраняет технический идентификатор гостевого игрока, отображаемое имя, email-аккаунт, прогресс, историю игр, покупки и настройки комнат. Если сайт открыт внутри VK Mini Apps, дополнительно могут обрабатываться параметры запуска VK: идентификатор пользователя, платформа, язык и идентификатор приложения.</p><h2>2. Зачем это нужно</h2><p>Данные нужны, чтобы создавать комнаты, подключать игроков, сохранять профиль, восстанавливать покупки и защищать запуск мини-приложения от подмены.</p><h2>3. Где хранятся данные</h2><p>Часть данных хранится в браузере пользователя, часть — на сервере GameHubParty. Мы не продаём персональные данные и не передаём их третьим лицам, кроме случаев, необходимых для работы платформы, оплаты или требований закона.</p><h2>4. Платежи</h2><p>Оплата проходит через YooKassa. Платёжные данные банковской карты обрабатывает платёжный провайдер, а GameHubParty хранит номер заказа, сумму, статус оплаты, тариф и срок действия доступа.</p><h2>5. Связь</h2><p>По вопросам удаления данных, доступа к профилю или поддержки можно написать владельцу сервиса через контакт, указанный в карточке приложения VK или на сайте.</p></>;
}

function TermsText() {
  return <><h2>1. Назначение сервиса</h2><p>GameHubParty — онлайн-сервис для запуска игр в дружеских компаниях без подготовки. Пользователь может создавать комнаты, подключаться по коду или QR, играть в доступные игры и покупать цифровые материалы внутри сервиса.</p><h2>2. Что продается</h2><p>В магазине размещаются цифровые товары и услуги: WeekendPass на 24 часа, Game Pass для отдельной игры, PRO-доступ ко всем играм и отдельная косметика. У каждого товара на странице магазина указаны название, описание, цена, состав доступа и срок действия.</p><h2>3. Цена и оплата</h2><p>Цена показывается до оформления заказа в рублях. Оплата проходит через защищенную платежную форму YooKassa. GameHubParty не хранит данные банковских карт; на стороне сервиса сохраняются номер заказа, выбранный товар, сумма, статус оплаты и выданный доступ.</p><h2>4. Получение цифрового заказа</h2><p>После успешной оплаты заказ получает статус "paid", а цифровой доступ автоматически появляется в профиле игрока: подписка, Game Pass или WeekendPass активируют доступ на срок товара, а косметика открывается в профиле. Физическая доставка не требуется.</p><h2>5. Возвраты</h2><p>Возвраты обрабатываются по правилам страницы "Возвраты". Пользователь может написать на support@gamehubparty.ru и указать номер заказа, email или идентификатор профиля. Если доступ не был использован, был выдан ошибочно, продублирован или не работает по технической причине, заявка рассматривается индивидуально.</p><h2>6. Профиль и поведение</h2><p>Гостевой профиль создается автоматически. Пользователь отвечает за корректность имени и поведение в комнате. Запрещено использовать сервис для оскорблений, спама, незаконного контента, попыток нарушить работу сайта или получить платный доступ без оплаты.</p><h2>7. Технические изменения</h2><p>Сервис предоставляется как онлайн-инструмент для развлечения. Возможны технические перерывы, обновления, изменение правил игр, наборов, тарифов и состава функций. Уже оплаченный доступ сохраняется в рамках условий конкретного товара.</p><h2>8. Связь с поддержкой</h2><p>По вопросам заказов, доступа, возвратов и удаления данных пишите на support@gamehubparty.ru. Актуальные контакты и реквизиты размещены на странице "Контакты и реквизиты".</p></>;
}

function ContactsText() {
  return <><div className="legal-note premium-legal-note"><b>Продавец цифровых товаров</b><span>GameHubParty продает цифровой доступ внутри сервиса. Покупки выдаются в профиль игрока автоматически после подтверждения оплаты.</span></div><h2>Поддержка покупателей</h2><p>По вопросам заказа, доступа к цифровым товарам, возврата или работы игры напишите на support@gamehubparty.ru. В обращении укажите номер заказа, email, имя в профиле или примерное время покупки.</p><div className="legal-card-grid polished"><article><b>Сайт</b><span>https://gamehubparty.ru</span></article><article><b>Email поддержки</b><span>support@gamehubparty.ru</span></article><article><b>Формат товаров</b><span>Цифровой доступ внутри GameHubParty</span></article><article><b>Выдача заказа</b><span>Автоматически в профиль после успешной оплаты</span></article></div><h2>Реквизиты продавца</h2><p>Сведения о продавце для покупателей, платежной модерации и обращений по заказам:</p><dl className="requisites-list"><div><dt>Продавец</dt><dd>Сафонов Денис Алексеевич, самозанятый</dd></div><div><dt>ИНН</dt><dd>503227354282</dd></div><div><dt>Адрес</dt><dd>Москва, Дубосековская 13</dd></div><div><dt>Email для документов</dt><dd>support@gamehubparty.ru</dd></div></dl><h2>Документы</h2><p>Условия покупки описаны в пользовательском соглашении и оферте. Возвраты описаны на отдельной странице "Возвраты". Политика обработки данных размещена на странице "Политика конфиденциальности".</p></>;
}

function RefundText() {
  return <><h2>1. Что можно вернуть</h2><p>GameHubParty продает цифровой доступ внутри сервиса: WeekendPass, Game Pass, PRO и отдельную косметику. Возврат возможен, если доступ не был использован, покупка продублировалась, товар был выдан ошибочно или сервисная ошибка не позволяет воспользоваться покупкой.</p><h2>2. Когда возврат обычно невозможен</h2><p>Если цифровой доступ уже активирован и использован в игре, возврат может быть невозможен, кроме случаев технической неисправности или требований закона. Каждая заявка рассматривается отдельно.</p><h2>3. Как запросить возврат</h2><p>Напишите на support@gamehubparty.ru и укажите номер заказа, сумму, email или идентификатор профиля, дату покупки и причину обращения. Если проблема техническая, приложите скриншот или краткое описание, что не работает.</p><h2>4. Срок рассмотрения</h2><p>Заявка рассматривается до 10 календарных дней. Если возврат одобрен, деньги возвращаются тем же способом, которым был оплачен заказ, с учетом сроков банка или платежного провайдера.</p><h2>5. Если доступ не появился</h2><p>Сначала напишите в поддержку: в большинстве случаев доступ можно восстановить по номеру заказа или профилю. Если восстановить покупку не получится, заявка будет обработана как возврат или повторная выдача доступа.</p></>;
}

function JoinModal({ initialName, close, join }) {
  const [code, setCode] = useState(new URLSearchParams(location.search).get('room') || '');
  const [error, setError] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    try { await join({ code, name: initialName }); } catch (nextError) { setError(nextError.message); }
  };
  return <div className="backdrop" onMouseDown={close}><section className="modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><div><h2>Войти в комнату</h2><p>Введите код или отсканируйте QR приглашения</p></div><button className="close" onClick={close}>×</button></div><form onSubmit={submit}><label>Код комнаты<input className="code" inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000 000" autoFocus /></label><button type="button" className="button secondary full qr-entry" onClick={() => setScannerOpen(true)}><ScanIcon />Войти по QR-коду</button><p className="guest-name-note">Вы войдёте как <b>{initialName}</b>. Имя можно изменить в лобби.</p>{error && <ErrorText text={error} />}<button className="button primary full" disabled={code.length !== 6}>Войти</button></form>{scannerOpen && <QrScanner close={() => setScannerOpen(false)} onCode={(nextCode) => { setCode(nextCode); setScannerOpen(false); }} />}</section></div>;
}

function ScanIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4M8 8h3v3H8zm5 0h3v3h-3zm-5 5h3v3H8zm5 0h3v3h-3z" /></svg>;
}

function QrScanner({ close, onCode }) {
  const [message, setMessage] = useState('Разрешите доступ к камере и наведите её на QR-код комнаты.');
  const videoRef = useMemo(() => ({ current: null }), []);
  useEffect(() => {
    let stream;
    let timer;
    const start = async () => {
      if (!('BarcodeDetector' in window)) return setMessage('Этот браузер пока не умеет сканировать QR. Откройте камеру телефона или введите код комнаты.');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        videoRef.current.srcObject = stream;
        const detector = new BarcodeDetector({ formats: ['qr_code'] });
        timer = setInterval(async () => {
          const codes = await detector.detect(videoRef.current).catch(() => []);
          const value = codes[0]?.rawValue || '';
          const roomCode = new URL(value, location.origin).searchParams.get('room') || value.match(/\d{6}/)?.[0];
          if (roomCode) onCode(roomCode);
        }, 400);
      } catch {
        setMessage('Не удалось открыть камеру. Проверьте разрешение или введите код комнаты.');
      }
    };
    start();
    return () => { clearInterval(timer); stream?.getTracks().forEach((track) => track.stop()); };
  }, [onCode]);
  return <div className="scanner-panel"><video ref={videoRef} autoPlay playsInline muted /><p>{message}</p><button type="button" className="button secondary full" onClick={close}>Вернуться к коду</button></div>;
}

function SeoLinks() {
  return <footer className="seo-links wrap"><b>Игры для компании</b><nav><a href="/games/spy">Шпион онлайн</a><a href="/games/alias">Alias онлайн</a><a href="/">Все игры</a><a href="/store">Магазин</a><a href="/demo">Статус</a><a href="/vk">VK Mini Apps</a><a href="/contacts">Контакты</a><a href="/refund">Возвраты</a><a href="/privacy">Политика</a><a href="/terms">Оферта</a></nav><span className="site-version">GameHubParty v{APP_VERSION}</span></footer>;
}

function Lobby({ room, me, isHost, catalog, profile, action, leave, navigate, error }) {
  const [qr, setQr] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nextName, setNextName] = useState(me.name);
  const [rulesOpen, setRulesOpen] = useState(() => localStore.getItem('gamehubparty_spy_rules_seen') !== 'yes');
  const [adBreak, setAdBreak] = useState(null);
  const inviteUrl = `${location.origin}${location.pathname}?room=${room.code}`;
  useEffect(() => { QRCode.toDataURL(inviteUrl, { width: 240, margin: 1 }).then(setQr); }, [inviteUrl]);
  const onlinePlayers = room.players.filter((player) => player.online);
  const gameTitle = room.gameId === 'alias' ? 'Alias' : room.gameId === 'bunker' ? 'Бункер' : 'Шпион';
  const minPlayers = room.gameId === 'alias' || room.gameId === 'bunker' ? 4 : 3;
  const canStart = onlinePlayers.length >= minPlayers && onlinePlayers.every((player) => player.ready);
  const closeRules = () => {
    localStore.setItem('gamehubparty_spy_rules_seen', 'yes');
    setRulesOpen(false);
  };
  const startRound = () => {
    if (room.adPolicy?.enabled) {
      const slot = room.gameId === 'alias' ? 'alias_pre_round_interstitial' : room.gameId === 'bunker' ? 'bunker_pre_round_interstitial' : 'spy_pre_round_interstitial';
      setAdBreak({ placement: 'pre_round', slot, seconds: 5, continueLabel: 'Начать раунд', onContinue: () => action('start_round') });
      return;
    }
    action('start_round');
  };

  return <main className={`room-theme-${room.themeId || 'ghp'}`}><Header navigate={navigate} gameTitle={gameTitle} brandTheme={room.themeId || 'ghp'} right={<span className="badge">{isHost ? 'Хост' : 'Игрок'}</span>} /><div className="lobby wrap"><section className="invite"><span>Код комнаты</span><strong>{room.code.slice(0, 3)} {room.code.slice(3)}</strong><div className="inline"><button className="button small secondary" onClick={() => navigator.clipboard?.writeText(inviteUrl)}>Скопировать ссылку</button><button className="button small secondary" onClick={() => navigator.share?.({ title: `Игра ${gameTitle}`, url: inviteUrl })}>Поделиться</button></div>{qr && <details><summary>Показать QR-код</summary><img className="qr-image" src={qr} alt="QR-код комнаты" /></details>}</section><LobbyPlayerAdBanner adPolicy={room.adPolicy} navigate={navigate} />{isHost ? <HostSettings room={room} catalog={catalog || {}} dictionaries={catalog?.dictionaries || []} themes={catalog?.themes || roomThemesFallback} profile={profile} action={action} /> : <LobbyGameSummary room={room} catalog={catalog || {}} dictionaries={catalog?.dictionaries || []} themes={catalog?.themes || roomThemesFallback} profile={profile} action={action} />}<AdStatusCard adPolicy={room.adPolicy} navigate={navigate} /><section className="section"><div className="section-title"><h2>Игроки</h2><span>{onlinePlayers.length} онлайн</span></div><button className="my-profile" onClick={() => setEditingName(true)}><i>{me.name[0]?.toUpperCase()}</i><span><b>{me.name}</b><small>Нажмите, чтобы изменить имя</small></span></button><ul className="players">{room.players.filter((player) => player.id !== me.id).map((player) => <li key={player.id}><i>{player.name[0]?.toUpperCase()}</i><span>{player.name}{player.id === room.hostId ? ' · хост' : ''}</span><small className={player.ready ? 'ready' : ''}>{!player.online ? 'Не в сети' : player.ready ? 'Готов' : 'Не готов'}</small></li>)}</ul></section><button className="button secondary full" onClick={() => setRulesOpen(true)}>Как играть</button>{room.gameId === 'alias' ? <AliasScoreLine scores={room.scores} /> : room.gameId === 'bunker' ? <BunkerScoreLine room={room} /> : <div className="score-line"><span>Мирные: {room.scores.civilians}</span><span>Шпионы: {room.scores.spies}</span></div>}{error && <ErrorText text={error} />}{isHost ? <button className="button primary full sticky" disabled={!canStart} onClick={startRound}>{canStart ? 'Начать раунд' : onlinePlayers.length < minPlayers ? `Нужно минимум ${minPlayers} игрока онлайн` : 'Ждём готовности игроков'}</button> : <button className={`button full sticky ${me.ready ? 'secondary' : 'primary'}`} onClick={() => action('set_ready', { ready: !me.ready })}>{me.ready ? 'Я не готов' : 'Я готов'}</button>}<button className="link danger leave" onClick={leave}>Выйти из комнаты</button></div>{editingName && <NameModal value={nextName} setValue={setNextName} close={() => setEditingName(false)} save={async () => { const result = await action('rename_player', { name: nextName }); saveGuestDisplayName(result.name); setNextName(result.name); setEditingName(false); }} />}{rulesOpen && (room.gameId === 'alias' ? <AliasRulesModal close={closeRules} /> : room.gameId === 'bunker' ? <BunkerRulesModal close={closeRules} /> : <RulesModal close={closeRules} />)}{adBreak && <AdBreakModal {...adBreak} close={() => setAdBreak(null)} />}</main>;
}

function LobbyPlayerAdBanner({ adPolicy, navigate }) {
  if (!adPolicy?.enabled) return null;
  return <section className="lobby-ad-banner" data-ad-slot="lobby_player_banner">
    <div><span>Free-комната</span><b>Короткая пауза перед стартом</b><p>Во время роли, таймера и голосования рекламы не будет. WeekendPass, Game Pass или PRO отключит паузы для всей комнаты.</p></div>
    <AdsterraBanner unit="mobile320x50" slot="lobby_player_banner" />
    <button className="button small secondary" onClick={() => navigate('store')}>Убрать рекламу</button>
  </section>;
}

function AdStatusCard({ adPolicy, navigate }) {
  if (adPolicy?.adFree) {
    return <section className="ad-status-card ad-free"><span>Без рекламы</span><b>{adPolicy.sponsorName || 'PRO-игрок'} убрал рекламу для всей комнаты</b><p>Раунд начнется сразу, без рекламной паузы.</p></section>;
  }
  return <section className="ad-status-card"><span>Free-режим</span><b>Паузы можно убрать для всех</b><p>Игра не прерывается во время роли, таймера и голосования. WeekendPass или PRO убирает короткие паузы у всей комнаты.</p><button className="button small secondary" onClick={() => navigate('store')}>Убрать паузы</button></section>;
}

function AdBreakModal({ placement, slot = 'internal_ad_slot', seconds = 5, continueLabel = 'Продолжить', onContinue, close }) {
  const [secondsLeft, setSecondsLeft] = useState(seconds);
  useEffect(() => {
    const timer = setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, []);
  const title = placement === 'post_round' ? 'Короткая пауза между раундами' : 'Короткая пауза перед стартом';
  const continueGame = async () => {
    await onContinue?.();
    close();
  };
  return <div className="backdrop ad-break-backdrop" onMouseDown={close}><section className="modal ad-break-modal" onMouseDown={(event) => event.stopPropagation()}><span className="eyebrow">Рекламная пауза</span><h2>{title}</h2><AdsterraBanner unit="rectangle300x250" slot={slot} /><p>В активной игре рекламы нет. WeekendPass, Game Pass или PRO отключит такие паузы для всей комнаты.</p><button className="button primary full" disabled={secondsLeft > 0} onClick={continueGame}>{secondsLeft > 0 ? `Начнём через ${secondsLeft}` : continueLabel}</button><button className="button secondary full" onClick={close}>Вернуться без старта</button></section></div>;
}

const adsterraUnits = {
  mobile320x50: {
    key: 'd5c1fe703354df9437609dcf4bea1ac7',
    width: 320,
    height: 50,
    src: 'https://www.highperformanceformat.com/d5c1fe703354df9437609dcf4bea1ac7/invoke.js',
  },
  rectangle300x250: {
    key: '464f545a84d6f512006bbbae88f7450a',
    width: 300,
    height: 250,
    src: 'https://www.highperformanceformat.com/464f545a84d6f512006bbbae88f7450a/invoke.js',
  },
};

function AdsterraBanner({ unit, slot }) {
  const [status, setStatus] = useState('loading');
  const containerRef = useRef(null);
  const config = adsterraUnits[unit] || adsterraUnits.mobile320x50;
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    setStatus('loading');
    container.innerHTML = '';
    const frame = document.createElement('iframe');
    frame.title = `Adsterra ${slot}`;
    frame.width = String(config.width);
    frame.height = String(config.height);
    frame.scrolling = 'no';
    frame.className = 'adsterra-host-frame';
    container.append(frame);
    const doc = frame.contentWindow?.document;
    if (!doc) {
      setStatus('failed');
      return undefined;
    }
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><style>html,body{width:${config.width}px;height:${config.height}px;margin:0;overflow:hidden;background:transparent}</style></head><body><script type="text/javascript">atOptions=${JSON.stringify({
      key: config.key,
      format: 'iframe',
      height: config.height,
      width: config.width,
      params: {},
    })};</script><script type="text/javascript" src="${config.src}"></script></body></html>`);
    doc.close();
    const hasCreative = () => {
      const body = frame.contentWindow?.document?.body;
      if (!body) return false;
      return Boolean(body.querySelector('iframe, ins, a, img, object, embed')) || body.children.length > 2;
    };
    const interval = window.setInterval(() => {
      if (hasCreative()) {
        setStatus('loaded');
        window.clearInterval(interval);
      }
    }, 500);
    const timeout = window.setTimeout(() => {
      setStatus((current) => (current === 'loading' && !hasCreative() ? 'failed' : current));
      window.clearInterval(interval);
    }, 10000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
      container.innerHTML = '';
    };
  }, [config.height, config.key, config.src, config.width, slot]);
  return <div className={`adsterra-ad adsterra-${unit} ${status === 'loaded' ? 'adsterra-loaded' : ''}`} style={{ '--ad-width': `${config.width}px`, '--ad-height': `${config.height}px` }} data-ad-slot={slot}>
    <div ref={containerRef} className="adsterra-script-slot" aria-label={`Adsterra ${slot}`} />
    {status === 'failed' && <span className="adsterra-fallback">Реклама не загрузилась</span>}
  </div>;
}

function NameModal({ value, setValue, close, save }) {
  return <div className="backdrop" onMouseDown={close}><section className="modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><div><h2>Изменить имя</h2><p>Это имя увидят остальные игроки.</p></div><button className="close" onClick={close}>×</button></div><label>Ваше имя<input value={value} maxLength={24} onChange={(event) => setValue(event.target.value)} autoFocus /></label><button className="button primary full name-save" disabled={!value.trim()} onClick={save}>Сохранить</button></section></div>;
}

function HostSettings({ room, catalog = {}, dictionaries, themes = roomThemesFallback, profile, action }) {
  const update = (patch) => action('update_settings', { settings: patch });
  const changeGame = (gameId) => {
    if (gameId !== room.gameId) action('change_game', { gameId });
  };
  const themeSettings = <details className="settings-group room-theme-settings"><summary><span>Тема комнаты</span><small>{getRoomThemeName(room.themeId || 'ghp', themes)}</small></summary><RoomThemePanel room={room} themes={themes} profile={profile} action={action} isHost /></details>;
  if (room.gameId === 'alias') return <AliasHostSettings room={room} catalog={catalog} profile={profile} update={update} changeGame={changeGame} themeSettings={themeSettings} />;
  if (room.gameId === 'bunker') return <BunkerHostSettings room={room} catalog={catalog} profile={profile} update={update} changeGame={changeGame} themeSettings={themeSettings} />;
  const fullSpyAccess = hasTimedGameAccess(profile, 'spy');
  const owned = new Set(fullSpyAccess ? dictionaries.map((dictionary) => dictionary.id) : [...(profile?.ownedDictionaryIds || ['base']), ...dictionaries.filter((dictionary) => dictionary.free).map((dictionary) => dictionary.id)]);
  const subjectType = room.settings.subjectType || 'location';
  const copy = spySubjectCopy(subjectType);
  const visibleDictionaries = dictionaries.filter((dictionary) => (dictionary.subjectType || 'location') === subjectType);
  const toggleDictionary = (id) => {
    if (!owned.has(id)) return;
    const selected = room.settings.dictionaryIds.includes(id);
    const dictionaryIds = selected ? room.settings.dictionaryIds.filter((item) => item !== id) : [...room.settings.dictionaryIds, id];
    if (dictionaryIds.length) update({ dictionaryIds });
  };
  return <section className="section settings host-control-panel"><h2>Панель хоста</h2><GameSwitcher gameId={room.gameId || 'spy'} changeGame={changeGame} /><details className="settings-group" open><summary><span>Настройки раунда</span><small>{spyModeNames[room.settings.mode] || 'Классический'} · {room.settings.roundSeconds / 60} мин</small></summary><AdvancedSpySettings room={room} action={action} profile={profile} /><SpyModeTip subjectType={subjectType} /><Setting label="Время раунда"><select value={room.settings.roundSeconds} onChange={(event) => update({ roundSeconds: Number(event.target.value) })}><option value="300">5 минут</option><option value="480">8 минут</option><option value="600">10 минут</option></select></Setting><Setting label="Голосование"><select value={room.settings.votingSeconds} onChange={(event) => update({ votingSeconds: Number(event.target.value) })}><option value="20">20 секунд</option><option value="30">30 секунд</option><option value="45">45 секунд</option><option value="60">60 секунд</option></select></Setting><Setting label="Очков для победы"><Counter value={room.settings.targetScore} min={3} max={10} change={(targetScore) => update({ targetScore })} /></Setting><Setting label="Текущий режим"><b>{spyModeNames[room.settings.mode] || 'Классический'}</b></Setting></details><details className="settings-group"><summary><span>{copy.dictionaryTitle}</span><small>{room.settings.dictionaryIds.length} выбрано</small></summary><div className="dictionary-checklist">{visibleDictionaries.map((dictionary) => <label key={dictionary.id} className={!owned.has(dictionary.id) ? 'locked' : ''}><input type="checkbox" checked={room.settings.dictionaryIds.includes(dictionary.id)} disabled={!owned.has(dictionary.id)} onChange={() => toggleDictionary(dictionary.id)} /><span><b>{dictionary.name}</b><small>{dictionaryCount(dictionary)} · {owned.has(dictionary.id) ? 'доступен' : 'в магазине'}</small></span></label>)}</div>{subjectType === 'location' && profile?.customLocations?.length > 0 && <p className="settings-note">Ваши собственные локации тоже попадут в раунд автоматически.</p>}</details>{themeSettings}</section>;
}

function GameSwitcher({ gameId, changeGame }) {
  return <Setting label="Игра"><select value={gameId} onChange={(event) => changeGame(event.target.value)}><option value="spy">Шпион</option><option value="alias">Alias</option><option value="bunker">Бункер</option></select></Setting>;
}

function BunkerHostSettings({ room, catalog = {}, profile, update, changeGame, themeSettings }) {
  const revealMode = room.settings.revealMode || 'private_table';
  const packs = catalog.bunkerContentPacks?.length ? catalog.bunkerContentPacks : bunkerContentPackOptions.map((pack) => ({ ...pack, tier: pack.id === 'classic' ? 'free' : 'premium' }));
  const hasAccess = hasRoomContentAccess(profile, 'bunker');
  return <section className="section settings alias-host-panel bunker-host-panel"><h2>Бункер</h2><GameSwitcher gameId={room.gameId} changeGame={changeGame} /><details className="settings-group" open><summary><span>Настройки раунда</span><small>{room.settings.roundSeconds / 60} мин · {room.settings.votingSeconds} сек</small></summary><Setting label="Режим вскрытия"><select value={revealMode} onChange={(event) => update({ revealMode: event.target.value })}><option value="private_table">Личная карточка на стол</option><option value="public_turns">Вскрытие по очереди</option></select></Setting><Setting label="Набор событий"><select value={room.settings.contentPackId || 'classic'} onChange={(event) => update({ contentPackId: event.target.value })}>{packs.map((pack) => { const locked = pack.tier !== 'free' && !pack.free && !hasAccess; return <option key={pack.id} value={pack.id} disabled={locked}>{pack.name} · {locked ? 'Bunker Pass' : pack.badge || (pack.tier === 'free' ? 'включён' : 'открыт')}</option>; })}</select></Setting><Setting label="Обсуждение"><select value={room.settings.roundSeconds} onChange={(event) => update({ roundSeconds: Number(event.target.value) })}><option value="180">3 минуты</option><option value="300">5 минут</option><option value="420">7 минут</option></select></Setting><Setting label="Голосование"><select value={room.settings.votingSeconds} onChange={(event) => update({ votingSeconds: Number(event.target.value) })}><option value="30">30 секунд</option><option value="45">45 секунд</option><option value="60">60 секунд</option></select></Setting><p className="settings-note">{revealMode === 'public_turns' ? 'Игроки по очереди вскрывают выбранные поля. Все видят, что раскрыто, а что оставлено скрытым.' : 'Игрок решает, какие поля показать компании со своего телефона.'}</p>{!hasAccess && <p className="settings-note">Bunker Pass, WeekendPass или PRO откроет дополнительные сценарии катастроф и тематические паки.</p>}</details>{themeSettings}</section>;
}

function AliasHostSettings({ room, catalog = {}, profile, update, changeGame, themeSettings }) {
  const teams = buildAliasPreviewTeams(room.players.filter((player) => player.online));
  const aliasDictionaries = catalog.aliasDictionaries?.length ? catalog.aliasDictionaries : [{ id: 'everyday', name: 'На каждый день', free: true, wordCount: 96 }, { id: 'party', name: 'Для вечеринки', free: true, wordCount: 64 }];
  const hasAccess = hasRoomContentAccess(profile, 'alias');
  const owned = new Set(aliasDictionaries.filter((dictionary) => dictionary.free || hasAccess).map((dictionary) => dictionary.id));
  const selectedIds = room.settings.dictionaryIds?.length ? room.settings.dictionaryIds : ['everyday'];
  const toggleDictionary = (id) => {
    if (!owned.has(id)) return;
    const nextIds = selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id];
    if (nextIds.length) update({ dictionaryIds: nextIds });
  };
  return <section className="section settings alias-host-panel"><h2>Alias</h2><GameSwitcher gameId={room.gameId} changeGame={changeGame} /><details className="settings-group" open><summary><span>Настройки раунда</span><small>{room.settings.roundSeconds} сек · до {room.settings.targetScore}</small></summary><Setting label="Ход"><select value={room.settings.roundSeconds} onChange={(event) => update({ roundSeconds: Number(event.target.value) })}><option value="60">60 секунд</option><option value="90">90 секунд</option><option value="120">120 секунд</option></select></Setting><Setting label="Победа"><Counter value={room.settings.targetScore} min={10} max={50} change={(targetScore) => update({ targetScore })} /></Setting></details><details className="settings-group"><summary><span>Словари Alias</span><small>{selectedIds.length} выбрано</small></summary><div className="dictionary-checklist">{aliasDictionaries.map((dictionary) => <label key={dictionary.id} className={!owned.has(dictionary.id) ? 'locked' : ''}><input type="checkbox" checked={selectedIds.includes(dictionary.id)} disabled={!owned.has(dictionary.id)} onChange={() => toggleDictionary(dictionary.id)} /><span><b>{dictionary.name}</b><small>{dictionary.wordCount || 0} слов · {owned.has(dictionary.id) ? 'доступен' : 'Alias Pass'}</small></span></label>)}</div>{!hasAccess && <p className="settings-note">Alias Pass, WeekendPass или PRO откроет кино, мемы, 18+ и семейные наборы.</p>}</details><div className="alias-team-preview">{teams.map((team) => <article key={team.id}><b>{team.name}</b><span>{team.players.map((player) => player.name).join(', ') || 'Ждём игроков'}</span></article>)}</div>{themeSettings}</section>;
}

function buildAliasPreviewTeams(players) {
  return [
    { id: 'team_1', name: 'Команда 1', players: players.filter((_, index) => index % 2 === 0) },
    { id: 'team_2', name: 'Команда 2', players: players.filter((_, index) => index % 2 === 1) },
  ];
}

function LobbyGameSummary({ room, dictionaries, themes = roomThemesFallback, profile, action }) {
  const themeSummary = <details className="settings-group room-theme-settings lobby-theme-summary"><summary><span>Тема комнаты</span><small>{getRoomThemeName(room.themeId || 'ghp', themes)}</small></summary><RoomThemePanel room={room} themes={themes} profile={profile} action={action} /></details>;
  if (room.gameId === 'alias') {
    return <section className="lobby-game-summary alias-summary"><span>Выбрана игра</span><h2>Alias</h2><p>{room.settings.roundSeconds} секунд · до {room.settings.targetScore} очков</p><small>Команды соберутся автоматически перед первым ходом.</small>{themeSummary}</section>;
  }
  if (room.gameId === 'bunker') {
    return <section className="lobby-game-summary alias-summary bunker-summary"><span>Выбрана игра</span><h2>Бункер</h2><p>{room.settings.roundSeconds / 60} минут на спор · {room.settings.votingSeconds} секунд на голосование</p><small>{bunkerRevealModeNames[room.settings.revealMode] || bunkerRevealModeNames.private_table}. Перед стартом все примут короткие правила.</small>{themeSummary}</section>;
  }
  const subjectType = room.settings.subjectType || 'location';
  const copy = spySubjectCopy(subjectType);
  const names = dictionaries.filter((dictionary) => room.settings.dictionaryIds.includes(dictionary.id)).map((dictionary) => dictionary.name).join(', ');
  return <section className="lobby-game-summary"><span>Выбрана игра</span><h2>Шпион</h2><p>{copy.typeValue} · {room.settings.roundSeconds / 60} минут · {spyModeNames[room.settings.mode] || 'Классический'}</p><small>{copy.dictionaryTitle}: {names || copy.defaultDictionary}</small>{themeSummary}</section>;
}

function RoomThemePanel({ room, themes = roomThemesFallback, profile, action, isHost = false }) {
  const owned = getOwnedThemeSet(profile);
  const currentThemeId = room.themeId || 'ghp';
  const suggestions = room.themeSuggestions || [];
  return <div className={`room-theme-panel ${isHost ? 'host-theme-panel' : ''}`}><div className="room-theme-title"><span>Тема комнаты</span><b>{getRoomThemeName(currentThemeId, themes)}</b></div><div className="room-theme-grid">{themes.map((theme) => {
    const isCurrent = theme.id === currentThemeId;
    const isOwned = owned.has(theme.id) || theme.free;
    const actionName = isHost ? 'apply_room_theme' : 'suggest_room_theme';
    return <button key={theme.id} className={`room-theme-card ${theme.id === 'partyhub' ? 'partyhub-theme-card' : 'ghp-theme-card'} ${isCurrent ? 'active' : ''}`} disabled={isCurrent || !isOwned} onClick={() => action(actionName, { themeId: theme.id })}><i>{theme.id === 'partyhub' ? <><span>Party</span><mark>Hub</mark></> : <><span>G</span><span>H</span><span>P</span></>}</i><strong>{theme.name}</strong><small>{isCurrent ? 'Активна' : isOwned ? isHost ? 'Применить' : 'Предложить' : `${theme.priceRub || 0} ₽ в магазине`}</small></button>;
  })}</div>{isHost && suggestions.length > 0 && <div className="theme-suggestions"><b>Предложения игроков</b>{suggestions.map((suggestion) => <button key={`${suggestion.playerId}-${suggestion.themeId}`} onClick={() => action('accept_room_theme', { playerId: suggestion.playerId, themeId: suggestion.themeId })}><span>{suggestion.playerName} предлагает {getRoomThemeName(suggestion.themeId, themes)}</span><strong>Принять</strong></button>)}</div>}</div>;
}

function SpyModeTip({ subjectType }) {
  const copy = spySubjectCopy(subjectType);
  return <div className={`mode-tip ${subjectType === 'item' ? 'item-tip' : ''}`}><b>{copy.modeTipTitle}</b><span>{copy.modeTip}</span></div>;
}

function Game({ room, me, isHost, card, revealRole, action, leave, navigate, catalog, now, error }) {
  const round = room.round;
  if (room.gameId === 'alias') return <AliasGame room={room} isHost={isHost} action={action} leave={leave} navigate={navigate} now={now} error={error} />;
  if (room.gameId === 'bunker') return <BunkerGame room={room} me={me} isHost={isHost} card={card} revealRole={revealRole} action={action} leave={leave} navigate={navigate} now={now} error={error} />;
  if (round.phase === 'role_reveal') return <RoleReveal room={room} card={card} revealRole={revealRole} action={action} isHost={isHost} navigate={navigate} error={error} />;
  if (round.phase === 'discussion') return <Discussion room={room} card={card} action={action} navigate={navigate} now={now} error={error} />;
  if (round.phase === 'guess_review') return <GuessReview room={room} me={me} isHost={isHost} action={action} navigate={navigate} now={now} error={error} />;
  if (round.phase === 'voting') return <Voting room={room} me={me} isHost={isHost} action={action} navigate={navigate} now={now} error={error} />;
  return <Result room={room} isHost={isHost} action={action} leave={leave} navigate={navigate} />;
}

function bunkerContestants(room) {
  const eliminated = new Set(room.round?.eliminatedIds || []);
  return room.players.filter((player) => player.online && !eliminated.has(player.id));
}

function bunkerShelterArtClass(shelter = '') {
  const text = shelter.toLowerCase();
  if (/санатор|медблок|теплиц|библиотек/.test(text)) return 'shelter-sanatorium';
  if (/метро|лаборатор|мастерск|инструмент/.test(text)) return 'shelter-metro-lab';
  if (/военн|склад|горах|оруж|сухпай|генератор/.test(text)) return 'shelter-military-depot';
  if (/подземн.*дом|кухн|спортзал|кинозал|оранжер|дворецк/.test(text)) return 'shelter-underground-home';
  if (/погреб|семена|скважин|радиостанц|жилые отсек/.test(text)) return 'shelter-rural-cellar';
  if (/колониаль|модуль|гидропоник|медкапсул|кислород/.test(text)) return 'shelter-space-module';
  if (/корабль|ковчег|криосон|автопилот|ремонтный отсек/.test(text)) return 'shelter-ark-ship';
  if (/дамб|фильтр|топлив/.test(text)) return 'shelter-dam-node';
  if (/караван|радиомаяк|соседн|база/.test(text)) return 'shelter-caravan-bunker';
  return 'shelter-default';
}

function BunkerGame({ room, me, isHost, card, revealRole, action, leave, navigate, now, error }) {
  if (room.round?.phase === 'briefing') return <BunkerBriefing room={room} action={action} navigate={navigate} error={error} />;
  if (room.round?.phase === 'public_reveal') return <BunkerPublicReveal room={room} me={me} card={card} revealRole={revealRole} action={action} navigate={navigate} error={error} />;
  if (room.round?.phase === 'role_reveal') return <BunkerReveal room={room} card={card} revealRole={revealRole} action={action} navigate={navigate} error={error} />;
  if (room.round?.phase === 'discussion') return <BunkerDiscussion room={room} card={card} navigate={navigate} now={now} error={error} />;
  if (room.round?.phase === 'voting') return <BunkerVoting room={room} me={me} action={action} navigate={navigate} now={now} error={error} />;
  return <BunkerResult room={room} isHost={isHost} action={action} leave={leave} navigate={navigate} />;
}

function BunkerBriefing({ room, action, navigate, error }) {
  const revealMode = room.settings.revealMode || 'private_table';
  const accepted = room.round.acceptedRulesCount || 0;
  const total = bunkerContestants(room).length;
  return <main className={`game bunker-game room-theme-${room.themeId || 'ghp'}`}><Header navigate={navigate} gameTitle="Бункер" brandTheme={room.themeId || 'ghp'} right={<span className="badge">Правила</span>} /><section className="role bunker-briefing"><span className="eyebrow">Перед стартом</span><h1>{revealMode === 'public_turns' ? 'Вскрываемся по очереди' : 'Карточка остаётся у игрока'}</h1><p>{revealMode === 'public_turns' ? 'Когда придёт ваша очередь, выберите поля, которые готовы открыть. Все увидят раскрытые значения на своих телефонах, а закрытые поля останутся скрытыми.' : 'Откройте личную карточку, нажимайте на поля, чтобы показать или скрыть их на своём экране. Можно положить телефон на стол: остальные увидят только открытые поля.'}</p>{room.round.scenarioGoal && <div className="bunker-scenario-goal"><b>Цель партии</b><span>{room.round.scenarioGoal}</span></div>}<div className="bunker-rule-grid"><article><b>1</b><span>Катастрофа и убежище общие для всех.</span></article><article><b>2</b><span>Раскрывайте только то, что готовы защищать.</span></article><article><b>3</b><span>После обсуждения совет голосует, кто остаётся снаружи.</span></article></div><button className="button primary full" onClick={() => action('bunker_accept_rules')}>Принять правила</button>{error && <ErrorText text={error} />}<p className="progress-note">Приняли: {accepted} из {total}</p></section></main>;
}

function BunkerReveal({ room, card, revealRole, action, navigate, error }) {
  const [visibleFields, setVisibleFields] = useState(() => new Set(['profession', 'age']));
  const toggleField = (fieldId) => setVisibleFields((current) => {
    const next = new Set(current);
    if (next.has(fieldId)) next.delete(fieldId);
    else next.add(fieldId);
    return next;
  });
  return <main className={`game bunker-game room-theme-${room.themeId || 'ghp'}`}><Header navigate={navigate} gameTitle="Бункер" brandTheme={room.themeId || 'ghp'} right={<span className="badge">Карточка</span>} /><section className="role role-reveal-screen bunker-reveal"><span className="eyebrow">Личная карточка</span><h1>{card ? card.profession : 'Кто вы после катастрофы?'}</h1><p>{card ? 'Нажимайте на поля карточки: открытые можно показать на столе, скрытые останутся закрытыми.' : 'Откройте карточку так, чтобы её видели только вы.'}</p>{card ? <BunkerCard card={card} visibleFields={visibleFields} onToggle={toggleField} interactive /> : <button className="secret-role-card bunker-secret-card" onClick={revealRole}><span className="role-card-inner"><span className="role-card-face role-card-back"><b>?</b><small>Открыть персонажа</small><em>Покажите экран только себе</em></span></span></button>}{card && <><p className="bunker-table-note">Открытые поля видны на этом телефоне. Можно показать экран компании или положить телефон на стол.</p><button className="button primary full" onClick={() => action('role_seen')}>Готов к обсуждению</button></>}{error && <ErrorText text={error} />}<p className="progress-note">Карточки открыли: {room.round.seenCount} из {bunkerContestants(room).length} игроков</p></section></main>;
}

function BunkerPublicReveal({ room, me, card, revealRole, action, navigate, error }) {
  const currentId = room.round.currentRevealPlayerId;
  const currentName = room.players.find((player) => player.id === currentId)?.name || 'Игрок';
  const isMyTurn = currentId === me.id;
  const publicCard = room.round.publicCards?.find((item) => item.playerId === currentId);
  const revealedIds = new Set((publicCard?.fields || []).filter((field) => field.revealed).map((field) => field.id));
  const reveal = (fieldId) => action('bunker_reveal_field', { fieldId, revealed: !revealedIds.has(fieldId) });
  return <main className={`bunker-game room-theme-${room.themeId || 'ghp'}`}><Header navigate={navigate} gameTitle="Бункер" brandTheme={room.themeId || 'ghp'} right={<span className="badge">Вскрытие</span>} /><section className="vote wrap bunker-public-reveal"><span className="eyebrow">Очередь игрока</span><h1 className="play-title">{currentName}</h1><p>{isMyTurn ? 'Выберите, какие пункты открыть всем. Остальные увидят, что поле скрыто, но не увидят значение.' : 'Игрок выбирает, какие поля раскрыть. На ваших устройствах появятся только открытые значения.'}</p>{isMyTurn && !card ? <button className="button primary full" onClick={revealRole}>Открыть свою карточку</button> : isMyTurn ? <BunkerCard card={card} visibleFields={revealedIds} onToggle={reveal} interactive /> : <BunkerPublicCard card={publicCard} />}{isMyTurn && card && <button className="button primary full" onClick={() => action('bunker_finish_reveal_turn')}>Закончить моё вскрытие</button>}<p className="progress-note">Игрок {room.round.currentRevealIndex + 1} из {room.round.revealOrder?.length || 0}</p>{error && <ErrorText text={error} />}</section></main>;
}

function BunkerCard({ card, visibleFields = null, onToggle = null, interactive = false }) {
  const visible = visibleFields || new Set(bunkerFieldMeta.map((field) => field.id));
  return <div className={`bunker-card ${interactive ? 'interactive' : ''}`}>{bunkerFieldMeta.map((field) => {
    const isVisible = visible.has(field.id);
    const content = isVisible ? card?.[field.id] : 'Скрыто';
    const body = <><span>{field.label}</span><b>{content}</b>{interactive && <small>{isVisible ? 'Нажмите, чтобы скрыть' : 'Нажмите, чтобы показать'}</small>}</>;
    return interactive ? <button key={field.id} className={!isVisible ? 'hidden-field' : ''} onClick={() => onToggle?.(field.id)}>{body}</button> : <article key={field.id} className={!isVisible ? 'hidden-field' : ''}>{body}</article>;
  })}</div>;
}

function BunkerPublicCard({ card }) {
  if (!card) return <p className="waiting-host">Ждём карточку игрока.</p>;
  return <div className="bunker-public-card"><b>{card.playerName}</b><div className="bunker-card">{card.fields.map((field) => <article key={field.id} className={!field.revealed ? 'hidden-field' : ''}><span>{field.label}</span><b>{field.revealed ? field.value : 'Скрыто'}</b><small>{field.revealed ? 'Открыто всем' : 'Игрок не раскрыл'}</small></article>)}</div></div>;
}

function BunkerPublicCards({ room }) {
  const cards = room.round.publicCards || [];
  if (!cards.length) return null;
  return <div className="bunker-public-list"><b>Открытые карточки</b>{cards.filter((card) => !card.eliminated).map((card) => <BunkerPublicCard key={card.playerId} card={card} />)}</div>;
}

function BunkerDiscussion({ room, card, navigate, now, error }) {
  const contestants = bunkerContestants(room);
  const publicMode = room.settings.revealMode === 'public_turns';
  const shelterArt = bunkerShelterArtClass(room.round.shelter);
  return <main className={`bunker-game room-theme-${room.themeId || 'ghp'}`}><Header navigate={navigate} gameTitle="Бункер" brandTheme={room.themeId || 'ghp'} right={<strong className="timer">{formatTime(room.round.endsAt - now)}</strong>} /><div className="play-layout wrap bunker-play"><section className="section bunker-crisis"><span className="eyebrow">Раунд {room.round.number} · обсуждение</span><h1 className="play-title">Докажите, что нужны убежищу</h1><p>{room.round.catastrophe}</p>{room.round.scenarioGoal && <div className="bunker-scenario-goal"><b>Цель партии</b><span>{room.round.scenarioGoal}</span></div>}<div className={`bunker-shelter ${shelterArt}`}><b>Убежище</b><span>{room.round.shelter}</span><small>Мест: {room.round.shelterCapacity}. Сейчас претендентов: {contestants.length}.</small></div>{publicMode && <BunkerPublicCards room={room} />}</section><aside className="section controls bunker-player-card"><h2>{publicMode ? 'Ваша полная карточка' : 'Ваша карточка'}</h2>{card ? <BunkerCard card={card} /> : <p className="waiting-host">Если карточка скрыта, откройте её через обновление страницы или дождитесь следующего раунда.</p>}<BunkerScoreLine room={room} />{error && <ErrorText text={error} />}</aside></div></main>;
}

function BunkerVoting({ room, me, action, navigate, now, error }) {
  const eliminated = new Set(room.round.eliminatedIds || []);
  const canVote = !eliminated.has(me.id);
  const candidates = room.players.filter((player) => player.id !== me.id && player.online && !eliminated.has(player.id) && (!room.round.voteCandidateIds || room.round.voteCandidateIds.includes(player.id)));
  return <main className={`bunker-game room-theme-${room.themeId || 'ghp'}`}><Header navigate={navigate} gameTitle="Бункер" brandTheme={room.themeId || 'ghp'} right={<strong className="timer">{formatTime(room.round.votingEndsAt - now)}</strong>} /><section className="vote wrap bunker-vote"><span className="eyebrow">{room.round.voteRound > 1 ? 'Переголосование' : 'Совет убежища'}</span><h1 className="play-title">Кто не проходит в бункер?</h1><p>Голосуйте за игрока, чья карточка кажется компании менее полезной для выживания.</p>{canVote ? <div className="vote-list">{candidates.map((player) => <button className={room.round.myVote === player.id ? 'selected' : ''} key={player.id} onClick={() => action('vote', { targetId: player.id })}>{player.name}</button>)}</div> : <p className="waiting-host">Вы уже вне отбора и ждёте решения остальных.</p>}<p>Проголосовали: {room.round.votesCount} из {bunkerContestants(room).length} претендентов</p>{error && <ErrorText text={error} />}</section></main>;
}

function BunkerResult({ room, isHost, action, leave, navigate }) {
  const result = room.round.result || {};
  const matchFinished = room.state === 'match_result';
  const eliminatedName = room.players.find((player) => player.id === result.eliminatedId)?.name;
  const savedNames = (result.savedIds || []).map((id) => room.players.find((player) => player.id === id)?.name).filter(Boolean);
  const shelterArt = bunkerShelterArtClass(room.round.shelter);
  return <main className={`game bunker-game room-theme-${room.themeId || 'ghp'}`}><Header navigate={navigate} gameTitle="Бункер" brandTheme={room.themeId || 'ghp'} right={<span className="badge">{matchFinished ? 'Финал' : 'Итог голосования'}</span>} /><section className={`role result-card bunker-result-card ${matchFinished ? 'match-finished' : ''}`}><span className="eyebrow">{matchFinished ? 'Бункер закрывается' : 'Совет решил'}</span><h1>{matchFinished ? 'Состав убежища выбран' : eliminatedName ? `${eliminatedName} остаётся снаружи` : 'Ничья спасла всех'}</h1><p>{matchFinished ? `Мест в убежище: ${room.round.shelterCapacity}. Внутрь проходят: ${savedNames.join(', ') || 'оставшиеся игроки'}.` : eliminatedName ? 'Раунд завершён. Оставшиеся продолжают спор за место в убежище.' : 'Голоса снова разделились, поэтому в этом раунде никто не исключён.'}</p><div className={`mvp-result-summary ${shelterArt}`}><b>{room.round.catastrophe}</b><span>{room.round.scenarioGoal || room.round.shelter}</span><small>{room.round.shelter}</small></div><BunkerScoreLine room={room} />{result.voteCounts && <VoteResults counts={result.voteCounts} players={room.players} />}{room.matchHistory?.length > 0 && <div className="match-history"><b>Исключения</b>{room.matchHistory.slice(0, 5).map((item) => <span key={`${item.round}-${item.at}`}>Раунд {item.round}: {room.players.find((player) => player.id === item.eliminatedId)?.name || 'никто'} · осталось {item.savedCount}</span>)}</div>}{isHost ? <button className="button primary full" onClick={() => action(matchFinished ? 'new_match' : 'next_round')}>{matchFinished ? 'Новый матч' : 'Следующее обсуждение'}</button> : <p className="waiting-host">Ждём хоста: он продолжит отбор или начнёт новый матч.</p>}<button className="link danger leave" onClick={leave}>Выйти из комнаты</button></section></main>;
}

function BunkerScoreLine({ room }) {
  const contestants = room.round ? bunkerContestants(room).length : room.players.filter((player) => player.online).length;
  const capacity = room.round?.shelterCapacity || Math.max(2, Math.floor(contestants / 2));
  return <div className="score-line bunker-score-line"><span>Претенденты: {contestants}</span><span>Мест: {capacity}</span></div>;
}

function AliasGame({ room, isHost, action, leave, navigate, now, error }) {
  if (room.round?.phase === 'alias_turn') return <AliasTurn room={room} isHost={isHost} action={action} navigate={navigate} now={now} error={error} />;
  return <AliasResult room={room} isHost={isHost} action={action} leave={leave} navigate={navigate} />;
}

function AliasTurn({ room, isHost, action, navigate, now, error }) {
  const timeLeft = room.round.endsAt - now;
  return <main className={`alias-game room-theme-${room.themeId || 'ghp'}`}><Header navigate={navigate} gameTitle="Alias" brandTheme={room.themeId || 'ghp'} right={<strong className="timer">{formatTime(timeLeft)}</strong>} /><section className="alias-play wrap"><span className="eyebrow">Ходит {room.round.teamName}</span><h1>{room.round.word}</h1><p>Объясняйте вслух. Само слово и однокоренные лучше не произносить, спорные моменты решайте по-дружески.</p><div className="alias-turn-stats"><article><b>{room.round.correct}</b><span>угадали</span></article><article><b>{room.round.skipped}</b><span>пас</span></article></div><div className="alias-actions"><button className="button primary" onClick={() => action('alias_mark_word', { result: 'correct' })}>Угадали</button><button className="button secondary" onClick={() => action('alias_mark_word', { result: 'skip' })}>Пас</button></div>{isHost && <button className="link danger alias-finish" onClick={() => action('alias_finish_turn')}>Завершить ход</button>}{error && <ErrorText text={error} />}<AliasScoreboard scores={room.scores} teams={room.aliasTeams} target={room.settings.targetScore} /></section></main>;
}

function AliasResult({ room, isHost, action, leave, navigate }) {
  const result = room.round.result;
  const matchFinished = room.state === 'match_result';
  const winnerName = matchFinished ? aliasWinnerName(room) : result.teamName;
  const continueGame = () => action(matchFinished ? 'new_match' : 'next_round');
  return <main className={`game alias-game room-theme-${room.themeId || 'ghp'}`}><Header navigate={navigate} gameTitle="Alias" brandTheme={room.themeId || 'ghp'} right={<span className="badge">{matchFinished ? 'Финал' : 'Ход завершён'}</span>} /><section className={`role result-card alias-result-card ${matchFinished ? 'match-finished' : ''}`}><span className="eyebrow">{matchFinished ? 'Матч завершён' : result.teamName}</span><h1>{matchFinished ? `${winnerName} победила` : `+${result.gained}`}</h1><p>{matchFinished ? `Игра дошла до ${room.settings.targetScore} очков. Можно налить воды, пересобрать команды и начать заново.` : `Команда угадала ${result.correct}, пропустила ${result.skipped}. Следующий ход переходит дальше.`}</p><AliasScoreboard scores={room.scores} teams={room.aliasTeams} target={room.settings.targetScore} />{room.matchHistory?.length > 0 && <div className="match-history"><b>Последние ходы</b>{room.matchHistory.slice(0, 5).map((item) => <span key={`${item.round}-${item.at}`}>Ход {item.round}: {item.teamName} +{item.gained}</span>)}</div>}{isHost ? <button className="button primary full" onClick={continueGame}>{matchFinished ? 'Новый матч' : 'Следующий ход'}</button> : <p className="waiting-host">Ждём хоста: он запустит следующий ход.</p>}<button className="link danger leave" onClick={leave}>Выйти из комнаты</button></section></main>;
}

function aliasWinnerName(room) {
  const [winnerId] = Object.entries(room.scores || {}).sort((a, b) => b[1] - a[1])[0] || ['team_1'];
  return room.aliasTeams?.find((team) => team.id === winnerId)?.name || 'Команда';
}

function AliasScoreLine({ scores }) {
  return <div className="score-line"><span>Команда 1: {scores.team_1 || 0}</span><span>Команда 2: {scores.team_2 || 0}</span></div>;
}

function AliasScoreboard({ scores, teams = [], target }) {
  const teamOne = teams.find((team) => team.id === 'team_1')?.name || 'Команда 1';
  const teamTwo = teams.find((team) => team.id === 'team_2')?.name || 'Команда 2';
  return <div className="match-score alias-score"><div><span>{teamOne}</span><b>{scores.team_1 || 0}</b><small>{Math.max(0, target - (scores.team_1 || 0))} до победы</small></div><strong>до {target}</strong><div><span>{teamTwo}</span><b>{scores.team_2 || 0}</b><small>{Math.max(0, target - (scores.team_2 || 0))} до победы</small></div></div>;
}

function RoleReveal({ room, card, revealRole, action, isHost, navigate, error }) {
  const copy = spySubjectCopy(room.round.subjectType || room.settings.subjectType);
  return <main className={`game room-theme-${room.themeId || 'ghp'}`}><Header navigate={navigate} gameTitle="Шпион" brandTheme={room.themeId || 'ghp'} right={<span className="badge">Раунд {room.round.number}</span>} /><section className="role role-reveal-screen"><span className="eyebrow">Секретная карточка</span><h1>{card ? 'Запомните роль' : 'Откройте роль'}</h1><p>{card ? 'После просмотра скройте карту. Остальные игроки не должны видеть экран.' : 'Карта лежит лицом вниз. Нажмите на неё и покажите экран только себе.'}</p><button className={`secret-role-card ${card ? 'revealed' : ''}`} onClick={card ? undefined : revealRole} aria-label={card ? 'Открытая роль' : 'Открыть секретную карту'} disabled={Boolean(card)}><span className="role-card-inner"><span className="role-card-face role-card-back"><b>?</b><small>Нажмите, чтобы посмотреть</small><em>Покажите экран только себе</em></span><span className="role-card-face role-card-front"><small>{card?.isSpy ? 'Ваша роль' : copy.yourSecret}</small><b>{card ? card.isSpy ? 'Вы шпион' : card.location : ''}</b><em>{card ? card.isSpy ? 'Не выдайте себя' : `Роль: ${card.role || 'секрет'}` : ''}</em></span></span></button>{card && <><p className="role-card-hint">{card.isSpy ? copy.spyHint : 'Отвечайте аккуратно и найдите шпиона.'}</p><button className="button primary full" onClick={() => action('role_seen')}>Скрыть карту</button></>}{error && <ErrorText text={error} />}<p className="progress-note">Роли открыли: {room.round.seenCount} из {room.players.filter((player) => player.online).length} онлайн</p></section></main>;
}

function Discussion({ room, card, action, navigate, now, error }) {
  const [guessOpen, setGuessOpen] = useState(false);
  const copy = spySubjectCopy(room.round.subjectType || room.settings.subjectType);
  return <main className={`room-theme-${room.themeId || 'ghp'}`}><Header navigate={navigate} gameTitle="Шпион" brandTheme={room.themeId || 'ghp'} right={<strong className="timer">{formatTime(room.round.endsAt - now)}</strong>} /><div className="play-layout wrap"><section className="section"><span className="eyebrow">Обсуждение · раунд {room.round.number}</span><h1 className="play-title">{room.round.subjectType === 'item' ? 'Вычислите вещь и шпиона' : 'Найдите шпиона'}</h1><p>{copy.discussionHint}</p></section><aside className="section controls"><h2>Действия</h2>{card?.isSpy && room.settings.allowSpyGuess ? <button className="button primary full" onClick={() => setGuessOpen(true)}>Остановить и ответить</button> : <p className="waiting-host">Обсуждайте вслух. Когда время закончится, голосование начнётся автоматически.</p>}<div className="score-line"><span>Мирные: {room.scores.civilians}</span><span>Шпионы: {room.scores.spies}</span></div>{error && <ErrorText text={error} />}</aside></div>{guessOpen && <GuessModal room={room} action={action} close={() => setGuessOpen(false)} />}</main>;
}

function GuessModal({ room, action, close }) {
  const copy = spySubjectCopy(room.round.subjectType || room.settings.subjectType);
  const submit = () => action('spy_guess').then(close).catch(() => {});
  return <div className="backdrop" onMouseDown={close}><section className="modal location-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><div><h2>{copy.guessAction}</h2><p>Игра остановится. После этого назовите ответ вслух, а мирные проголосуют, засчитывать его или нет.</p></div><button className="close" onClick={close}>×</button></div><div className="guess-answer-card"><span>Порядок действия</span><b>1. Нажмите кнопку<br />2. Назовите ответ вслух<br />3. Мирные голосуют</b><small>В телефоне ответ не вводится, чтобы игра оставалась живым спором компании.</small></div><button className="button primary full" onClick={submit}>Остановить игру и ответить</button><button className="button secondary full" onClick={close}>Продолжить обсуждение</button></section></div>;
}

function GuessReview({ room, me, isHost, action, navigate, now, error }) {
  const copy = spySubjectCopy(room.round.subjectType || room.settings.subjectType);
  const isSpy = room.round.amSpy;
  const activeCivilians = room.players.filter((player) => player.online).length - (room.round.spyCount || 1);
  const spyName = room.players.find((player) => player.id === room.round.spyGuess?.spyId)?.name || 'Шпион';
  const alreadyVoted = room.round.mySpyGuessVote !== null && room.round.mySpyGuessVote !== undefined;
  return <main className={`room-theme-${room.themeId || 'ghp'}`}><Header navigate={navigate} gameTitle="Шпион" brandTheme={room.themeId || 'ghp'} right={<strong className="timer">{formatTime(room.round.votingEndsAt - now)}</strong>} /><section className="vote wrap guess-review"><span className="eyebrow">Ответ Шпиона</span><h1 className="play-title">{copy.reviewTitle}</h1><p><b>{spyName}</b> остановил игру и называет ответ вслух. Мирные решают, достаточно ли точно он назвал {copy.secretName}.</p><div className="guess-answer-card"><span>Проверка вслух</span><b>Засчитать ответ Шпиона?</b><small>Решают только мирные игроки. Шпион ждёт итог голосования.</small></div>{isSpy ? <p className="waiting-host">Назовите ответ вслух. Мирные сейчас проголосуют.</p> : <div className="vote-list two-actions"><button className={room.round.mySpyGuessVote === true ? 'selected' : ''} disabled={alreadyVoted} onClick={() => action('spy_guess_vote', { accepted: true })}>Засчитать</button><button className={room.round.mySpyGuessVote === false ? 'selected danger-choice' : ''} disabled={alreadyVoted} onClick={() => action('spy_guess_vote', { accepted: false })}>Не засчитывать</button></div>}<p>Проголосовали: {room.round.spyGuessVotesCount} из {activeCivilians} мирных онлайн</p>{error && <ErrorText text={error} />}</section></main>;
}

function Voting({ room, me, isHost, action, navigate, now, error }) {
  const candidates = room.players.filter((player) => player.id !== me.id && player.online && (!room.round.voteCandidateIds || room.round.voteCandidateIds.includes(player.id)));
  return <main className={`room-theme-${room.themeId || 'ghp'}`}><Header navigate={navigate} gameTitle="Шпион" brandTheme={room.themeId || 'ghp'} right={<strong className="timer">{formatTime(room.round.votingEndsAt - now)}</strong>} /><section className="vote wrap"><span className="eyebrow">{room.round.voteRound > 1 ? 'Переголосование' : 'Голосование'}</span><h1 className="play-title">Кто шпион?</h1><p>{room.round.voteRound > 1 ? 'Голоса разделились. Выберите одного из лидеров.' : 'Выберите одного игрока. При повторной ничьей шпион победит.'}</p><div className="vote-list">{candidates.map((player) => <button className={room.round.myVote === player.id ? 'selected' : ''} key={player.id} onClick={() => action('vote', { targetId: player.id })}>{player.name}</button>)}</div><p>Проголосовали: {room.round.votesCount} из {room.players.filter((player) => player.online).length} онлайн</p>{error && <ErrorText text={error} />}</section></main>;
}

function Result({ room, isHost, action, leave, navigate }) {
  const [adBreak, setAdBreak] = useState(null);
  const result = room.round.result;
  const copy = spySubjectCopy(result.subjectType || room.round.subjectType || room.settings.subjectType);
  const spies = (result.spyIds || [result.spyId]).map((id) => room.players.find((player) => player.id === id)?.name).filter(Boolean);
  const votedOut = room.players.find((player) => player.id === result.votedOutId)?.name;
  const matchFinished = room.state === 'match_result';
  const reason = {
    spy_found: `Компания правильно выбрала: ${votedOut || spies.join(', ')} был шпионом.`,
    civilian_accused: `Компания ошиблась и выгнала мирного игрока${votedOut ? `: ${votedOut}` : ''}.`,
    vote_tie: 'Голоса снова разделились, поэтому шпион забирает раунд.',
    spy_guessed_location: `Шпион назвал ${copy.secretName}${result.guessedLocationName ? `: ${result.guessedLocationName}` : ''}.`,
    spy_failed_guess: `Шпион ошибся${result.guessedLocationName ? ` и выбрал «${result.guessedLocationName}»` : ''}.`,
    spy_guess_accepted: `Мирные засчитали ответ Шпиона, который был назван вслух.`,
    spy_guess_rejected: `Мирные не засчитали ответ Шпиона, который был назван вслух.`,
    spy_left: 'Шпион вышел из комнаты, раунд засчитан мирным.',
  }[result.reason] || 'Раунд завершён.';
  const winnerTitle = result.winner === 'civilians' ? 'Победа мирных' : 'Победа шпиона';
  const continueAfterResult = () => {
    const eventName = matchFinished ? 'new_match' : 'next_round';
    if (room.adPolicy?.enabled) {
      setAdBreak({ placement: 'post_round', slot: 'spy_between_rounds_interstitial', seconds: 5, continueLabel: matchFinished ? 'Начать новый матч' : 'Следующий раунд', onContinue: () => action(eventName) });
      return;
    }
    action(eventName);
  };
  return <main className={`game room-theme-${room.themeId || 'ghp'}`}><Header navigate={navigate} gameTitle="Шпион" brandTheme={room.themeId || 'ghp'} right={<span className="badge">{matchFinished ? 'Матч завершён' : 'Раунд завершён'}</span>} /><section className={`role result-card ${matchFinished ? 'match-finished' : ''}`}><span className="eyebrow">{matchFinished ? 'Финал матча' : winnerTitle}</span><h1>{matchFinished ? (result.winner === 'civilians' ? 'Мирные победили' : 'Шпионы победили') : result.locationName}</h1><p>{matchFinished ? `Матч завершён со счётом ${room.scores.civilians}:${room.scores.spies}. ${copy.matchLabel}: ${result.locationName}.` : reason}</p><div className="mvp-result-summary"><b>{result.winner === 'civilians' ? 'Компания раскрыла угрозу' : 'Шпион обманул компанию'}</b><span>{matchFinished ? 'Матч записан в профиль, можно начать заново.' : 'Раунд засчитан, статистика игроков обновлена.'}</span></div><Scoreboard scores={room.scores} target={room.settings.targetScore} /><div className="result-facts"><article><span>{copy.resultLabel}</span><b>{result.locationName}</b></article><article><span>{spies.length > 1 ? 'Шпионы' : 'Шпион'}</span><b>{spies.join(', ') || 'Неизвестно'}</b></article>{votedOut && <article><span>Выбывал</span><b>{votedOut}</b></article>}</div>{result.voteCounts && <VoteResults counts={result.voteCounts} players={room.players} />}{result.spyGuessVotes && <SpyGuessVoteResults votes={result.spyGuessVotes} />}{room.matchHistory?.length > 0 && <MatchHistory history={room.matchHistory} />}{isHost ? <div className="result-actions"><button className="button primary full" onClick={continueAfterResult}>{matchFinished ? 'Начать новый матч' : 'Следующий раунд'}</button><small>{room.adPolicy?.adFree ? 'PRO-доступ в комнате убирает рекламную паузу.' : matchFinished ? 'Счёт сбросится, игроки вернутся в лобби.' : 'Игроки вернутся в лобби после короткой паузы.'}</small></div> : <p className="waiting-host">Ждём хоста: он вернёт всех в лобби или начнёт новый матч.</p>}<button className="link danger leave" onClick={leave}>Выйти из комнаты</button></section>{adBreak && <AdBreakModal {...adBreak} close={() => setAdBreak(null)} />}</main>;
}

function Scoreboard({ scores, target }) {
  return <div className="match-score"><div><span>Мирные</span><b>{scores.civilians}</b><small>{Math.max(0, target - scores.civilians)} до победы</small></div><strong>до {target}</strong><div><span>Шпионы</span><b>{scores.spies}</b><small>{Math.max(0, target - scores.spies)} до победы</small></div></div>;
}

function VoteResults({ counts, players }) {
  return <div className="vote-results"><b>Результаты голосования</b>{Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([id, count]) => <span key={id}>{players.find((player) => player.id === id)?.name || 'Игрок'}: {count}</span>)}</div>;
}

function SpyGuessVoteResults({ votes }) {
  return <div className="vote-results"><b>Проверка ответа Шпиона</b><span>Засчитать: {votes.yes}</span><span>Не засчитывать: {votes.no}</span></div>;
}

function MatchHistory({ history }) {
  return <div className="match-history"><b>История матча</b>{history.slice(0, 5).map((item) => <span key={`${item.round}-${item.at}`}>Раунд {item.round}: {item.winner === 'civilians' ? 'мирные' : 'шпионы'} · {item.locationName}</span>)}</div>;
}

function Setting({ label, children }) { return <div className="setting"><span>{label}</span>{children}</div>; }
function Counter({ value, min, max, change }) { return <div className="counter"><button onClick={() => change(Math.max(min, value - 1))}>−</button><b>{value}</b><button onClick={() => change(Math.min(max, value + 1))}>+</button></div>; }
function ErrorText({ text }) { return <p className="error-text">{text}</p>; }

function RulesModal({ close }) {
  return <div className="backdrop" onMouseDown={close}><section className="modal rules-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><div><span className="eyebrow">Перед первой игрой</span><h2>Как играть в «Шпиона»</h2></div><button className="close" onClick={close}>×</button></div><ol><li><b>Откройте секретную роль</b><span>Мирные узнают место или предмет, а шпион — нет.</span></li><li><b>Задавайте вопросы по очереди</b><span>Отвечайте осторожно, чтобы не раскрыть секрет.</span></li><li><b>Найдите шпиона</b><span>Голосуйте, когда будете готовы. При ничьей будет второй тур.</span></li></ol><p className="guest-name-note">Если игрок отключится, игра продолжится без него. После возвращения он снова сможет участвовать.</p><button className="button primary full" onClick={close}>Понятно, я готов</button></section></div>;
}

function BunkerRulesModal({ close }) {
  return <div className="backdrop" onMouseDown={close}><section className="modal rules-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><div><span className="eyebrow">Перед первой игрой</span><h2>Как играть в Бункер</h2></div><button className="close" onClick={close}>×</button></div><ol><li><b>Выберите режим вскрытия</b><span>В личном режиме игрок сам показывает поля на своём телефоне. В публичном режиме раскрытые поля видны у всех.</span></li><li><b>Открывайте не всё сразу</b><span>Профессию и возраст можно раскрыть, болезни, цель или факт оставить скрытыми до спора.</span></li><li><b>Исключайте голосованием</b><span>После обсуждения компания выбирает, кто не проходит в убежище.</span></li></ol><p className="guest-name-note">Перед раундом все игроки увидят короткое пояснение выбранного режима и нажмут «Принять».</p><button className="button primary full" onClick={close}>Понятно, играем</button></section></div>;
}

function AliasRulesModal({ close }) {
  return <div className="backdrop" onMouseDown={close}><section className="modal rules-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><div><span className="eyebrow">Перед первой игрой</span><h2>Как играть в Alias</h2></div><button className="close" onClick={close}>×</button></div><ol><li><b>Команда объясняет слово</b><span>Один игрок объясняет вслух, остальные угадывают. Само слово и однокоренные не называем.</span></li><li><b>Телефон считает темп</b><span>Нажимайте «Угадали» или «Пас». Ход закончится по таймеру.</span></li><li><b>Побеждает команда</b><span>Очки идут за угаданные слова. Спорные моменты решайте быстро, без затяжного суда.</span></li></ol><p className="guest-name-note">Меньше настроек, больше живой компании.</p><button className="button primary full" onClick={close}>Понятно, играем</button></section></div>;
}

function BottomNav({ active, navigate }) {
  return <nav className="bottom-nav">
    <button className={active === 'home' ? 'active' : ''} onClick={() => navigate('home')}><b>Главная</b><span>Играть</span></button>
    <button className={active === 'store' ? 'active' : ''} onClick={() => navigate('store')}><b>Магазин</b><span>Наборы</span></button>
    <button className={active === 'profile' ? 'active' : ''} onClick={() => navigate('profile')}><b>Профиль</b><span>Доступы</span></button>
  </nav>;
}

function ProfileScreen({ navigate, profile, setProfile }) {
  const [authOpen, setAuthOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [avatarDraft, setAvatarDraft] = useState(null);
  const [profileError, setProfileError] = useState('');
  const name = profile?.name || getOrCreateDisplayName();
  const activeAccesses = profileAccessList(profile);
  const syncAccount = (nextProfile) => {
    const account = getAccount();
    if (account) saveAccount({ ...account, name: nextProfile.name, avatarDataUrl: nextProfile.avatarDataUrl || '' });
  };
  const saveProfileName = async (event) => {
    event.preventDefault();
    setProfileError('');
    try {
      const result = await emit('update_profile', { name: draftName });
      setProfile(result.profile);
      saveGuestDisplayName(result.profile.name);
      syncAccount(result.profile);
      setEditingName(false);
    } catch (error) {
      setProfileError(error.message || 'Не удалось изменить имя');
    }
  };
  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setProfileError('');
    if (!file.type.startsWith('image/')) {
      setProfileError('Выберите картинку в формате PNG, JPG или WEBP.');
      return;
    }
    if (file.size > 6000000) {
      setProfileError('Картинка слишком большая. Лучше выбрать файл до 6 МБ.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarDraft({ src: String(reader.result || ''), zoom: 1, x: 0, y: 0 });
    reader.readAsDataURL(file);
  };
  const saveAvatar = async () => {
    if (!avatarDraft?.src) return;
    setProfileError('');
    try {
      const avatarDataUrl = await cropAvatarImage(avatarDraft);
      const result = await emit('update_profile', { avatarDataUrl });
      setProfile(result.profile);
      syncAccount(result.profile);
      setAvatarDraft(null);
    } catch (error) {
      setProfileError(error.message || 'Не удалось обновить аватар');
    }
  };
  return <main className="app-screen">
    <Header navigate={navigate} right={<SubscriptionBadge profile={profile} />} />
    <section className="profile-hero wrap compact-profile-hero">
      <label className="avatar-large avatar-edit" title="Поменять аватар">
        {profile?.avatarDataUrl ? <img src={profile.avatarDataUrl} alt="" /> : name[0]?.toUpperCase()}
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadAvatar} />
      </label>
      <span className="eyebrow">Профиль игрока</span>
      {editingName ? <form className="profile-name-form" onSubmit={saveProfileName}>
        <input autoFocus value={draftName} onChange={(event) => setDraftName(event.target.value)} maxLength={24} />
        <button className="button small secondary" type="button" onClick={() => setEditingName(false)}>Отмена</button>
        <button className="button small primary" type="submit">Сохранить</button>
      </form> : <button className="profile-name-button" onClick={() => { setDraftName(name); setEditingName(true); }}><h1>{name}</h1><small>Нажмите, чтобы изменить имя</small></button>}
      <small className="profile-id">ID: {profile?.id || getPlayerId()}</small>
      <p>{profile?.accountType === 'guest' ? 'Гостевой профиль' : `Аккаунт ${profile?.email || 'подключен'}`}</p>
      {profileError && <ErrorText text={profileError} />}
    </section>
    <section className="section wrap profile-access-panel">
      <div className="section-title"><h2>Мои доступы</h2><button className="link" onClick={() => navigate('store')}>В магазин</button></div>
      {activeAccesses.length ? <div className="profile-access-list">{activeAccesses.map((access) => <article key={access.id}>
        <i>{access.title[0]}</i>
        <span><b>{access.title}</b><small>{access.label}</small><em>до {formatAccessDate(access.until)}</em></span>
        <p>{access.note}</p>
      </article>)}</div> : <div className="profile-empty-access"><b>FREE</b><span>Активных платных доступов нет. Базовые игры доступны бесплатно.</span></div>}
      {profile?.orders?.some((order) => order.status === 'pending') && <p className="guest-name-note">Есть незавершённые заказы. Проверьте их в магазине или обратитесь в поддержку.</p>}
      {profile?.accountType === 'guest' && <button className="button secondary full" onClick={() => setAuthOpen(true)}>Войти для сохранения покупок</button>}
    </section>
    {authOpen && <AuthModal close={() => setAuthOpen(false)} setProfile={setProfile} />}
    {avatarDraft && <AvatarCropModal draft={avatarDraft} setDraft={setAvatarDraft} close={() => setAvatarDraft(null)} save={saveAvatar} />}
  </main>;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Не удалось прочитать картинку'));
    image.src = src;
  });
}

async function cropAvatarImage({ src, zoom, x, y }) {
  const image = await loadImage(src);
  const size = 512;
  const previewSize = 184;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  context.fillStyle = '#edf4ff';
  context.fillRect(0, 0, size, size);
  const baseScale = Math.max(size / image.width, size / image.height);
  const scale = baseScale * Number(zoom || 1);
  const offsetScale = size / previewSize;
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const drawX = (size - drawWidth) / 2 + Number(x || 0) * offsetScale;
  const drawY = (size - drawHeight) / 2 + Number(y || 0) * offsetScale;
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  return canvas.toDataURL('image/jpeg', 0.86);
}

function AvatarCropModal({ draft, setDraft, close, save }) {
  const update = (field, value) => setDraft((current) => ({ ...current, [field]: Number(value) }));
  return <div className="backdrop avatar-crop-backdrop" onMouseDown={close}>
    <section className="modal avatar-crop-modal" onMouseDown={(event) => event.stopPropagation()}>
      <div className="modal-title"><div><span className="eyebrow">Аватар</span><h2>Выберите кадр</h2><p>Подвиньте картинку и настройте зум, чтобы лицо или нужная часть попали в круг.</p></div><button className="close" onClick={close}>×</button></div>
      <div className="avatar-crop-stage">
        <div className="avatar-crop-preview"><img src={draft.src} alt="" style={{ transform: `translate(${draft.x}px, ${draft.y}px) scale(${draft.zoom})` }} /></div>
      </div>
      <div className="avatar-crop-controls">
        <label><span>Зум</span><input type="range" min="1" max="2.6" step="0.01" value={draft.zoom} onChange={(event) => update('zoom', event.target.value)} /></label>
        <label><span>Сдвиг влево / вправо</span><input type="range" min="-80" max="80" step="1" value={draft.x} onChange={(event) => update('x', event.target.value)} /></label>
        <label><span>Сдвиг вверх / вниз</span><input type="range" min="-80" max="80" step="1" value={draft.y} onChange={(event) => update('y', event.target.value)} /></label>
      </div>
      <div className="avatar-crop-actions"><button className="button secondary full" onClick={close}>Отмена</button><button className="button primary full" onClick={save}>Сохранить аватар</button></div>
    </section>
  </div>;
}

function StoreScreen({ navigate, profile, setProfile, catalog }) {
  return <main className="app-screen store-partyhub-page">
    <Header navigate={navigate} brandTheme="partyhub" right={<SubscriptionBadge profile={profile} />} />
    <Storefront profile={profile} setProfile={setProfile} catalog={catalog} navigate={navigate} />
  </main>;
}
