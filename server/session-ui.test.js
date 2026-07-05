import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appSource = readFileSync('src/App.jsx', 'utf8');
const serverSource = readFileSync('server/index.js', 'utf8')
  + readFileSync('server/routes/admin.js', 'utf8')
  + readFileSync('server/routes/feedback.js', 'utf8')
  + readFileSync('server/routes/auth.js', 'utf8');
const indexSource = readFileSync('index.html', 'utf8');
const stylesSource = readFileSync('src/styles.css', 'utf8');

test('initial browser tab uses neutral app title and favicon', () => {
  assert.match(indexSource, /<title>GameHubParty/);
  assert.doesNotMatch(indexSource, /<title>Шпион/);
  assert.match(indexSource, /href="\/favicon\.svg"/);
  assert.match(indexSource, /rel="shortcut icon"/);
});

test('side menu exposes feedback instead of internal service links', () => {
  const headerSource = appSource.slice(
    appSource.indexOf('function Header'),
    appSource.indexOf('function VersionBadge'),
  );
  assert.match(headerSource, /FeedbackModal/);
  assert.match(headerSource, /Обратная связь/);
  assert.doesNotMatch(headerSource, /Статус и обновления/);
  assert.doesNotMatch(headerSource, /Версия для VK/);
});

test('feedback form posts to support endpoint and server stores messages', () => {
  assert.match(appSource, /\/api\/feedback/);
  assert.match(appSource, /support@gamehubparty\.ru/);
  assert.match(appSource, /Тип обращения/);
  assert.match(appSource, /<select value=\{topic\}/);
  assert.match(serverSource, /post\('\/feedback'/);
  assert.match(serverSource, /feedback\.jsonl/);
  assert.match(serverSource, /sendFeedbackEmail/);
});

test('store asks guests to sign in before purchases', () => {
  const storeSource = readFileSync('src/RoadmapPanels.jsx', 'utf8');
  assert.match(storeSource, /\/api\/auth\/request-code/);
  assert.match(storeSource, /\/api\/auth\/verify-code/);
  assert.match(storeSource, /Войдите или зарегистрируйтесь/);
  assert.match(storeSource, /Покупки, чеки и восстановление доступа/);
});

test('profile supports account editing and access dates without sign out clutter', () => {
  assert.match(appSource, /avatar-edit/);
  assert.match(appSource, /AvatarCropModal/);
  assert.match(appSource, /cropAvatarImage/);
  assert.match(appSource, /type="range"/);
  assert.match(appSource, /type="file"/);
  assert.match(appSource, /update_profile/);
  assert.match(appSource, /profile-id/);
  assert.match(appSource, /profileAccessList/);
  assert.match(appSource, /profile-access-list/);
  assert.doesNotMatch(appSource, /signOutAccount/);
});

test('admin players are registered-only and searchable', () => {
  assert.match(appSource, /admin-search/);
  assert.match(appSource, /filteredProfiles/);
  assert.match(serverSource, /registeredProfiles/);
});

test('free rooms use Adsterra ad slots', () => {
  assert.match(appSource, /LobbyPlayerAdBanner/);
  assert.match(appSource, /lobby_player_banner/);
  assert.match(appSource, /spy_pre_round_interstitial/);
  assert.match(appSource, /spy_between_rounds_interstitial/);
  assert.match(appSource, /AdsterraBanner/);
  assert.match(appSource, /doc\.write/);
  assert.match(appSource, /adsterra-script-slot/);
  assert.doesNotMatch(appSource, /srcDoc=\{adHtml\}/);
  assert.match(appSource, /adsterra-host-frame/);
  assert.doesNotMatch(appSource, /sandbox=/);
  assert.match(appSource, /d5c1fe703354df9437609dcf4bea1ac7/);
  assert.match(appSource, /464f545a84d6f512006bbbae88f7450a/);
  assert.match(appSource, /adsterra-fallback/);
  assert.doesNotMatch(appSource, /Баннер не загрузился/);
  assert.doesNotMatch(appSource, /InternalAdFallback/);
  assert.match(appSource, /seconds: 5/);
  assert.match(appSource, /<LobbyPlayerAdBanner adPolicy=\{room\.adPolicy\}/);
  assert.match(serverSource, /provider: 'adsterra'/);
  assert.match(serverSource, /placements: sponsor \? \[\] : \['pre_round', 'post_round', 'lobby_player_banner'\]/);
});

test('bunker shelters use generated cover variants', () => {
  assert.match(appSource, /function bunkerShelterArtClass/);
  assert.match(appSource, /className=\{`bunker-shelter \$\{shelterArt\}`\}/);
  assert.match(appSource, /className=\{`mvp-result-summary \$\{shelterArt\}`\}/);
  [
    'ghp-shelter-sanatorium.webp',
    'ghp-shelter-metro-lab.webp',
    'ghp-shelter-military-depot.webp',
    'ghp-shelter-underground-home.webp',
    'ghp-shelter-rural-cellar.webp',
    'ghp-shelter-space-module.webp',
    'ghp-shelter-ark-ship.webp',
    'ghp-shelter-dam-node.webp',
    'ghp-shelter-caravan-bunker.webp',
  ].forEach((asset) => assert.match(stylesSource, new RegExp(asset.replace('.', '\\.'))));
});

test('game landings include native pass and pro showcases', () => {
  assert.match(appSource, /function LandingAccessShowcase/);
  assert.match(appSource, /function LandingPlaybook/);
  assert.match(appSource, /<LandingAccessShowcase game="spy"/);
  assert.match(appSource, /<LandingAccessShowcase game="alias"/);
  assert.match(appSource, /<LandingAccessShowcase game="bunker"/);
  assert.match(appSource, /Spy Pass/);
  assert.match(appSource, /Alias Pass/);
  assert.match(appSource, /Bunker Pass/);
  assert.match(stylesSource, /Landing commerce refresh/);
  assert.match(stylesSource, /landing-access-grid/);
});

test('lobby is cleaner for players and host controls are grouped', () => {
  assert.match(appSource, /project-logo/);
  assert.match(appSource, /GameHub/);
  assert.doesNotMatch(appSource, /brandTheme === 'partyhub'/);
  assert.match(appSource, /gameTitle="Шпион"/);
  assert.match(appSource, /gamehubparty:create-room/);
  assert.match(appSource, /function LobbyGameSummary/);
  assert.doesNotMatch(appSource, /function PlayerSettings/);
  assert.match(appSource, /host-control-panel/);
  assert.match(appSource, /settings-group/);
  assert.match(appSource, /dictionary-checklist/);
});

test('admin can bulk grant and revoke Spy Pass', () => {
  assert.match(appSource, /Выдать Spy Pass/);
  assert.match(appSource, /Забрать Spy Pass/);
  assert.match(appSource, /productId: 'spy_pass'/);
  assert.ok(appSource.indexOf('<AdminOrders') < appSource.indexOf('<AdminPlayers'));
});

test('room themes stay hidden in store while lobby sharing remains wired', () => {
  const storeSource = readFileSync('src/RoadmapPanels.jsx', 'utf8');
  const profileSource = readFileSync('server/profileStore.js', 'utf8');
  assert.doesNotMatch(storeSource, /store-theme-section/);
  assert.match(storeSource, /ThemeCard/);
  assert.match(appSource, /RoomThemePanel/);
  assert.match(appSource, /room-theme-\$\{room\.themeId/);
  assert.match(appSource, /suggest_room_theme/);
  assert.match(appSource, /accept_room_theme/);
  assert.match(serverSource, /apply_room_theme/);
  assert.match(serverSource, /suggest_room_theme/);
  assert.match(serverSource, /accept_room_theme/);
  assert.match(profileSource, /ownedThemeIds/);
  assert.match(profileSource, /type === 'theme'/);
});

test('saved room opens as a return banner instead of automatic lobby resume', () => {
  assert.match(appSource, /normalizePausedSession\(sessionKey, playerId\)/);
  assert.match(appSource, /SessionReturnBanner/);
  assert.match(appSource, /returnToSession/);
  assert.match(appSource, /status: 'paused'/);
  assert.doesNotMatch(appSource, /if \(session\?\.roomId\) \{\s*emit\('resume_room'/);
});

test('room navigation uses the custom exit intent instead of browser confirm', () => {
  assert.match(appSource, /SessionExitModal/);
  assert.match(appSource, /setExitIntent\(\{ targetView \}\)/);
  assert.doesNotMatch(appSource, /window\.confirm\('Выйти из комнаты/);
});

test('invite QR deep links open a working join modal on every landing', () => {
  assert.match(appSource, /new URLSearchParams\(location\.search\)\.get\('room'\)/);
  assert.match(appSource, /QRCode\.toDataURL\(inviteUrl/);
  assert.match(appSource, /<JoinModal initialName=\{name\} close=\{closeJoin\} join=\{onJoin\}/);
  assert.doesNotMatch(appSource, /<JoinModal close=\{closeJoin\} onJoin=\{onJoin\}/);
});

test('discussion screen stays focused on timer and spy answer only', () => {
  assert.doesNotMatch(appSource, /Первым задаёт вопрос/);
  assert.doesNotMatch(appSource, /Показать мою карточку/);
  assert.doesNotMatch(appSource, /Начать голосование за шпиона/);
  assert.doesNotMatch(appSource, /Предложить голосование/);
  assert.doesNotMatch(appSource, /Завершить без результата/);
  assert.doesNotMatch(appSource, /Завершить раунд без результата/);
});

test('role reveal starts with a face-down card', () => {
  const roleRevealSource = appSource.slice(
    appSource.indexOf('function RoleReveal'),
    appSource.indexOf('function Discussion'),
  );
  assert.match(roleRevealSource, /secret-role-card/);
  assert.match(roleRevealSource, /Нажмите, чтобы посмотреть/);
  assert.match(roleRevealSource, /Покажите экран только себе/);
  assert.doesNotMatch(roleRevealSource, /Показать роль/);
  assert.doesNotMatch(roleRevealSource, /Открыть карту/);
  assert.match(roleRevealSource, /Скрыть карту/);
});
