import { getOrCreateDisplayName } from '../../identity';
import { GameShell, LeaveLink, PhaseScreen } from '../engine/GameShell';
import { Header, SubscriptionBadge, VersionBadge } from '../../shared/Header';
import { Counter, ErrorText, GameSwitcher, JoinModal, SeoLinks, Setting } from '../../shared/ui';
import { LandingAccessShowcase, LandingPlaybook } from '../../shared/Landing';
import { hasProAccess, hasThemedContentAccess } from '../../shared/helpers';

const deckNames = {
  family: 'Лёгкий',
  party: 'Вечеринка',
  drinks: 'Бар и друзья',
  couples: 'Для влюбленных',
  adult_couples: '18+ для пар',
  adult_party: '18+ вписка',
  fandom: 'Фан-вселенные',
  harry_potter: 'Гарри Поттер',
  lotr: 'Властелин колец',
  retro_movies: 'Ретро-кино',
  video_games: 'Видеоигры',
  bold: 'Смелый',
};

const promptTypeNames = {
  truth: 'Правда',
  dare: 'Действие',
};

export function TruthDareLanding({ create, join, joinOpen, closeJoin, onJoin, error, navigate, profile }) {
  const name = getOrCreateDisplayName();
  const proActive = hasProAccess(profile);
  const startOrUpgrade = () => {
    if (proActive) create(name, 'truthdare');
    else navigate('store');
  };
  return <main className="alias-landing truthdare-landing">
    <Header navigate={navigate} right={<><SubscriptionBadge profile={profile} /><VersionBadge /><span className="badge live">Правда или действие</span></>} />
    <section className="alias-hero wrap truthdare-hero">
      <div className="landing-art truthdare-hero-art" />
      <span className="eyebrow">Правда или действие онлайн</span>
      <h1>Тяните карточки, отвечайте честно или принимайте вызов</h1>
      <p>Телефон сам выбирает игрока, тип задания и следующую карточку. Подходит для быстрых домашних посиделок, вечеринок и компаний, где нужно разогреть разговор.</p>
      <div className="actions">
        <button className="button primary" onClick={startOrUpgrade}>{proActive ? 'Начать игру' : 'Открыть PRO'}</button>
        <button className="button secondary join-button" onClick={join}>Войти по коду</button>
      </div>
      {error && <ErrorText text={error} />}
    </section>
    <LandingPlaybook game="truthdare" />
    <LandingAccessShowcase game="truthdare" navigate={navigate} profile={profile} />
    <section className="landing-cta wrap">
      <h2>Готовы к первому вопросу?</h2>
      <p>Создайте комнату, позовите друзей и выберите уровень смелости.</p>
      <button className="button primary full" onClick={startOrUpgrade}>{proActive ? 'Начать игру' : 'Открыть PRO'}</button>
    </section>
    {joinOpen && <JoinModal initialName={name} close={closeJoin} join={onJoin} error={error} />}
    <SeoLinks />
  </main>;
}

export function TruthDareGame({ room, action, leave, navigate, error }) {
  const activeName = room.round?.activePlayerName || 'Игрок';
  const promptType = room.round?.promptType || 'truth';
  const typeName = promptTypeNames[promptType] || 'Карточка';
  return <GameShell gameId="truthdare" room={room} navigate={navigate} right={<span className="badge">{deckNames[room.settings.deck] || 'Вечеринка'}</span>}>
    <PhaseScreen className="td-play" eyebrow={`Карточка ${room.round?.number || 1} · ${deckNames[room.settings.deck] || 'Вечеринка'}`}>
      <div className={`td-card td-${promptType}`}>
        <span>{typeName} для</span>
        <b>{activeName}</b>
        <p>{room.round?.promptText || 'Готовим карточку...'}</p>
      </div>
      <div className="td-actions">
        <button className="button primary" onClick={() => action('truthdare_mark_prompt', { result: 'done' })}>Выполнено</button>
        <button className="button secondary" onClick={() => action('truthdare_mark_prompt', { result: 'skip' })}>Следующий</button>
      </div>
      {error && <ErrorText text={error} />}
      <TruthDareScoreboard room={room} />
      <LeaveLink leave={leave} />
    </PhaseScreen>
  </GameShell>;
}

export function TruthDareHostSettings({ room, catalog = {}, profile, update, changeGame, themeSettings }) {
  const decks = catalog.truthDareDecks?.length ? catalog.truthDareDecks : [
    { id: 'family', name: 'Лёгкий', free: true },
    { id: 'party', name: 'Вечеринка', free: true },
    { id: 'bold', name: 'Смелый', tier: 'premium' },
  ];
  return <section className="section settings alias-host-panel truthdare-host-panel">
    <h2>Правда или действие</h2>
    <GameSwitcher gameId={room.gameId} changeGame={changeGame} />
    <details className="settings-group" open>
      <summary><span>Настройки карточек</span><small>{deckNames[room.settings.deck] || 'Вечеринка'} · до {room.settings.targetScore}</small></summary>
      <Setting label="Колода"><select value={room.settings.deck} onChange={(event) => update({ deck: event.target.value })}>{decks.map((deck) => { const locked = !hasThemedContentAccess(profile, 'truthdare', deck); return <option key={deck.id} value={deck.id} disabled={locked}>{deck.name || deckNames[deck.id]} · {locked ? 'пропуск или PRO' : deck.free || deck.tier === 'free' ? 'включена' : 'открыта'}</option>; })}</select></Setting>
      <Setting label="Цель"><Counter value={room.settings.targetScore} min={5} max={30} change={(targetScore) => update({ targetScore })} /></Setting>
    </details>
    <p className="settings-note">За выполненную карточку игрок получает очко. Тематический пропуск открывает свою колоду, а PRO открывает все колоды разом.</p>
    {themeSettings}
  </section>;
}

export function TruthDareLobbySummary({ room, themeSummary }) {
  return <section className="lobby-game-summary alias-summary truthdare-summary">
    <span>Выбрана игра</span>
    <h2>Правда или действие</h2>
    <p>{deckNames[room.settings.deck] || 'Вечеринка'} · до {room.settings.targetScore} выполненных карточек</p>
    <small>Телефон выберет игрока и покажет правду или действие. Можно выполнять или быстро передавать ход дальше.</small>
    {themeSummary}
  </section>;
}

export function TruthDareScoreLine({ room }) {
  const leader = truthDareLeader(room);
  return <div className="score-line"><span>Лидер: {leader.name}</span><span>{leader.score} очков</span></div>;
}

export function TruthDareRulesModal({ close }) {
  return <div className="backdrop" onMouseDown={close}><section className="modal rules-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><div><span className="eyebrow">Перед первой карточкой</span><h2>Как играть</h2></div><button className="close" onClick={close}>×</button></div><ol><li><b>Телефон выбирает игрока</b><span>На экране появится имя участника и карточка: правда или действие.</span></li><li><b>Игрок отвечает или выполняет</b><span>Если задание принято, нажмите “Выполнено” и игрок получит очко.</span></li><li><b>Можно пропустить</b><span>Кнопка “Следующий” передаст ход дальше без очков. Договоритесь о настроении игры заранее.</span></li></ol><p className="guest-name-note">Лучше держать темп быстрым: короткие ответы, много смеха, без давления.</p><button className="button primary full" onClick={close}>Понятно, играем</button></section></div>;
}

function truthDareLeader(room) {
  const players = room.players || [];
  const [leaderId, score = 0] = Object.entries(room.scores || {}).sort((a, b) => b[1] - a[1])[0] || [players[0]?.id, 0];
  return { name: players.find((player) => player.id === leaderId)?.name || 'Пока никто', score };
}

function TruthDareScoreboard({ room }) {
  const rows = [...(room.players || [])].sort((a, b) => (room.scores?.[b.id] || 0) - (room.scores?.[a.id] || 0));
  const top = room.scores?.[rows[0]?.id] || 0;
  return <div className="td-scoreboard">{rows.map((player) => {
    const score = room.scores?.[player.id] || 0;
    return <span key={player.id} className={top > 0 && score === top ? 'leader' : ''}>{player.name} · {score}</span>;
  })}</div>;
}
