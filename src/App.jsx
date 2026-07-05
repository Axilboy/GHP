import { useEffect, useMemo, useState } from 'react';
import { socket, emit } from './socket';
import { getOrCreateDisplayName, getPlayerId, getSessionKey } from './identity';
import { localStore } from './browserStorage';
import { getSavedVkLaunch, initVkBridge, readVkLaunchParams, saveVkLaunch, verifyVkLaunch } from './vk';
import { initYandexMetrika, reachMetrikaGoal } from './yandexMetrika';
import { currentPath, isVkHost, normalizePausedSession, readSavedSession, saveActiveSession, trackClientEvent } from './shared/helpers';
import { SessionExitModal, SessionReturnBanner } from './shared/ui';
import { AdminPage } from './screens/Admin';
import { DemoPage } from './screens/Demo';
import { Game } from './screens/GameRouter';
import { ProjectLanding } from './screens/Home';
import { Lobby } from './screens/Lobby';
import { LegalPage } from './screens/Legal';
import { ProfileScreen } from './screens/Profile';
import { StoreScreen } from './screens/Store';
import { VkMiniAppPage } from './screens/Vk';
import { AliasLanding } from './games/alias/Alias';
import { BunkerLanding } from './games/bunker/Bunker';
import { SpyLanding } from './games/spy/Spy';

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
