import { getOrCreateDisplayName } from '../../identity';
import { GameShell, LeaveLink, PhaseScreen, ProgressNote, WaitingNote } from '../engine/GameShell';
import { Header, SubscriptionBadge, VersionBadge } from '../../shared/Header';
import { Counter, ErrorText, GameSwitcher, JoinModal, SeoLinks, Setting } from '../../shared/ui';
import { LandingAccessShowcase, LandingPlaybook } from '../../shared/Landing';
import { hasProAccess, hasThemedContentAccess } from '../../shared/helpers';

const deckNames = {
  family: 'Лёгкий',
  party: 'Вечеринка',
  drinks: 'Бар и друзья',
  couples: 'Для влюблённых',
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
      <p>Ход идёт по кругу, игрок сам выбирает правду или действие, а компания решает, засчитать ли карточку. Подходит для быстрых домашних посиделок, вечеринок и компаний, где нужно разогреть разговор.</p>
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

const levelNames = { 1: 'Разогрев', 2: 'Вечеринка', 3: 'Смелая' };

export function TruthDareGame({ room, me, action, leave, navigate, error }) {
  const round = room.round || {};
  const deckName = deckLabel(room.settings.decks);
  const isActive = round.activePlayerId === me?.id;
  const activeName = round.activePlayerName || 'Игрок';
  const shell = (children) => <GameShell gameId="truthdare" room={room} navigate={navigate} right={<span className="badge">{deckName}</span>}>{children}</GameShell>;

  if (room.state === 'match_result') {
    return shell(<PhaseScreen variant="focus" className="td-finish" eyebrow="Игра окончена" title={`${round.result?.winnerName || activeName} побеждает`}>
      <p className="phase-lead">Набрано {round.result?.score || 0} засчитанных карточек. Компания решала каждую.</p>
      <TruthDareScoreboard room={room} />
      <LeaveLink leave={leave} />
    </PhaseScreen>);
  }

  // Ход: сначала выбор, потом карточка, потом суд компании.
  if (round.phase === 'truthdare_choice') {
    return shell(<PhaseScreen className="td-play" eyebrow={`Ход ${round.number || 1} · ${deckName}`} title={isActive ? 'Что выбираешь?' : `Ходит ${activeName}`}>
      {isActive ? <>
        <p className="phase-lead">Выбери сам — карточку увидишь только после выбора.</p>
        <div className="td-choice">
          <button className="td-choice-card td-truth" onClick={() => action('truthdare_choose', { promptType: 'truth' })}>
            <b>Правда</b><small>Честный ответ на вопрос</small>
          </button>
          <button className="td-choice-card td-dare" onClick={() => action('truthdare_choose', { promptType: 'dare' })}>
            <b>Действие</b><small>Задание для компании</small>
          </button>
        </div>
        <RefuseButton room={room} action={action} />
      </> : <WaitingNote>{activeName} выбирает правду или действие.</WaitingNote>}
      {error && <ErrorText text={error} />}
      <TruthDareScoreboard room={room} />
      <LeaveLink leave={leave} />
    </PhaseScreen>);
  }

  if (round.phase === 'truthdare_review') {
    const alreadyVoted = round.myReviewVote !== null && round.myReviewVote !== undefined;
    return shell(<PhaseScreen className="td-play" eyebrow="Решает компания" title={`Засчитать ${activeName}?`}>
      <PromptCard round={round} activeName={activeName} />
      {isActive
        ? <WaitingNote>Компания решает, засчитать ли карточку. Очко даётся только за принятую.</WaitingNote>
        : <div className="vote-list two-actions">
          <button className={round.myReviewVote === true ? 'selected' : ''} disabled={alreadyVoted} onClick={() => action('truthdare_review_vote', { accepted: true })}>Засчитать</button>
          <button className={round.myReviewVote === false ? 'selected danger-choice' : ''} disabled={alreadyVoted} onClick={() => action('truthdare_review_vote', { accepted: false })}>Не засчитывать</button>
        </div>}
      <ProgressNote>Проголосовали: {round.reviewVotesCount || 0} из {round.juryCount || 0}</ProgressNote>
      {error && <ErrorText text={error} />}
      <TruthDareScoreboard room={room} />
      <LeaveLink leave={leave} />
    </PhaseScreen>);
  }

  return shell(<PhaseScreen className="td-play" eyebrow={`Ход ${round.number || 1} · ${deckName}`} title={isActive ? 'Твоя карточка' : `Сейчас ходит ${activeName}`}>
    <PromptCard round={round} activeName={activeName} />
    {isActive ? <>
      <button className="button primary full" onClick={() => action('truthdare_submit')}>Я сделал — на суд компании</button>
      <RefuseButton room={room} action={action} />
    </> : <WaitingNote>{activeName} отвечает вслух. Потом вы решите, засчитать ли карточку.</WaitingNote>}
    {error && <ErrorText text={error} />}
    <TruthDareScoreboard room={room} />
    <LeaveLink leave={leave} />
  </PhaseScreen>);
}

function PromptCard({ round, activeName }) {
  const promptType = round.promptType || 'truth';
  return <div className={`td-card td-${promptType}`}>
    <span>{promptTypeNames[promptType] || 'Карточка'} для</span>
    <b>{activeName}</b>
    <p>{round.promptText || 'Готовим карточку...'}</p>
    {round.promptLevel && <em className={`td-level td-level-${round.promptLevel}`}>{levelNames[round.promptLevel]}</em>}
  </div>;
}

function RefuseButton({ room, action }) {
  const left = room.myRefusalsLeft ?? 0;
  return <div className="td-refuse">
    <button className="button secondary full" disabled={left <= 0} onClick={() => action('truthdare_refuse')}>
      {left > 0 ? 'Отказаться' : 'Отказы закончились'}
    </button>
    <small>{left > 0 ? `Осталось отказов: ${left}. Очко за отказ не даётся.` : 'Жетоны отказа кончились — карточку придётся выполнить.'}</small>
  </div>;
}

export function TruthDareHostSettings({ room, catalog = {}, profile, update, changeGame, themeSettings }) {
  const decks = catalog.truthDareDecks?.length ? catalog.truthDareDecks : [
    { id: 'family', name: 'Лёгкий', free: true },
    { id: 'party', name: 'Вечеринка', free: true },
    { id: 'bold', name: 'Смелый', tier: 'premium' },
  ];
  const selectedDecks = room.settings.decks || [];
  const toggleDeck = (id) => {
    const next = selectedDecks.includes(id) ? selectedDecks.filter((item) => item !== id) : [...selectedDecks, id];
    if (next.length) update({ decks: next });
  };
  return <section className="section settings alias-host-panel truthdare-host-panel">
    <h2>Правда или действие</h2>
    <GameSwitcher gameId={room.gameId} changeGame={changeGame} />
    <details className="settings-group" open>
      <summary><span>Настройки карточек</span><small>{deckLabel(room.settings.decks)} · до {room.settings.targetScore}</small></summary>
      <div className="dictionary-checklist">{decks.map((deck) => {
        const locked = !hasThemedContentAccess(profile, 'truthdare', deck);
        const checked = selectedDecks.includes(deck.id);
        return <label key={deck.id} className={locked ? 'locked' : ''}>
          <input type="checkbox" checked={checked} disabled={locked} onChange={() => toggleDeck(deck.id)} />
          <span><b>{deck.name || deckNames[deck.id]}</b><small>{deck.ageRating ? `${deck.ageRating} · ` : ''}{locked ? 'пропуск или PRO' : 'доступна'}</small></span>
        </label>;
      })}</div>
      <Setting label="Цель"><Counter value={room.settings.targetScore} min={5} max={30} change={(targetScore) => update({ targetScore })} /></Setting>
    </details>
    <p className="settings-note">Очко даётся только за карточку, которую засчитала компания. У каждого есть два отказа на игру. Тематический пропуск открывает свою колоду, а PRO открывает все колоды разом.</p>
    {themeSettings}
  </section>;
}

export function TruthDareLobbySummary({ room, themeSummary }) {
  return <section className="lobby-game-summary alias-summary truthdare-summary">
    <span>Выбрана игра</span>
    <h2>Правда или действие</h2>
    <p>{deckLabel(room.settings.decks)} · до {room.settings.targetScore} выполненных карточек</p>
    <small>Ход идёт по кругу, игрок сам выбирает правду или действие, а компания решает, засчитать ли карточку.</small>
    {themeSummary}
  </section>;
}

export function TruthDareScoreLine({ room }) {
  const leader = truthDareLeader(room);
  return <div className="score-line"><span>Лидер: {leader.name}</span><span>{leader.score} очков</span></div>;
}

export function TruthDareRulesModal({ close }) {
  return <div className="backdrop" onMouseDown={close}><section className="modal rules-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><div><span className="eyebrow">Перед первой карточкой</span><h2>Как играть</h2></div><button className="close" onClick={close}>×</button></div><ol><li><b>Игрок выбирает сам</b><span>Телефон передаёт ход по кругу, а правду или действие выбирает сам игрок — карточку он видит только после выбора.</span></li><li><b>Компания решает, засчитать ли</b><span>После ответа остальные голосуют «Засчитать» или «Не засчитывать». Очко даётся только за принятую карточку.</span></li><li><b>Отказ стоит жетона</b><span>На игру даётся два отказа. Когда они кончились, карточку придётся выполнять.</span></li></ol><p className="guest-name-note">Карточки становятся смелее вместе с выбранной колодой. Держите темп быстрым: короткие ответы, много смеха, без давления.</p><button className="button primary full" onClick={close}>Понятно, играем</button></section></div>;
}

// Одна колода показывается по имени, несколько — счётчиком, иначе подпись
// в шапке и лобби расползается на несколько строк.
function deckLabel(deckIds = []) {
  const ids = deckIds.length ? deckIds : ['party'];
  if (ids.length === 1) return deckNames[ids[0]] || 'Вечеринка';
  return `${ids.length} ${ids.length < 5 ? 'колоды' : 'колод'}`;
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
