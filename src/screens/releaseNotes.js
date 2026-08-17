export const demoScreenshots = [
  { title: 'Демо-страница', file: '/demo/screenshots/00-demo.png' },
  { title: 'Магазин и подписки', file: '/demo/screenshots/01-store.png' },
  { title: 'Профиль и покупки', file: '/demo/screenshots/02-profile-custom-dictionary.png' },
  { title: 'Лобби хоста', file: '/demo/screenshots/03-host-lobby-settings.png' },
  { title: 'Раздача роли', file: '/demo/screenshots/04-role-reveal.png' },
  { title: 'Обсуждение', file: '/demo/screenshots/05-discussion.png' },
];

export const screenshotFolders = [
  {
    title: '16.08.2026 - релиз v0.5.1: стабильная загрузка и реклама',
    description: 'Добавлено уведомление о новой версии с перечнем изменений и управляемой перезагрузкой в безопасных точках: на главной и в лобби. Исправлены обновление кэша после деплоя, ложная проверка AdBlock и повторная загрузка рекламы.',
    shots: [],
  },
  {
    title: '12.07.2026 - релиз v0.5.0: новая графика и магазин',
    description: 'Полное обновление графики: свой арт для каждой игры, темы и набора. Магазин переделан в воронку с выбором PRO или WeekendPass, таблицей сравнения и каруселями дополнений. Быстрая загрузка: лёгкие форматы картинок, шрифт без внешних сервисов, экраны подгружаются по требованию.',
    shots: [],
  },
  {
    title: '30.06.2026 - релиз v0.4.0: MVP Бункера',
    description: 'Добавлен первый играбельный MVP "Бункера": лендинг, комната, карточки выживших, катастрофа, убежище, обсуждение, голосование и итог исключения.',
    shots: [
      { title: 'Лендинг Бункера', file: '/demo/screenshots/2026-06-30-v040-bunker-mvp/01-bunker-landing.png' },
      { title: 'Лобби и настройки хоста', file: '/demo/screenshots/2026-06-30-v040-bunker-mvp/02-bunker-lobby-settings.png' },
      { title: 'Принятие правил и цель партии', file: '/demo/screenshots/2026-06-30-v040-bunker-mvp/03-bunker-briefing.png' },
      { title: 'Режим “телефон на стол”', file: '/demo/screenshots/2026-06-30-v040-bunker-mvp/04-bunker-private-card.png' },
      { title: 'Обсуждение катастрофы и цели', file: '/demo/screenshots/2026-06-30-v040-bunker-mvp/05-bunker-discussion.png' },
      { title: 'Голосование совета', file: '/demo/screenshots/2026-06-30-v040-bunker-mvp/06-bunker-voting.png' },
      { title: 'Режим “вскрытие по очереди”', file: '/demo/screenshots/2026-06-30-v040-bunker-mvp/07-bunker-public-reveal.png' },
      { title: 'Общие раскрытые карточки', file: '/demo/screenshots/2026-06-30-v040-bunker-mvp/08-bunker-public-discussion.png' },
    ],
  },
  {
    title: '30.06.2026 - релиз v0.3.21: фикс цветов тем',
    description: 'Базовая GHP-тема снова использует синий цвет проекта, а жёлтый акцент оставлен только для PartyHub-карточки и комнаты с активной PartyHub-темой.',
    shots: [
      { title: 'GHP синий, PartyHub жёлтый', file: '/demo/screenshots/2026-06-30-v0321-theme-color-fix/01-theme-color-fix.png' },
    ],
  },
  {
    title: '28.06.2026 - релиз v0.3.20: темы комнаты',
    description: 'В магазине появилась косметика комнаты: базовая тема GHP и платная PartyHub. Хост может применить свою тему, игрок может предложить купленную тему, а хост принять её для всей комнаты.',
    shots: [
      { title: 'Темы в магазине и выбор темы в лобби', file: '/demo/screenshots/2026-06-28-v0320-room-themes/01-room-themes.png' },
    ],
  },
  {
    title: '28.06.2026 - релиз v0.3.19: лобби и админка',
    description: 'Лобби стало понятнее: PartyHub в шапке показывает текущую игру, реклама стоит под кодом комнаты, игроки не видят настройки, а хост управляет игрой через компактные сворачиваемые блоки. В админке добавлены быстрые действия для всех наборов.',
    shots: [
      { title: 'Лобби и панель хоста', file: '/demo/screenshots/2026-06-28-v0319-lobby-admin/01-lobby-host-controls.png' },
    ],
  },
  {
    title: '28.06.2026 - релиз v0.3.18: база рекламы',
    description: 'Реклама вынесена в базовые внутренние слоты: маленький баннер в лобби для нехоста и 5-секундная пауза перед стартом/следующим раундом. Если внешняя сеть не подключена, показывается аккуратная внутренняя пауза с предложением отключить рекламу подпиской.',
    shots: [
      { title: 'Внутренние рекламные слоты', file: '/demo/screenshots/2026-06-28-v0318-ad-base/01-ad-base-slots.png' },
    ],
  },
  {
    title: '28.06.2026 - релиз v0.3.17: редактор аватара',
    description: 'После выбора картинки открывается редактор аватарки: круглый предпросмотр, зум и сдвиг по горизонтали/вертикали. В профиль сохраняется уже аккуратно кадрированное изображение.',
    shots: [
      { title: 'Редактор кадра аватарки', file: '/demo/screenshots/2026-06-28-v0317-avatar-editor/01-avatar-crop-editor.png' },
    ],
  },
  {
    title: '28.06.2026 - релиз v0.3.16: личный кабинет и админ-поиск',
    description: 'В профиле можно выйти из аккаунта, поменять имя и аватар с устройства, а ID игрока показан тихой служебной строкой. Админка показывает только зарегистрированных игроков и умеет искать по ID, почте или имени.',
    shots: [
      { title: 'Личный кабинет с ID и редактированием профиля', file: '/demo/screenshots/2026-06-28-v0316-account-admin/01-profile-account-edit.png' },
      { title: 'Админка: зарегистрированные игроки и поиск', file: '/demo/screenshots/2026-06-28-v0316-account-admin/02-admin-registered-search.png' },
    ],
  },
  {
    title: '28.06.2026 - релиз v0.3.15: вход по почте',
    description: 'Покупки больше не оформляются гостем: магазин показывает аккуратную плашку входа, а регистрация, вход и восстановление доступа идут через код на почту без пароля.',
    shots: [
      { title: 'Магазин предлагает войти перед покупкой', file: '/demo/screenshots/2026-06-28-v0315-email-auth/01-store-auth-nudge.png' },
      { title: 'Окно входа по почте', file: '/demo/screenshots/2026-06-28-v0315-email-auth/02-email-auth-modal.png' },
    ],
  },
  {
    title: '28.06.2026 - релиз v0.3.14: обратная связь в меню',
    description: 'Боковое меню стало чище: внутренние ссылки убраны, вместо них добавлена форма обратной связи для идей, багов и вопросов по оплате. Сообщения уходят на сервер, сохраняются и готовы к SMTP-отправке на поддержку.',
    shots: [
      { title: 'Окно обратной связи из бокового меню', file: '/demo/screenshots/2026-06-28-v0314-feedback/01-feedback-modal.png' },
      { title: 'Заполненное обращение с почтой для ответа', file: '/demo/screenshots/2026-06-28-v0314-feedback/02-feedback-filled.png' },
    ],
  },
  {
    title: '28.06.2026 - релиз v0.3.13: красивая подготовка к платежам',
    description: 'Магазин получил отдельную витрину готовности к подключению платежей: товары, цены, цифровая выдача, документы и поддержка показаны понятными карточками. Юридические страницы стали аккуратнее и доверительнее.',
    shots: [
      { title: 'Витрина платежной готовности в магазине', file: '/demo/screenshots/2026-06-28-v0313-payment-polish/01-store-payment-polish.png' },
      { title: 'Контакты и реквизиты в красивой подаче', file: '/demo/screenshots/2026-06-28-v0313-payment-polish/02-contacts-polish.png' },
    ],
  },
  {
    title: '27.06.2026 - релиз v0.3.12: карточка роли лицом вниз',
    description: 'Раздача роли в Шпионе теперь начинается с единой закрытой карточки: игрок нажимает на нее, смотрит роль без отличий по цвету или форме, затем скрывает карту. Старые кнопки "Показать роль" и "Открыть карту" убраны.',
    shots: [
      { title: 'Карточка роли лицом вниз', file: '/demo/screenshots/2026-06-27-v0312-role-card/01-role-card-back.png' },
      { title: 'Карточка после нажатия', file: '/demo/screenshots/2026-06-27-v0312-role-card/02-role-card-revealed.png' },
    ],
  },
  {
    title: '27.06.2026 - релиз v0.3.11: упрощенный раунд Шпиона',
    description: 'Экран обсуждения очищен от лишних подсказок и ручных кнопок: остался таймер, цель раунда и одна кнопка ответа для Шпиона. Голосование за шпиона включается по таймеру, служебные кнопки хоста убраны из раунда.',
    shots: [
      { title: 'Чистое обсуждение', file: '/demo/screenshots/2026-06-27-v0311-spy-clean-round/01-clean-discussion.png' },
      { title: 'Ответ Шпиона вслух', file: '/demo/screenshots/2026-06-27-v0311-spy-clean-round/02-spy-answer-modal.png' },
    ],
  },
  {
    title: '27.06.2026 - релиз v0.3.10: мягкий выход из сессии',
    description: 'Игрока больше не затягивает обратно в лобби автоматически: при уходе появляется красивая модалка, сессия ставится на паузу на 5 минут, а на страницах показывается плашка продолжения или окончательного выхода.',
    shots: [
      { title: 'Подтверждение ухода из комнаты', file: '/demo/screenshots/2026-06-27-v0310-session-return/01-exit-confirm-modal.png' },
      { title: 'Плашка продолжения на странице магазина', file: '/demo/screenshots/2026-06-27-v0310-session-return/02-return-banner-store.png' },
      { title: 'Продолжение комнаты без кода', file: '/demo/screenshots/2026-06-27-v0310-session-return/03-returned-to-room.png' },
    ],
  },
  {
    title: '27.06.2026 - релиз v0.3.9: ответ Шпиона и лендинги',
    description: 'Шпион теперь останавливает игру и отвечает вслух, а мирные голосуют, засчитывать ответ или нет. Предметный режим получил отдельные подсказки, главная и лендинги Шпиона/Alias усилены.',
    shots: [
      { title: 'Проверка ответа Шпиона', file: '/demo/screenshots/2026-06-27-v039-spy-answer-landings/01-spy-answer-review.png' },
      { title: 'Предметный режим в настройках', file: '/demo/screenshots/2026-06-27-v039-spy-answer-landings/02-item-mode-settings.png' },
      { title: 'Главный лендинг', file: '/demo/screenshots/2026-06-27-v039-spy-answer-landings/03-home-landing.png' },
      { title: 'Лендинг Шпиона', file: '/demo/screenshots/2026-06-27-v039-spy-answer-landings/04-spy-landing.png' },
      { title: 'Лендинг Alias', file: '/demo/screenshots/2026-06-27-v039-spy-answer-landings/05-alias-landing.png' },
    ],
  },
  {
    title: '22.06.2026 - релиз v0.3.8: единая стилистика обложек',
    description: 'Перерисованы спорные обложки предметных наборов и "Мемов" в общей painterly-стилистике GameHubParty; плоские иконки больше не используем как магазинные карточки.',
    shots: [
      { title: 'Магазин с обновленными обложками', file: '/demo/screenshots/2026-06-22-v038-cover-style-fix/01-store-cover-style.png' },
      { title: 'Проверка визуальной серии', file: '/demo/screenshots/2026-06-22-v038-cover-style-fix/02-cover-style-board.png' },
    ],
  },
  {
    title: '21.06.2026 - релиз v0.3.7: предметные наборы и чистые обложки',
    description: 'Добавлены платные наборы "Виды алкоголя" и "Компьютерные игры", расширен пак предметов, а проблемная обложка с UI-артефактами заменена чистой PNG-иллюстрацией.',
    shots: [
      { title: 'Новые платные предметные наборы', file: '/demo/screenshots/2026-06-21-v037-spy-item-packs/01-store-new-item-packs.png' },
      { title: 'Чистые обложки без артефактов', file: '/demo/screenshots/2026-06-21-v037-spy-item-packs/02-clean-covers.png' },
    ],
  },
  {
    title: '21.06.2026 - релиз v0.3.6: Шпион с предметами',
    description: 'В Шпион добавлен режим предметов: бесплатные наборы Дом и быт / Вещи вечеринки, платные Гаджеты / Для влюбленных / 18+ намёки / Странные вещи, отдельные подписи в игре и магазине.',
    shots: [
      { title: 'Настройки режима предметов', file: '/demo/screenshots/2026-06-21-v036-spy-items/01-items-settings.png' },
      { title: 'Наборы предметов в магазине', file: '/demo/screenshots/2026-06-21-v036-spy-items/02-store-item-dictionaries.png' },
      { title: 'Карточка предмета в игре', file: '/demo/screenshots/2026-06-21-v036-spy-items/03-item-role-card.png' },
    ],
  },
  {
    title: '20.06.2026 - релиз v0.3.5: обложки словарей Шпиона',
    description: 'Для новых тематических словарей добавлены отдельные PNG-обложки и подключены к карточкам магазина, мини-превью и модалкам товара.',
    shots: [
      { title: 'Новые обложки в магазине', file: '/demo/screenshots/2026-06-20-v035-spy-covers/01-store-new-covers.png' },
      { title: 'Модалка тематического словаря', file: '/demo/screenshots/2026-06-20-v035-spy-covers/02-dictionary-cover-modal.png' },
    ],
  },
  {
    title: '20.06.2026 - релиз v0.3.4: админ-доступы',
    description: 'В админке можно выдавать и забирать покупки, словари, пакеты, PRO/PRO+, пропуск компании и удалять записи покупок у игроков.',
    shots: [
      { title: 'Игроки и доступы в админке', file: '/demo/screenshots/2026-06-20-v034-admin-access/01-admin-access.png' },
      { title: 'Выдача доступа игроку', file: '/demo/screenshots/2026-06-20-v034-admin-access/02-admin-grant-access.png' },
    ],
  },
  {
    title: '20.06.2026 - релиз v0.3.3: Alias и словари Шпиона',
    description: 'Alias получил отдельный красивый лендинг, а Шпион - новые тематические словари для 18+, пар, пьянок, корпоративов и интернет-компаний.',
    shots: [
      { title: 'Лендинг Alias', file: '/demo/screenshots/2026-06-20-v033-alias-spy-packs/01-alias-landing.png' },
      { title: 'Новые словари Шпиона в магазине', file: '/demo/screenshots/2026-06-20-v033-alias-spy-packs/02-store-spy-packs.png' },
      { title: 'Детали тематического набора', file: '/demo/screenshots/2026-06-20-v033-alias-spy-packs/03-spy-pack-details.png' },
    ],
  },
  {
    title: '20.06.2026 - релиз v0.3.2: интерфейс без XP',
    description: 'XP скрыт из шапки, меню, профиля, магазина и недавних игр, пока у прогресса нет понятной ценности для игрока.',
    shots: [
      { title: 'Профиль без XP', file: '/demo/screenshots/2026-06-20-v032-no-xp/01-profile-no-xp.png' },
      { title: 'Магазин без XP в шапке', file: '/demo/screenshots/2026-06-20-v032-no-xp/02-store-no-xp.png' },
    ],
  },
  {
    title: '20.06.2026 - релиз v0.3.1: PRO-статус и лендинг Шпиона',
    description: 'Добавлены видимые PRO/PRO+ статусы с датой, корона у аватара, магазин скрывает PRO-предложения при активной подписке, а лендинг Шпиона стал самостоятельнее для продвижения.',
    shots: [
      { title: 'Лендинг Шпиона для продвижения', file: '/demo/screenshots/2026-06-20-v031-pro-spy/01-spy-landing-v031.png' },
      { title: 'Профиль с PRO-короной', file: '/demo/screenshots/2026-06-20-v031-pro-spy/02-profile-pro-crown.png' },
      { title: 'Магазин при активной подписке', file: '/demo/screenshots/2026-06-20-v031-pro-spy/03-store-active-pro.png' },
      { title: 'Карточки магазина с ценой', file: '/demo/screenshots/2026-06-20-v031-pro-spy/04-store-price-buttons.png' },
    ],
  },
  {
    title: '20.06.2026 - релиз v0.3.0: Шпион, главная и магазин',
    description: 'Публичные страницы выглядят как готовый продукт: версия в интерфейсе, обновленная главная, понятный Шпион, аккуратный магазин и мягкая рекламная пауза.',
    shots: [
      { title: 'Главная v0.3.0', file: '/demo/screenshots/2026-06-20-v030-polish/01-home-v030.png' },
      { title: 'Страница Шпиона', file: '/demo/screenshots/2026-06-20-v030-polish/02-spy-polish.png' },
      { title: 'Магазин наборов', file: '/demo/screenshots/2026-06-20-v030-polish/03-store-polish.png' },
      { title: 'Статус и история обновлений', file: '/demo/screenshots/2026-06-20-v030-polish/04-status-updates.png' },
    ],
  },
  {
    title: '20.06.2026 - рекламная модель Free/PRO',
    description: 'Добавлены рекламные паузы для Free-комнат и правило: любой PRO, PRO+ или пропуск компании убирает рекламу для всей комнаты.',
    shots: [
      { title: 'Free-комната с рекламными паузами', file: '/demo/screenshots/2026-06-20-ad-mvp/01-free-lobby-ads.png' },
      { title: 'Рекламная пауза перед стартом', file: '/demo/screenshots/2026-06-20-ad-mvp/02-pre-round-ad.png' },
      { title: 'PRO-игрок убрал рекламу для всех', file: '/demo/screenshots/2026-06-20-ad-mvp/03-pro-adfree-room.png' },
      { title: 'Демо-папка с отчетом', file: '/demo/screenshots/2026-06-20-ad-mvp/04-demo-folder.png' },
    ],
  },
  {
    title: '20.06.2026 - подготовка к YooKassa',
    description: 'Добавлены публичные страницы контактов, расширенная оферта и понятная выдача цифрового заказа в магазине.',
    shots: [
      { title: 'Магазин и получение цифрового заказа', file: '/demo/screenshots/2026-06-20-yookassa-ready/01-store-delivery.png' },
      { title: 'Контакты и реквизиты', file: '/demo/screenshots/2026-06-20-yookassa-ready/02-contacts.png' },
      { title: 'Демо-папка с отчетом', file: '/demo/screenshots/2026-06-20-yookassa-ready/04-demo-folder.png' },
    ],
  },
  {
    title: '20.06.2026 - админка заказов и комнат',
    description: 'Добавлена операционная панель: метрики, активные комнаты, demo-заказы и подтверждение pending-заказов из админки.',
    shots: [
      { title: 'Операционная панель админки', file: '/demo/screenshots/2026-06-20-admin-ops/01-admin-ops.png' },
      { title: 'Демо-страница с новой папкой', file: '/demo/screenshots/2026-06-20-admin-ops/02-demo-folder.png' },
    ],
  },
  {
    title: '19.06.2026 - админка, платежка и результат Шпиона',
    description: 'Доработаны чеклисты админки, оформление заказа, магазин с нормальными текстами и экран результата Шпиона. После правок прогоняются тесты и деплой.',
    shots: [
      { title: 'Админка с чеклистами и описанием релиза', file: '/demo/screenshots/2026-06-19-mvp-payment-admin/01-admin-release.png' },
      { title: 'Магазин и оформление заказа', file: '/demo/screenshots/2026-06-19-mvp-payment-admin/02-store-payment.png' },
      { title: 'Результат Шпиона', file: '/demo/screenshots/2026-06-19-mvp-payment-admin/03-spy-result.png' },
      { title: 'Демо-страница с новой папкой', file: '/demo/screenshots/2026-06-19-mvp-payment-admin/04-demo-folder.png' },
    ],
  },
  {
    title: '18.06.2026 22:10 - админка и папки скриншотов',
    description: 'Убрана публичная кнопка Админ из шапки, скрыта подсказка PIN, скриншоты сгруппированы в папку с каруселью.',
    shots: [
      { title: 'Вход в админку без публичного PIN', file: '/demo/screenshots/2026-06-18-2210-admin-screenshots/01-admin-login.png' },
      { title: 'Демо-страница с папками скриншотов', file: '/demo/screenshots/2026-06-18-2210-admin-screenshots/02-demo-folders.png' },
      { title: 'Шапка без кнопки Админ', file: '/demo/screenshots/2026-06-18-2210-admin-screenshots/03-header-no-admin-button.png' },
    ],
  },
  {
    title: '18.06.2026 22:10',
    description: 'Срез текущего состояния: демо-страница, магазин, профиль, лобби и игровой процесс Шпиона.',
    shots: demoScreenshots,
  },
];
