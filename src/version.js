export const APP_VERSION = '0.5.1';
export const APP_DISPLAY_VERSION = typeof __GHP_VERSION_LABEL__ === 'string' ? __GHP_VERSION_LABEL__ : APP_VERSION;
export const APP_RELEASE_DATE = '16.08.2026';
export const APP_RELEASE_NAME = 'Стабильная загрузка и реклама';
export const APP_RELEASE_CHANGES = [
  'Добавлено уведомление о новой версии при выходе на главную или входе в лобби.',
  'Исправлено застревание старой версии сайта после деплоя.',
  'Проверка блокировщика рекламы больше не срабатывает ложно на главной.',
  'Улучшено восстановление рекламы и повторная проверка после её разрешения.',
];
