import { useState } from 'react';
import { getOrCreateDisplayName } from '../../identity';
import { Header, SubscriptionBadge, VersionBadge } from '../../shared/Header';
import { ErrorText, GameSwitcher, JoinModal, SeoLinks, Setting, VoteResults } from '../../shared/ui';
import { LandingAccessShowcase, LandingPlaybook } from '../../shared/Landing';
import { formatTime, hasRoomContentAccess } from '../../shared/helpers';

export const bunkerFieldMeta = [
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

export const bunkerRevealModeNames = {
  private_table: 'Личная карточка на стол',
  public_turns: 'Вскрытие по очереди',
};

export const bunkerContentPackOptions = [
  { id: 'classic', name: 'Классический бункер', badge: 'включён' },
  { id: 'hard_medical', name: 'Жёсткие болезни', badge: 'пак' },
  { id: 'party18', name: '18+ вечеринка', badge: 'пак' },
  { id: 'corporate', name: 'Корпоратив', badge: 'пак' },
  { id: 'space', name: 'Космос', badge: 'пак' },
  { id: 'mystic', name: 'Мистика', badge: 'пак' },
  { id: 'wasteland', name: 'Постапокалипсис', badge: 'пак' },
];

export function BunkerLanding({ create, join, joinOpen, closeJoin, onJoin, error, navigate, profile }) {
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

export function bunkerContestants(room) {
  const eliminated = new Set(room.round?.eliminatedIds || []);
  return room.players.filter((player) => player.online && !eliminated.has(player.id));
}

export function bunkerShelterArtClass(shelter = '') {
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

export function BunkerGame({ room, me, isHost, card, revealRole, action, leave, navigate, now, error }) {
  if (room.round?.phase === 'briefing') return <BunkerBriefing room={room} action={action} navigate={navigate} error={error} />;
  if (room.round?.phase === 'public_reveal') return <BunkerPublicReveal room={room} me={me} card={card} revealRole={revealRole} action={action} navigate={navigate} error={error} />;
  if (room.round?.phase === 'role_reveal') return <BunkerReveal room={room} card={card} revealRole={revealRole} action={action} navigate={navigate} error={error} />;
  if (room.round?.phase === 'discussion') return <BunkerDiscussion room={room} card={card} navigate={navigate} now={now} error={error} />;
  if (room.round?.phase === 'voting') return <BunkerVoting room={room} me={me} action={action} navigate={navigate} now={now} error={error} />;
  return <BunkerResult room={room} isHost={isHost} action={action} leave={leave} navigate={navigate} />;
}

export function BunkerBriefing({ room, action, navigate, error }) {
  const revealMode = room.settings.revealMode || 'private_table';
  const accepted = room.round.acceptedRulesCount || 0;
  const total = bunkerContestants(room).length;
  return <main className={`game bunker-game room-theme-${room.themeId || 'ghp'}`}><Header navigate={navigate} gameTitle="Бункер" brandTheme={room.themeId || 'ghp'} right={<span className="badge">Правила</span>} /><section className="role bunker-briefing"><span className="eyebrow">Перед стартом</span><h1>{revealMode === 'public_turns' ? 'Вскрываемся по очереди' : 'Карточка остаётся у игрока'}</h1><p>{revealMode === 'public_turns' ? 'Когда придёт ваша очередь, выберите поля, которые готовы открыть. Все увидят раскрытые значения на своих телефонах, а закрытые поля останутся скрытыми.' : 'Откройте личную карточку, нажимайте на поля, чтобы показать или скрыть их на своём экране. Можно положить телефон на стол: остальные увидят только открытые поля.'}</p>{room.round.scenarioGoal && <div className="bunker-scenario-goal"><b>Цель партии</b><span>{room.round.scenarioGoal}</span></div>}<div className="bunker-rule-grid"><article><b>1</b><span>Катастрофа и убежище общие для всех.</span></article><article><b>2</b><span>Раскрывайте только то, что готовы защищать.</span></article><article><b>3</b><span>После обсуждения совет голосует, кто остаётся снаружи.</span></article></div><button className="button primary full" onClick={() => action('bunker_accept_rules')}>Принять правила</button>{error && <ErrorText text={error} />}<p className="progress-note">Приняли: {accepted} из {total}</p></section></main>;
}

export function BunkerReveal({ room, card, revealRole, action, navigate, error }) {
  const [visibleFields, setVisibleFields] = useState(() => new Set(['profession', 'age']));
  const toggleField = (fieldId) => setVisibleFields((current) => {
    const next = new Set(current);
    if (next.has(fieldId)) next.delete(fieldId);
    else next.add(fieldId);
    return next;
  });
  return <main className={`game bunker-game room-theme-${room.themeId || 'ghp'}`}><Header navigate={navigate} gameTitle="Бункер" brandTheme={room.themeId || 'ghp'} right={<span className="badge">Карточка</span>} /><section className="role role-reveal-screen bunker-reveal"><span className="eyebrow">Личная карточка</span><h1>{card ? card.profession : 'Кто вы после катастрофы?'}</h1><p>{card ? 'Нажимайте на поля карточки: открытые можно показать на столе, скрытые останутся закрытыми.' : 'Откройте карточку так, чтобы её видели только вы.'}</p>{card ? <BunkerCard card={card} visibleFields={visibleFields} onToggle={toggleField} interactive /> : <button className="secret-role-card bunker-secret-card" onClick={revealRole}><span className="role-card-inner"><span className="role-card-face role-card-back"><b>?</b><small>Открыть персонажа</small><em>Покажите экран только себе</em></span></span></button>}{card && <><p className="bunker-table-note">Открытые поля видны на этом телефоне. Можно показать экран компании или положить телефон на стол.</p><button className="button primary full" onClick={() => action('role_seen')}>Готов к обсуждению</button></>}{error && <ErrorText text={error} />}<p className="progress-note">Карточки открыли: {room.round.seenCount} из {bunkerContestants(room).length} игроков</p></section></main>;
}

export function BunkerPublicReveal({ room, me, card, revealRole, action, navigate, error }) {
  const currentId = room.round.currentRevealPlayerId;
  const currentName = room.players.find((player) => player.id === currentId)?.name || 'Игрок';
  const isMyTurn = currentId === me.id;
  const publicCard = room.round.publicCards?.find((item) => item.playerId === currentId);
  const revealedIds = new Set((publicCard?.fields || []).filter((field) => field.revealed).map((field) => field.id));
  const reveal = (fieldId) => action('bunker_reveal_field', { fieldId, revealed: !revealedIds.has(fieldId) });
  return <main className={`bunker-game room-theme-${room.themeId || 'ghp'}`}><Header navigate={navigate} gameTitle="Бункер" brandTheme={room.themeId || 'ghp'} right={<span className="badge">Вскрытие</span>} /><section className="vote wrap bunker-public-reveal"><span className="eyebrow">Очередь игрока</span><h1 className="play-title">{currentName}</h1><p>{isMyTurn ? 'Выберите, какие пункты открыть всем. Остальные увидят, что поле скрыто, но не увидят значение.' : 'Игрок выбирает, какие поля раскрыть. На ваших устройствах появятся только открытые значения.'}</p>{isMyTurn && !card ? <button className="button primary full" onClick={revealRole}>Открыть свою карточку</button> : isMyTurn ? <BunkerCard card={card} visibleFields={revealedIds} onToggle={reveal} interactive /> : <BunkerPublicCard card={publicCard} />}{isMyTurn && card && <button className="button primary full" onClick={() => action('bunker_finish_reveal_turn')}>Закончить моё вскрытие</button>}<p className="progress-note">Игрок {room.round.currentRevealIndex + 1} из {room.round.revealOrder?.length || 0}</p>{error && <ErrorText text={error} />}</section></main>;
}

export function BunkerCard({ card, visibleFields = null, onToggle = null, interactive = false }) {
  const visible = visibleFields || new Set(bunkerFieldMeta.map((field) => field.id));
  return <div className={`bunker-card ${interactive ? 'interactive' : ''}`}>{bunkerFieldMeta.map((field) => {
    const isVisible = visible.has(field.id);
    const content = isVisible ? card?.[field.id] : 'Скрыто';
    const body = <><span>{field.label}</span><b>{content}</b>{interactive && <small>{isVisible ? 'Нажмите, чтобы скрыть' : 'Нажмите, чтобы показать'}</small>}</>;
    return interactive ? <button key={field.id} className={!isVisible ? 'hidden-field' : ''} onClick={() => onToggle?.(field.id)}>{body}</button> : <article key={field.id} className={!isVisible ? 'hidden-field' : ''}>{body}</article>;
  })}</div>;
}

export function BunkerPublicCard({ card }) {
  if (!card) return <p className="waiting-host">Ждём карточку игрока.</p>;
  return <div className="bunker-public-card"><b>{card.playerName}</b><div className="bunker-card">{card.fields.map((field) => <article key={field.id} className={!field.revealed ? 'hidden-field' : ''}><span>{field.label}</span><b>{field.revealed ? field.value : 'Скрыто'}</b><small>{field.revealed ? 'Открыто всем' : 'Игрок не раскрыл'}</small></article>)}</div></div>;
}

export function BunkerPublicCards({ room }) {
  const cards = room.round.publicCards || [];
  if (!cards.length) return null;
  return <div className="bunker-public-list"><b>Открытые карточки</b>{cards.filter((card) => !card.eliminated).map((card) => <BunkerPublicCard key={card.playerId} card={card} />)}</div>;
}

export function BunkerDiscussion({ room, card, navigate, now, error }) {
  const contestants = bunkerContestants(room);
  const publicMode = room.settings.revealMode === 'public_turns';
  const shelterArt = bunkerShelterArtClass(room.round.shelter);
  return <main className={`bunker-game room-theme-${room.themeId || 'ghp'}`}><Header navigate={navigate} gameTitle="Бункер" brandTheme={room.themeId || 'ghp'} right={<strong className="timer">{formatTime(room.round.endsAt - now)}</strong>} /><div className="play-layout wrap bunker-play"><section className="section bunker-crisis"><span className="eyebrow">Раунд {room.round.number} · обсуждение</span><h1 className="play-title">Докажите, что нужны убежищу</h1><p>{room.round.catastrophe}</p>{room.round.scenarioGoal && <div className="bunker-scenario-goal"><b>Цель партии</b><span>{room.round.scenarioGoal}</span></div>}<div className={`bunker-shelter ${shelterArt}`}><b>Убежище</b><span>{room.round.shelter}</span><small>Мест: {room.round.shelterCapacity}. Сейчас претендентов: {contestants.length}.</small></div>{publicMode && <BunkerPublicCards room={room} />}</section><aside className="section controls bunker-player-card"><h2>{publicMode ? 'Ваша полная карточка' : 'Ваша карточка'}</h2>{card ? <BunkerCard card={card} /> : <p className="waiting-host">Если карточка скрыта, откройте её через обновление страницы или дождитесь следующего раунда.</p>}<BunkerScoreLine room={room} />{error && <ErrorText text={error} />}</aside></div></main>;
}

export function BunkerVoting({ room, me, action, navigate, now, error }) {
  const eliminated = new Set(room.round.eliminatedIds || []);
  const canVote = !eliminated.has(me.id);
  const candidates = room.players.filter((player) => player.id !== me.id && player.online && !eliminated.has(player.id) && (!room.round.voteCandidateIds || room.round.voteCandidateIds.includes(player.id)));
  return <main className={`bunker-game room-theme-${room.themeId || 'ghp'}`}><Header navigate={navigate} gameTitle="Бункер" brandTheme={room.themeId || 'ghp'} right={<strong className="timer">{formatTime(room.round.votingEndsAt - now)}</strong>} /><section className="vote wrap bunker-vote"><span className="eyebrow">{room.round.voteRound > 1 ? 'Переголосование' : 'Совет убежища'}</span><h1 className="play-title">Кто не проходит в бункер?</h1><p>Голосуйте за игрока, чья карточка кажется компании менее полезной для выживания.</p>{canVote ? <div className="vote-list">{candidates.map((player) => <button className={room.round.myVote === player.id ? 'selected' : ''} key={player.id} onClick={() => action('vote', { targetId: player.id })}>{player.name}</button>)}</div> : <p className="waiting-host">Вы уже вне отбора и ждёте решения остальных.</p>}<p>Проголосовали: {room.round.votesCount} из {bunkerContestants(room).length} претендентов</p>{error && <ErrorText text={error} />}</section></main>;
}

export function BunkerResult({ room, isHost, action, leave, navigate }) {
  const result = room.round.result || {};
  const matchFinished = room.state === 'match_result';
  const eliminatedName = room.players.find((player) => player.id === result.eliminatedId)?.name;
  const savedNames = (result.savedIds || []).map((id) => room.players.find((player) => player.id === id)?.name).filter(Boolean);
  const shelterArt = bunkerShelterArtClass(room.round.shelter);
  return <main className={`game bunker-game room-theme-${room.themeId || 'ghp'}`}><Header navigate={navigate} gameTitle="Бункер" brandTheme={room.themeId || 'ghp'} right={<span className="badge">{matchFinished ? 'Финал' : 'Итог голосования'}</span>} /><section className={`role result-card bunker-result-card ${matchFinished ? 'match-finished' : ''}`}><span className="eyebrow">{matchFinished ? 'Бункер закрывается' : 'Совет решил'}</span><h1>{matchFinished ? 'Состав убежища выбран' : eliminatedName ? `${eliminatedName} остаётся снаружи` : 'Ничья спасла всех'}</h1><p>{matchFinished ? `Мест в убежище: ${room.round.shelterCapacity}. Внутрь проходят: ${savedNames.join(', ') || 'оставшиеся игроки'}.` : eliminatedName ? 'Раунд завершён. Оставшиеся продолжают спор за место в убежище.' : 'Голоса снова разделились, поэтому в этом раунде никто не исключён.'}</p><div className={`mvp-result-summary ${shelterArt}`}><b>{room.round.catastrophe}</b><span>{room.round.scenarioGoal || room.round.shelter}</span><small>{room.round.shelter}</small></div><BunkerScoreLine room={room} />{result.voteCounts && <VoteResults counts={result.voteCounts} players={room.players} />}{room.matchHistory?.length > 0 && <div className="match-history"><b>Исключения</b>{room.matchHistory.slice(0, 5).map((item) => <span key={`${item.round}-${item.at}`}>Раунд {item.round}: {room.players.find((player) => player.id === item.eliminatedId)?.name || 'никто'} · осталось {item.savedCount}</span>)}</div>}{isHost ? <button className="button primary full" onClick={() => action(matchFinished ? 'new_match' : 'next_round')}>{matchFinished ? 'Новый матч' : 'Следующее обсуждение'}</button> : <p className="waiting-host">Ждём хоста: он продолжит отбор или начнёт новый матч.</p>}<button className="link danger leave" onClick={leave}>Выйти из комнаты</button></section></main>;
}

export function BunkerScoreLine({ room }) {
  const contestants = room.round ? bunkerContestants(room).length : room.players.filter((player) => player.online).length;
  const capacity = room.round?.shelterCapacity || Math.max(2, Math.floor(contestants / 2));
  return <div className="score-line bunker-score-line"><span>Претенденты: {contestants}</span><span>Мест: {capacity}</span></div>;
}

export function BunkerHostSettings({ room, catalog = {}, profile, update, changeGame, themeSettings }) {
  const revealMode = room.settings.revealMode || 'private_table';
  const packs = catalog.bunkerContentPacks?.length ? catalog.bunkerContentPacks : bunkerContentPackOptions.map((pack) => ({ ...pack, tier: pack.id === 'classic' ? 'free' : 'premium' }));
  const hasAccess = hasRoomContentAccess(profile, 'bunker');
  return <section className="section settings alias-host-panel bunker-host-panel"><h2>Бункер</h2><GameSwitcher gameId={room.gameId} changeGame={changeGame} /><details className="settings-group" open><summary><span>Настройки раунда</span><small>{room.settings.roundSeconds / 60} мин · {room.settings.votingSeconds} сек</small></summary><Setting label="Режим вскрытия"><select value={revealMode} onChange={(event) => update({ revealMode: event.target.value })}><option value="private_table">Личная карточка на стол</option><option value="public_turns">Вскрытие по очереди</option></select></Setting><Setting label="Набор событий"><select value={room.settings.contentPackId || 'classic'} onChange={(event) => update({ contentPackId: event.target.value })}>{packs.map((pack) => { const locked = pack.tier !== 'free' && !pack.free && !hasAccess; return <option key={pack.id} value={pack.id} disabled={locked}>{pack.name} · {locked ? 'Bunker Pass' : pack.badge || (pack.tier === 'free' ? 'включён' : 'открыт')}</option>; })}</select></Setting><Setting label="Обсуждение"><select value={room.settings.roundSeconds} onChange={(event) => update({ roundSeconds: Number(event.target.value) })}><option value="180">3 минуты</option><option value="300">5 минут</option><option value="420">7 минут</option></select></Setting><Setting label="Голосование"><select value={room.settings.votingSeconds} onChange={(event) => update({ votingSeconds: Number(event.target.value) })}><option value="30">30 секунд</option><option value="45">45 секунд</option><option value="60">60 секунд</option></select></Setting><p className="settings-note">{revealMode === 'public_turns' ? 'Игроки по очереди вскрывают выбранные поля. Все видят, что раскрыто, а что оставлено скрытым.' : 'Игрок решает, какие поля показать компании со своего телефона.'}</p>{!hasAccess && <p className="settings-note">Bunker Pass, WeekendPass или PRO откроет дополнительные сценарии катастроф и тематические паки.</p>}</details>{themeSettings}</section>;
}

export function BunkerRulesModal({ close }) {
  return <div className="backdrop" onMouseDown={close}><section className="modal rules-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><div><span className="eyebrow">Перед первой игрой</span><h2>Как играть в Бункер</h2></div><button className="close" onClick={close}>×</button></div><ol><li><b>Выберите режим вскрытия</b><span>В личном режиме игрок сам показывает поля на своём телефоне. В публичном режиме раскрытые поля видны у всех.</span></li><li><b>Открывайте не всё сразу</b><span>Профессию и возраст можно раскрыть, болезни, цель или факт оставить скрытыми до спора.</span></li><li><b>Исключайте голосованием</b><span>После обсуждения компания выбирает, кто не проходит в убежище.</span></li></ol><p className="guest-name-note">Перед раундом все игроки увидят короткое пояснение выбранного режима и нажмут «Принять».</p><button className="button primary full" onClick={close}>Понятно, играем</button></section></div>;
}
