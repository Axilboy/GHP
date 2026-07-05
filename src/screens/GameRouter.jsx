import { AliasGame } from '../games/alias/Alias';
import { BunkerGame } from '../games/bunker/Bunker';
import { Discussion, GuessReview, Result, RoleReveal, Voting } from '../games/spy/Spy';

export function Game({ room, me, isHost, card, revealRole, action, leave, navigate, catalog, now, error }) {
  const round = room.round;
  if (room.gameId === 'alias') return <AliasGame room={room} isHost={isHost} action={action} leave={leave} navigate={navigate} now={now} error={error} />;
  if (room.gameId === 'bunker') return <BunkerGame room={room} me={me} isHost={isHost} card={card} revealRole={revealRole} action={action} leave={leave} navigate={navigate} now={now} error={error} />;
  if (round.phase === 'role_reveal') return <RoleReveal room={room} card={card} revealRole={revealRole} action={action} isHost={isHost} navigate={navigate} error={error} />;
  if (round.phase === 'discussion') return <Discussion room={room} card={card} action={action} navigate={navigate} now={now} error={error} />;
  if (round.phase === 'guess_review') return <GuessReview room={room} me={me} isHost={isHost} action={action} navigate={navigate} now={now} error={error} />;
  if (round.phase === 'voting') return <Voting room={room} me={me} isHost={isHost} action={action} navigate={navigate} now={now} error={error} />;
  return <Result room={room} isHost={isHost} action={action} leave={leave} navigate={navigate} />;
}
