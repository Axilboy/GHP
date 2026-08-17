import { getOrCreateDisplayName } from '../../identity';
import { Header, SubscriptionBadge, VersionBadge } from '../../shared/Header';
import { Counter, ErrorText, GameSwitcher, JoinModal, SeoLinks, Setting } from '../../shared/ui';
import { LandingAccessShowcase, LandingPlaybook } from '../../shared/Landing';
import { hasProAccess, hasRoomContentAccess, hasThemedContentAccess } from '../../shared/helpers';
import { GameShell, LeaveLink, TimerBadge } from '../engine/GameShell';

export function AliasLanding({ create, join, joinOpen, closeJoin, onJoin, error, navigate, profile }) {
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

export function AliasGame({ room, isHost, action, leave, navigate, now, error }) {
  if (room.round?.phase === 'alias_turn') return <AliasTurn room={room} isHost={isHost} action={action} navigate={navigate} now={now} error={error} />;
  return <AliasResult room={room} isHost={isHost} action={action} leave={leave} navigate={navigate} />;
}

export function AliasTurn({ room, isHost, action, navigate, now, error }) {
  return <GameShell gameId="alias" room={room} navigate={navigate} className="alias-game" right={<TimerBadge endsAt={room.round.endsAt} now={now} />}><section className="alias-play wrap"><span className="eyebrow">Ходит {room.round.teamName}</span><h1>{room.round.word}</h1><p>Объясняйте вслух. Само слово и однокоренные лучше не произносить, спорные моменты решайте по-дружески.</p><div className="alias-turn-stats"><article><b>{room.round.correct}</b><span>угадали</span></article><article><b>{room.round.skipped}</b><span>пас</span></article></div><div className="alias-actions"><button className="button primary" onClick={() => action('alias_mark_word', { result: 'correct' })}>Угадали</button><button className="button secondary" onClick={() => action('alias_mark_word', { result: 'skip' })}>Пас</button></div>{isHost && <button className="link danger alias-finish" onClick={() => action('alias_finish_turn')}>Завершить ход</button>}{error && <ErrorText text={error} />}<AliasScoreboard scores={room.scores} teams={room.aliasTeams} target={room.settings.targetScore} /></section></GameShell>;
}

export function AliasResult({ room, isHost, action, leave, navigate }) {
  const result = room.round.result;
  const matchFinished = room.state === 'match_result';
  const winnerName = matchFinished ? aliasWinnerName(room) : result.teamName;
  const continueGame = () => action(matchFinished ? 'new_match' : 'next_round');
  return <GameShell gameId="alias" room={room} navigate={navigate} className="game alias-game" right={<span className="badge">{matchFinished ? 'Финал' : 'Ход завершён'}</span>}><section className={`role result-card alias-result-card ${matchFinished ? 'match-finished' : ''}`}><span className="eyebrow">{matchFinished ? 'Матч завершён' : result.teamName}</span><h1>{matchFinished ? `${winnerName} победила` : `+${result.gained}`}</h1><p>{matchFinished ? `Игра дошла до ${room.settings.targetScore} очков. Можно налить воды, пересобрать команды и начать заново.` : `Команда угадала ${result.correct}, пропустила ${result.skipped}. Следующий ход переходит дальше.`}</p><AliasScoreboard scores={room.scores} teams={room.aliasTeams} target={room.settings.targetScore} />{room.matchHistory?.length > 0 && <div className="match-history"><b>Последние ходы</b>{room.matchHistory.slice(0, 5).map((item) => <span key={`${item.round}-${item.at}`}>Ход {item.round}: {item.teamName} +{item.gained}</span>)}</div>}{isHost ? <button className="button primary full" onClick={continueGame}>{matchFinished ? 'Новый матч' : 'Следующий ход'}</button> : <p className="waiting-host">Ждём хоста: он запустит следующий ход.</p>}<LeaveLink leave={leave} /></section></GameShell>;
}

export function aliasWinnerName(room) {
  const [winnerId] = Object.entries(room.scores || {}).sort((a, b) => b[1] - a[1])[0] || ['team_1'];
  return room.aliasTeams?.find((team) => team.id === winnerId)?.name || 'Команда';
}

export function AliasScoreLine({ scores }) {
  return <div className="score-line"><span>Команда 1: {scores.team_1 || 0}</span><span>Команда 2: {scores.team_2 || 0}</span></div>;
}

export function AliasScoreboard({ scores, teams = [], target }) {
  const teamOne = teams.find((team) => team.id === 'team_1')?.name || 'Команда 1';
  const teamTwo = teams.find((team) => team.id === 'team_2')?.name || 'Команда 2';
  return <div className="match-score alias-score"><div><span>{teamOne}</span><b>{scores.team_1 || 0}</b><small>{Math.max(0, target - (scores.team_1 || 0))} до победы</small></div><strong>до {target}</strong><div><span>{teamTwo}</span><b>{scores.team_2 || 0}</b><small>{Math.max(0, target - (scores.team_2 || 0))} до победы</small></div></div>;
}

export function AliasHostSettings({ room, catalog = {}, profile, update, changeGame, themeSettings }) {
  const teams = buildAliasPreviewTeams(room.players.filter((player) => player.online));
  const aliasDictionaries = catalog.aliasDictionaries?.length ? catalog.aliasDictionaries : [{ id: 'everyday', name: 'На каждый день', free: true, wordCount: 96 }, { id: 'party', name: 'Для вечеринки', free: true, wordCount: 64 }];
  const hasAccess = hasRoomContentAccess(profile, 'alias');
  const owned = new Set(aliasDictionaries.filter((dictionary) => hasThemedContentAccess(profile, 'alias', dictionary)).map((dictionary) => dictionary.id));
  const selectedIds = room.settings.dictionaryIds?.length ? room.settings.dictionaryIds : ['everyday'];
  const toggleDictionary = (id) => {
    if (!owned.has(id)) return;
    const nextIds = selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id];
    if (nextIds.length) update({ dictionaryIds: nextIds });
  };
  return <section className="section settings alias-host-panel"><h2>Alias</h2><GameSwitcher gameId={room.gameId} changeGame={changeGame} truthDareLocked={!hasProAccess(profile)} /><details className="settings-group" open><summary><span>Настройки раунда</span><small>{room.settings.roundSeconds} сек · до {room.settings.targetScore}</small></summary><Setting label="Ход"><select value={room.settings.roundSeconds} onChange={(event) => update({ roundSeconds: Number(event.target.value) })}><option value="60">60 секунд</option><option value="90">90 секунд</option><option value="120">120 секунд</option></select></Setting><Setting label="Победа"><Counter value={room.settings.targetScore} min={10} max={50} change={(targetScore) => update({ targetScore })} /></Setting></details><details className="settings-group"><summary><span>Словари Alias</span><small>{selectedIds.length} выбрано</small></summary><div className="dictionary-checklist">{aliasDictionaries.map((dictionary) => <label key={dictionary.id} className={!owned.has(dictionary.id) ? 'locked' : ''}><input type="checkbox" checked={selectedIds.includes(dictionary.id)} disabled={!owned.has(dictionary.id)} onChange={() => toggleDictionary(dictionary.id)} /><span><b>{dictionary.name}</b><small>{dictionary.wordCount || 0} слов · {owned.has(dictionary.id) ? 'доступен' : 'пропуск или Alias Pass'}</small></span></label>)}</div>{!hasAccess && <p className="settings-note">Тематический пропуск откроет свою тему, а Alias Pass, WeekendPass или PRO откроет всю библиотеку Alias.</p>}{!hasProAccess(profile) && <p className="settings-note">Создание комнаты для «Правды или действия» входит в PRO.</p>}</details><div className="alias-team-preview">{teams.map((team) => <article key={team.id}><b>{team.name}</b><span>{team.players.map((player) => player.name).join(', ') || 'Ждём игроков'}</span></article>)}</div>{themeSettings}</section>;
}

export function buildAliasPreviewTeams(players) {
  return [
    { id: 'team_1', name: 'Команда 1', players: players.filter((_, index) => index % 2 === 0) },
    { id: 'team_2', name: 'Команда 2', players: players.filter((_, index) => index % 2 === 1) },
  ];
}

export function AliasRulesModal({ close }) {
  return <div className="backdrop" onMouseDown={close}><section className="modal rules-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><div><span className="eyebrow">Перед первой игрой</span><h2>Как играть в Alias</h2></div><button className="close" onClick={close}>×</button></div><ol><li><b>Команда объясняет слово</b><span>Один игрок объясняет вслух, остальные угадывают. Само слово и однокоренные не называем.</span></li><li><b>Телефон считает темп</b><span>Нажимайте «Угадали» или «Пас». Ход закончится по таймеру.</span></li><li><b>Побеждает команда</b><span>Очки идут за угаданные слова. Спорные моменты решайте быстро, без затяжного суда.</span></li></ol><p className="guest-name-note">Меньше настроек, больше живой компании.</p><button className="button primary full" onClick={close}>Понятно, играем</button></section></div>;
}
