import { Header } from '../../shared/Header';
import { formatTime } from '../../shared/helpers';

export const gameTitles = {
  spy: 'Шпион',
  alias: 'Alias',
  bunker: 'Бункер',
  truthdare: 'Правда или действие',
};

// Каркас игрового экрана: шапка, тема комнаты и палитра игры через data-game.
// Новая игра или тема оформления подключается CSS-блоком .game-shell[data-game=...]
// без изменений разметки экранов.
export function GameShell({ gameId, room, navigate, gameTitle, right, className = '', children }) {
  return <main className={`game-shell room-theme-${room.themeId || 'ghp'} ${className}`} data-game={gameId}>
    <Header navigate={navigate} gameTitle={gameTitle || gameTitles[gameId]} brandTheme={room.themeId || 'ghp'} right={right} />
    {children}
  </main>;
}

export function TimerBadge({ endsAt, now }) {
  return <strong className="timer">{formatTime(Math.max(0, (endsAt || 0) - now))}</strong>;
}

// Единый контейнер фазы. variant: 'focus' — высокая центрированная карта
// (раздача роли, результат), 'panel' — обычная карточка контента (голосование, обсуждение).
export function PhaseScreen({ variant = 'panel', eyebrow, title, lead, className = '', children }) {
  const base = variant === 'focus' ? 'role phase-screen' : 'vote wrap phase-screen';
  return <section className={`${base} ${className}`}>
    {eyebrow && <span className="eyebrow">{eyebrow}</span>}
    {title && <h1 className={variant === 'focus' ? '' : 'play-title'}>{title}</h1>}
    {lead && <p className="phase-lead">{lead}</p>}
    {children}
  </section>;
}

// Список кандидатов для голосования — общий для Шпиона, Бункера и будущей Мафии.
export function VotePanel({ candidates, myVote, onVote }) {
  return <div className="vote-list">{candidates.map((player) => <button key={player.id} className={myVote === player.id ? 'selected' : ''} onClick={() => onVote(player)}>{player.name}</button>)}</div>;
}

export function ProgressNote({ children }) {
  return <p className="progress-note">{children}</p>;
}

export function WaitingNote({ children }) {
  return <p className="waiting-host">{children}</p>;
}

export function LeaveLink({ leave }) {
  return <button className="link danger leave" onClick={leave}>Выйти из комнаты</button>;
}

// Флип-карта с секретом. Скин задаётся className (например, secret-role-card
// или bunker-secret-card) — новые виды карточек добавляются только в CSS.
export function SecretCard({ className = '', revealed, onReveal, back = {}, front = {}, ariaLabel }) {
  return <button
    className={`${className} ${revealed ? 'revealed' : ''}`}
    onClick={revealed ? undefined : onReveal}
    aria-label={ariaLabel}
    disabled={Boolean(revealed)}
  >
    <span className="role-card-inner">
      <span className="role-card-face role-card-back"><b>{back.icon || '?'}</b><small>{back.label}</small>{back.hint && <em>{back.hint}</em>}</span>
      <span className="role-card-face role-card-front"><small>{front.kicker}</small><b>{front.title}</b>{front.note && <em>{front.note}</em>}</span>
    </span>
  </button>;
}
