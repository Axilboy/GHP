import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const headerSource = readFileSync('src/shared/Header.jsx', 'utf8');
const spySource = readFileSync('src/games/spy/Spy.jsx', 'utf8');
const adminSource = readFileSync('src/screens/Admin.jsx', 'utf8');

const clientSourceFiles = [
  'src/App.jsx',
  'src/shared/helpers.js',
  'src/shared/ui.jsx',
  'src/shared/Header.jsx',
  'src/shared/Landing.jsx',
  'src/games/engine/GameShell.jsx',
  'src/games/spy/Spy.jsx',
  'src/games/truthdare/TruthDare.jsx',
  'src/games/alias/Alias.jsx',
  'src/games/bunker/Bunker.jsx',
  'src/screens/Lobby.jsx',
  'src/screens/GameRouter.jsx',
  'src/screens/Home.jsx',
  'src/screens/Admin.jsx',
  'src/screens/Profile.jsx',
  'src/screens/Store.jsx',
  'src/screens/Legal.jsx',
  'src/screens/Demo.jsx',
  'src/screens/Vk.jsx',
  'src/screens/releaseNotes.js',
];
const clientSource = clientSourceFiles.map((file) => readFileSync(file, 'utf8')).join('\n');

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
  const headerBlock = headerSource.slice(
    headerSource.indexOf('function Header'),
    headerSource.indexOf('function VersionBadge'),
  );
  assert.match(headerBlock, /FeedbackModal/);
  assert.match(headerBlock, /Обратная связь/);
  assert.doesNotMatch(headerBlock, /Статус и обновления/);
  assert.doesNotMatch(headerBlock, /Версия для VK/);
});

test('feedback form posts to support endpoint and server stores messages', () => {
  assert.match(clientSource, /\/api\/feedback/);
  assert.match(clientSource, /support@gamehubparty\.ru/);
  assert.match(clientSource, /Тип обращения/);
  assert.match(clientSource, /<select value=\{topic\}/);
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
  assert.match(clientSource, /avatar-edit/);
  assert.match(clientSource, /AvatarCropModal/);
  assert.match(clientSource, /cropAvatarImage/);
  assert.match(clientSource, /type="range"/);
  assert.match(clientSource, /type="file"/);
  assert.match(clientSource, /update_profile/);
  assert.match(clientSource, /profile-id/);
  assert.match(clientSource, /profileAccessList/);
  assert.match(clientSource, /profile-access-list/);
  assert.doesNotMatch(clientSource, /signOutAccount/);
});

test('admin players are registered-only and searchable', () => {
  assert.match(clientSource, /admin-search/);
  assert.match(clientSource, /filteredProfiles/);
  assert.match(serverSource, /registeredProfiles/);
});

test('third-party Adsterra slots are opt-in and disabled in the default build', () => {
  assert.match(clientSource, /LobbyPlayerAdBanner/);
  assert.match(clientSource, /lobby_player_banner/);
  assert.match(clientSource, /spy_pre_round_interstitial/);
  assert.match(clientSource, /spy_between_rounds_interstitial/);
  assert.match(clientSource, /AdsterraBanner/);
  assert.match(clientSource, /AdsterraSocialBar/);
  assert.match(clientSource, /d74fd9fb9702fbaff65376cfa4eea0bd\.js/);
  assert.match(clientSource, /VITE_ADSTERRA_ENABLED === 'true'/);
  assert.match(clientSource, /ADSTERRA_ENABLED && <AdsterraBanner/);
  assert.match(clientSource, /doc\.write/);
  assert.match(clientSource, /adsterra-script-slot/);
  assert.doesNotMatch(clientSource, /srcDoc=\{adHtml\}/);
  assert.match(clientSource, /adsterra-host-frame/);
  assert.doesNotMatch(clientSource, /sandbox=/);
  assert.match(clientSource, /d5c1fe703354df9437609dcf4bea1ac7/);
  assert.match(clientSource, /464f545a84d6f512006bbbae88f7450a/);
  assert.match(clientSource, /adsterra-fallback/);
  assert.doesNotMatch(clientSource, /Баннер не загрузился/);
  assert.doesNotMatch(clientSource, /InternalAdFallback/);
  assert.match(clientSource, /seconds: 5/);
  assert.match(clientSource, /<LobbyPlayerAdBanner adPolicy=\{room\.adPolicy\}/);
  assert.match(serverSource, /provider: 'adsterra'/);
  assert.match(serverSource, /placements: sponsor \? \[\] : \['pre_round', 'post_round', 'lobby_player_banner'\]/);
});

test('bunker shelters use generated cover variants', () => {
  assert.match(clientSource, /function bunkerShelterArtClass/);
  assert.match(clientSource, /className=\{`bunker-shelter \$\{shelterArt\}`\}/);
  assert.match(clientSource, /className=\{`mvp-result-summary \$\{shelterArt\}`\}/);
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
  assert.match(clientSource, /function LandingAccessShowcase/);
  assert.match(clientSource, /function LandingPlaybook/);
  assert.match(clientSource, /<LandingAccessShowcase game="spy"/);
  assert.match(clientSource, /<LandingAccessShowcase game="alias"/);
  assert.match(clientSource, /<LandingAccessShowcase game="bunker"/);
  assert.match(clientSource, /Spy Pass/);
  assert.match(clientSource, /Alias Pass/);
  assert.match(clientSource, /Bunker Pass/);
  assert.match(stylesSource, /Landing commerce refresh/);
  assert.match(stylesSource, /landing-access-grid/);
});

test('lobby is cleaner for players and host controls are grouped', () => {
  assert.match(clientSource, /project-logo/);
  assert.match(clientSource, /GameHub/);
  assert.doesNotMatch(clientSource, /brandTheme === 'partyhub'/);
  assert.match(clientSource, /gameTitle="Шпион"/);
  assert.match(clientSource, /gamehubparty:create-room/);
  assert.match(clientSource, /function LobbyGameSummary/);
  assert.doesNotMatch(clientSource, /function PlayerSettings/);
  assert.match(clientSource, /host-control-panel/);
  assert.match(clientSource, /settings-group/);
  assert.match(clientSource, /dictionary-checklist/);
});

test('admin can bulk grant and revoke Spy Pass', () => {
  assert.match(adminSource, /Выдать Spy Pass/);
  assert.match(adminSource, /Забрать Spy Pass/);
  assert.match(adminSource, /productId: 'spy_pass'/);
  assert.ok(adminSource.indexOf('<AdminOrders') < adminSource.indexOf('<AdminPlayers'));
});

test('room themes stay hidden in store while lobby sharing remains wired', () => {
  const storeSource = readFileSync('src/RoadmapPanels.jsx', 'utf8');
  const profileSource = readFileSync('server/profileStore.js', 'utf8');
  assert.doesNotMatch(storeSource, /store-theme-section/);
  assert.match(storeSource, /ThemeCard/);
  assert.match(clientSource, /RoomThemePanel/);
  assert.match(clientSource, /room-theme-\$\{room\.themeId/);
  assert.match(clientSource, /suggest_room_theme/);
  assert.match(clientSource, /accept_room_theme/);
  assert.match(serverSource, /apply_room_theme/);
  assert.match(serverSource, /suggest_room_theme/);
  assert.match(serverSource, /accept_room_theme/);
  assert.match(profileSource, /ownedThemeIds/);
  assert.match(profileSource, /type === 'theme'/);
});

test('saved room opens as a return banner instead of automatic lobby resume', () => {
  assert.match(clientSource, /normalizePausedSession\(sessionKey, playerId\)/);
  assert.match(clientSource, /SessionReturnBanner/);
  assert.match(clientSource, /returnToSession/);
  assert.match(clientSource, /status: 'paused'/);
  assert.doesNotMatch(clientSource, /if \(session\?\.roomId\) \{\s*emit\('resume_room'/);
});

test('room navigation uses the custom exit intent instead of browser confirm', () => {
  assert.match(clientSource, /SessionExitModal/);
  assert.match(clientSource, /setExitIntent\(\{ targetView \}\)/);
  assert.doesNotMatch(clientSource, /window\.confirm\('Выйти из комнаты/);
});

test('invite QR deep links open a working join modal on every landing', () => {
  assert.match(clientSource, /new URLSearchParams\(location\.search\)\.get\('room'\)/);
  assert.match(clientSource, /QRCode\.toDataURL\(inviteUrl/);
  assert.match(clientSource, /<JoinModal initialName=\{name\} close=\{closeJoin\} join=\{onJoin\}/);
  assert.doesNotMatch(clientSource, /<JoinModal close=\{closeJoin\} onJoin=\{onJoin\}/);
});

test('discussion screen stays focused on timer and spy answer only', () => {
  assert.doesNotMatch(clientSource, /Первым задаёт вопрос/);
  assert.doesNotMatch(clientSource, /Показать мою карточку/);
  assert.doesNotMatch(clientSource, /Начать голосование за шпиона/);
  assert.doesNotMatch(clientSource, /Предложить голосование/);
  assert.doesNotMatch(clientSource, /Завершить без результата/);
  assert.doesNotMatch(clientSource, /Завершить раунд без результата/);
});

test('role reveal starts with a face-down card', () => {
  const roleRevealSource = spySource.slice(
    spySource.indexOf('function RoleReveal'),
    spySource.indexOf('function Discussion'),
  );
  assert.match(roleRevealSource, /secret-role-card/);
  assert.match(roleRevealSource, /Нажмите, чтобы посмотреть/);
  assert.match(roleRevealSource, /Покажите экран только себе/);
  assert.doesNotMatch(roleRevealSource, /Показать роль/);
  assert.doesNotMatch(roleRevealSource, /Открыть карту/);
  assert.match(roleRevealSource, /Скрыть карту/);
});
