import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { saveGuestDisplayName } from '../identity';
import { localStore } from '../browserStorage';
import { AdvancedSpySettings } from '../RoadmapPanels';
import { Header } from '../shared/Header';
import { AdBreakModal, AdStatusCard, Counter, ErrorText, GameSwitcher, LobbyPlayerAdBanner, NameModal, Setting } from '../shared/ui';
import { getOwnedThemeSet, getRoomThemeName, hasTimedGameAccess, roomThemesFallback } from '../shared/helpers';
import { AliasHostSettings, AliasRulesModal, AliasScoreLine } from '../games/alias/Alias';
import { BunkerHostSettings, BunkerRulesModal, BunkerScoreLine, bunkerRevealModeNames } from '../games/bunker/Bunker';
import { RulesModal, SpyModeTip, dictionaryCount, spyModeNames, spySubjectCopy } from '../games/spy/Spy';

export function Lobby({ room, me, isHost, catalog, profile, action, leave, navigate, error }) {
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

export function HostSettings({ room, catalog = {}, dictionaries, themes = roomThemesFallback, profile, action }) {
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

export function LobbyGameSummary({ room, dictionaries, themes = roomThemesFallback, profile, action }) {
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

export function RoomThemePanel({ room, themes = roomThemesFallback, profile, action, isHost = false }) {
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
