import { useState } from 'react';
import { getOrCreateDisplayName } from '../../identity';
import { Header, SubscriptionBadge, VersionBadge } from '../../shared/Header';
import { AdBreakModal, ErrorText, JoinModal, ScanIcon, SeoLinks, VkStatus, VoteResults } from '../../shared/ui';
import { LandingAccessShowcase, LandingPlaybook } from '../../shared/Landing';
import { formatTime } from '../../shared/helpers';
import { GameShell, PhaseScreen, ProgressNote, SecretCard, TimerBadge, VotePanel, WaitingNote } from '../engine/GameShell';

export function spySubjectCopy(subjectType = 'location') {
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

export function dictionaryCount(dictionary) {
  return `${dictionary.locationCount || 0} ${dictionary.countLabel || (dictionary.subjectType === 'item' ? 'предметов' : 'локаций')}`;
}

export function SpyLanding({ create, join, joinOpen, closeJoin, onJoin, error, navigate, vkLaunch, profile }) {
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

export function SpyModeTip({ subjectType }) {
  if (subjectType !== 'item') return null;
  const copy = spySubjectCopy(subjectType);
  return <p className="settings-note"><b>{copy.modeTipTitle}.</b> {copy.modeTip}</p>;
}

export function RoleReveal({ room, card, revealRole, action, isHost, navigate, error }) {
  const copy = spySubjectCopy(room.round.subjectType || room.settings.subjectType);
  return <GameShell gameId="spy" room={room} navigate={navigate} gameTitle="Шпион" right={<span className="badge">Раунд {room.round.number}</span>}><PhaseScreen variant="focus" className="role-reveal-screen" eyebrow="Секретная карточка" title={card ? 'Запомните роль' : 'Откройте роль'} lead={card ? 'После просмотра скройте карту. Остальные игроки не должны видеть экран.' : 'Карта лежит лицом вниз. Нажмите на неё и покажите экран только себе.'}><SecretCard className="secret-role-card" revealed={Boolean(card)} onReveal={revealRole} ariaLabel={card ? 'Открытая роль' : 'Открыть секретную карту'} back={{ label: 'Нажмите, чтобы посмотреть', hint: 'Покажите экран только себе' }} front={{ kicker: card?.isSpy ? 'Ваша роль' : copy.yourSecret, title: card ? card.isSpy ? 'Вы шпион' : card.location : '', note: card ? card.isSpy ? 'Не выдайте себя' : `Роль: ${card.role || 'секрет'}` : '' }} />{card && <><p className="role-card-hint">{card.isSpy ? copy.spyHint : 'Отвечайте аккуратно и найдите шпиона.'}</p><button className="button primary full" onClick={() => action('role_seen')}>Скрыть карту</button></>}{error && <ErrorText text={error} />}<ProgressNote>Роли открыли: {room.round.seenCount} из {room.players.filter((player) => player.online).length} онлайн</ProgressNote></PhaseScreen></GameShell>;
}

export function Discussion({ room, card, action, navigate, now, error }) {
  const [guessOpen, setGuessOpen] = useState(false);
  const [voteRequested, setVoteRequested] = useState(false);
  const copy = spySubjectCopy(room.round.subjectType || room.settings.subjectType);
  const onlineCount = room.players.filter((player) => player.online).length;
  // Сервер начинает голосование, когда о нём просит больше половины онлайн-игроков.
  const votesNeeded = Math.floor(onlineCount / 2) + 1;
  const votesAsked = room.round.voteStartRequestsCount || 0;
  const callVote = () => action('request_vote').then(() => setVoteRequested(true)).catch(() => {});
  return <GameShell gameId="spy" room={room} navigate={navigate} gameTitle="Шпион" right={<TimerBadge endsAt={room.round.endsAt} now={now} />}><div className="play-layout wrap"><section className="section"><span className="eyebrow">Обсуждение · раунд {room.round.number}</span><h1 className="play-title">{room.round.subjectType === 'item' ? 'Вычислите вещь и шпиона' : 'Найдите шпиона'}</h1><p>{copy.discussionHint}</p></section><aside className="section controls"><h2>Действия</h2><button className="button call-vote full" disabled={voteRequested} onClick={callVote}>ШПИОН!</button><small className="call-vote-note">{voteRequested ? `Вы просите голосование. Уже просят: ${votesAsked} из ${votesNeeded}.` : `Прервать обсуждение и голосовать. Нужно ${votesNeeded} из ${onlineCount} игроков${votesAsked ? `, уже просят ${votesAsked}` : ''}.`}</small>{card?.isSpy && room.settings.allowSpyGuess && <button className="button primary full" onClick={() => setGuessOpen(true)}>Остановить и ответить</button>}<WaitingNote>Когда время закончится, голосование начнётся автоматически.</WaitingNote><div className="score-line"><span>Мирные: {room.scores.civilians}</span><span>Шпионы: {room.scores.spies}</span></div>{error && <ErrorText text={error} />}</aside></div>{guessOpen && <GuessModal room={room} action={action} close={() => setGuessOpen(false)} />}</GameShell>;
}

export function GuessModal({ room, action, close }) {
  const copy = spySubjectCopy(room.round.subjectType || room.settings.subjectType);
  const submit = () => action('spy_guess').then(close).catch(() => {});
  return <div className="backdrop" onMouseDown={close}><section className="modal location-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><div><h2>{copy.guessAction}</h2><p>Игра остановится. После этого назовите ответ вслух, а мирные проголосуют, засчитывать его или нет.</p></div><button className="close" onClick={close}>×</button></div><div className="guess-answer-card"><span>Порядок действия</span><b>1. Нажмите кнопку<br />2. Назовите ответ вслух<br />3. Мирные голосуют</b><small>В телефоне ответ не вводится, чтобы игра оставалась живым спором компании.</small></div><button className="button primary full" onClick={submit}>Остановить игру и ответить</button><button className="button secondary full" onClick={close}>Продолжить обсуждение</button></section></div>;
}

export function GuessReview({ room, me, isHost, action, navigate, now, error }) {
  const copy = spySubjectCopy(room.round.subjectType || room.settings.subjectType);
  const isSpy = room.round.amSpy;
  const activeCivilians = room.players.filter((player) => player.online).length - (room.round.spyCount || 1);
  const spyName = room.players.find((player) => player.id === room.round.spyGuess?.spyId)?.name || 'Шпион';
  const alreadyVoted = room.round.mySpyGuessVote !== null && room.round.mySpyGuessVote !== undefined;
  return <GameShell gameId="spy" room={room} navigate={navigate} gameTitle="Шпион" right={<TimerBadge endsAt={room.round.votingEndsAt} now={now} />}><PhaseScreen className="guess-review" eyebrow="Ответ Шпиона" title={copy.reviewTitle}><p><b>{spyName}</b> остановил игру и называет ответ вслух. Мирные решают, достаточно ли точно он назвал {copy.secretName}.</p><div className="guess-answer-card"><span>Проверка вслух</span><b>Засчитать ответ Шпиона?</b><small>Решают только мирные игроки. Шпион ждёт итог голосования.</small></div>{isSpy ? <WaitingNote>Назовите ответ вслух. Мирные сейчас проголосуют.</WaitingNote> : <div className="vote-list two-actions"><button className={room.round.mySpyGuessVote === true ? 'selected' : ''} disabled={alreadyVoted} onClick={() => action('spy_guess_vote', { accepted: true })}>Засчитать</button><button className={room.round.mySpyGuessVote === false ? 'selected danger-choice' : ''} disabled={alreadyVoted} onClick={() => action('spy_guess_vote', { accepted: false })}>Не засчитывать</button></div>}<p>Проголосовали: {room.round.spyGuessVotesCount} из {activeCivilians} мирных онлайн</p>{error && <ErrorText text={error} />}</PhaseScreen></GameShell>;
}

export function Voting({ room, me, isHost, action, navigate, now, error }) {
  const candidates = room.players.filter((player) => player.id !== me.id && player.online && (!room.round.voteCandidateIds || room.round.voteCandidateIds.includes(player.id)));
  return <GameShell gameId="spy" room={room} navigate={navigate} gameTitle="Шпион" right={<TimerBadge endsAt={room.round.votingEndsAt} now={now} />}><PhaseScreen eyebrow={room.round.voteRound > 1 ? 'Переголосование' : 'Голосование'} title="Кто шпион?" lead={room.round.voteRound > 1 ? 'Голоса разделились. Выберите одного из лидеров.' : 'Выберите одного игрока. При повторной ничьей шпион победит.'}><VotePanel candidates={candidates} myVote={room.round.myVote} onVote={(player) => action('vote', { targetId: player.id })} /><p>Проголосовали: {room.round.votesCount} из {room.players.filter((player) => player.online).length} онлайн</p>{error && <ErrorText text={error} />}</PhaseScreen></GameShell>;
}

export function Result({ room, isHost, action, leave, navigate }) {
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
  return <GameShell gameId="spy" room={room} navigate={navigate} gameTitle="Шпион" right={<span className="badge">{matchFinished ? 'Матч завершён' : 'Раунд завершён'}</span>}><section className={`role phase-screen result-card ${matchFinished ? 'match-finished' : ''}`}><span className="eyebrow">{matchFinished ? 'Финал матча' : winnerTitle}</span><h1>{matchFinished ? (result.winner === 'civilians' ? 'Мирные победили' : 'Шпионы победили') : result.locationName}</h1><p>{matchFinished ? `Матч завершён со счётом ${room.scores.civilians}:${room.scores.spies}. ${copy.matchLabel}: ${result.locationName}.` : reason}</p><div className="mvp-result-summary"><b>{result.winner === 'civilians' ? 'Компания раскрыла угрозу' : 'Шпион обманул компанию'}</b><span>{matchFinished ? 'Матч записан в профиль, можно начать заново.' : 'Раунд засчитан, статистика игроков обновлена.'}</span></div><Scoreboard scores={room.scores} target={room.settings.targetScore} /><div className="result-facts"><article><span>{copy.resultLabel}</span><b>{result.locationName}</b></article><article><span>{spies.length > 1 ? 'Шпионы' : 'Шпион'}</span><b>{spies.join(', ') || 'Неизвестно'}</b></article>{votedOut && <article><span>Выбывал</span><b>{votedOut}</b></article>}</div>{result.voteCounts && <VoteResults counts={result.voteCounts} players={room.players} />}{result.spyGuessVotes && <SpyGuessVoteResults votes={result.spyGuessVotes} />}{room.matchHistory?.length > 0 && <MatchHistory history={room.matchHistory} />}{isHost ? <div className="result-actions"><button className="button primary full" onClick={continueAfterResult}>{matchFinished ? 'Начать новый матч' : 'Следующий раунд'}</button><small>{room.adPolicy?.adFree ? 'PRO-доступ в комнате убирает рекламную паузу.' : matchFinished ? 'Счёт сбросится, игроки вернутся в лобби.' : 'Игроки вернутся в лобби после короткой паузы.'}</small></div> : <p className="waiting-host">Ждём хоста: он вернёт всех в лобби или начнёт новый матч.</p>}<button className="link danger leave" onClick={leave}>Выйти из комнаты</button></section>{adBreak && <AdBreakModal {...adBreak} close={() => setAdBreak(null)} />}</GameShell>;
}

export function Scoreboard({ scores, target }) {
  return <div className="match-score"><div><span>Мирные</span><b>{scores.civilians}</b><small>{Math.max(0, target - scores.civilians)} до победы</small></div><strong>до {target}</strong><div><span>Шпионы</span><b>{scores.spies}</b><small>{Math.max(0, target - scores.spies)} до победы</small></div></div>;
}

export function SpyGuessVoteResults({ votes }) {
  return <div className="vote-results"><b>Проверка ответа Шпиона</b><span>Засчитать: {votes.yes}</span><span>Не засчитывать: {votes.no}</span></div>;
}

export function MatchHistory({ history }) {
  return <div className="match-history"><b>История матча</b>{history.slice(0, 5).map((item) => <span key={`${item.round}-${item.at}`}>Раунд {item.round}: {item.winner === 'civilians' ? 'мирные' : 'шпионы'} · {item.locationName}</span>)}</div>;
}

export function RulesModal({ close }) {
  return <div className="backdrop" onMouseDown={close}><section className="modal rules-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><div><span className="eyebrow">Перед первой игрой</span><h2>Как играть в «Шпиона»</h2></div><button className="close" onClick={close}>×</button></div><ol><li><b>Откройте секретную роль</b><span>Мирные узнают место или предмет, а шпион — нет.</span></li><li><b>Задавайте вопросы по очереди</b><span>Отвечайте осторожно, чтобы не раскрыть секрет.</span></li><li><b>Найдите шпиона</b><span>Голосуйте, когда будете готовы. При ничьей будет второй тур.</span></li></ol><p className="guest-name-note">Если игрок отключится, игра продолжится без него. После возвращения он снова сможет участвовать.</p><button className="button primary full" onClick={close}>Понятно, я готов</button></section></div>;
}
