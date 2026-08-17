import fs from 'node:fs';
import path from 'node:path';

const SITE_ORIGIN = 'https://gamehubparty.ru';

export const publicPages = {
  '/': {
    title: 'GameHubParty — игры для компании без подготовки',
    description: 'Игры для компании в одном телефоне: Шпион, Alias, Бункер и Правда или действие. Создайте комнату и пригласите друзей по коду.',
    heading: 'Игры для компании в телефоне',
    paragraphs: [
      'GameHubParty помогает провести игру без ведущего, бумажных карточек и долгой подготовки.',
      'Создайте комнату, выберите игру и пригласите друзей по шестизначному коду или QR-ссылке. Гостям не нужна регистрация.',
    ],
    links: ['/games/spy', '/games/alias', '/games/bunker', '/games/truth-or-dare'],
  },
  '/games/spy': {
    title: 'Игра Шпион онлайн бесплатно — GameHubParty',
    description: 'Играйте в Шпиона онлайн с друзьями: роли, локации, таймер, вопросы и голосование уже внутри.',
    heading: 'Шпион онлайн для компании',
    paragraphs: [
      'Один или несколько игроков получают роль шпиона, остальные знают общую локацию или предмет.',
      'Задавайте вопросы вслух, ищите противоречия и голосуйте за подозреваемого. Для начала партии достаточно создать комнату и отправить друзьям код.',
    ],
  },
  '/games/alias': {
    title: 'Alias онлайн для компании — GameHubParty',
    description: 'Alias онлайн: объясняйте слова на скорость, собирайте команды и играйте без карточек и подготовки.',
    heading: 'Alias онлайн без бумажных карточек',
    paragraphs: [
      'Игроки делятся на команды и по очереди объясняют слова, не называя их напрямую.',
      'GameHubParty показывает слова, следит за временем и ведёт командный счёт. Создать комнату можно прямо в браузере.',
    ],
  },
  '/games/bunker': {
    title: 'Бункер онлайн для компании — GameHubParty',
    description: 'Играйте в Бункер онлайн: катастрофа, карточки персонажей, обсуждение и голосование без ведущего.',
    heading: 'Бункер онлайн для компании',
    paragraphs: [
      'После глобальной катастрофы места в убежище хватит не всем. Каждый участник получает характеристики персонажа и защищает своё право остаться.',
      'Сайт выдаёт карточки, раскрывает условия катастрофы, ведёт этапы обсуждения и собирает голоса.',
    ],
  },
  '/games/truth-or-dare': {
    title: 'Правда или действие онлайн — GameHubParty',
    description: 'Правда или действие онлайн: вопросы, задания, случайный игрок и быстрые раунды для компании.',
    heading: 'Правда или действие онлайн',
    paragraphs: [
      'Телефон выбирает участника и показывает вопрос или задание. Игрок отвечает, выполняет действие или передаёт ход дальше.',
      'Колоды подходят для домашнего вечера, вечеринки и тематических компаний. Комната запускается в браузере без установки приложения.',
    ],
  },
  '/store': {
    title: 'Магазин игр и наборов — GameHubParty',
    description: 'Дополнительные наборы, тематические колоды и доступы для игр GameHubParty.',
    heading: 'Дополнительные наборы GameHubParty',
    paragraphs: [
      'В магазине доступны тематические наборы, игровые пропуски, WeekendPass и PRO. Цена, срок и состав каждого цифрового товара показываются до оплаты.',
      'После подтверждения оплаты доступ автоматически появляется в профиле покупателя.',
    ],
  },
  '/privacy': {
    title: 'Политика конфиденциальности — GameHubParty',
    description: 'Политика обработки данных пользователей GameHubParty.',
    heading: 'Политика конфиденциальности',
    paragraphs: [
      'GameHubParty использует технический идентификатор игрока, отображаемое имя и данные, необходимые для комнат, профиля и покупок.',
      'Для аналитики и показа рекламы используются Яндекс Метрика и Adsterra. Они могут обрабатывать IP-адрес, сведения о браузере и устройстве, адрес страницы, источник перехода, рекламные идентификаторы и cookie-файлы.',
      'Данные банковской карты обрабатывает платёжный провайдер. По вопросам доступа или удаления данных можно написать на support@gamehubparty.ru.',
    ],
  },
  '/terms': {
    title: 'Пользовательское соглашение и оферта — GameHubParty',
    description: 'Правила использования GameHubParty и условия покупки цифровых товаров.',
    heading: 'Пользовательское соглашение и оферта',
    paragraphs: [
      'GameHubParty — онлайн-сервис для запуска игр в дружеских компаниях. Пользователь может создавать комнаты, подключаться по коду и приобретать цифровые доступы.',
      'Цена и срок товара показываются до заказа, а купленный доступ выдаётся в профиль после подтверждения оплаты.',
    ],
  },
  '/contacts': {
    title: 'Контакты и реквизиты — GameHubParty',
    description: 'Контакты поддержки и реквизиты продавца цифровых товаров GameHubParty.',
    heading: 'Контакты и реквизиты',
    paragraphs: [
      'Поддержка покупателей: support@gamehubparty.ru. В обращении укажите номер заказа, email или имя профиля.',
      'Продавец цифровых товаров: Сафонов Денис Алексеевич, самозанятый. ИНН 503227354282.',
    ],
  },
  '/vk': {
    title: 'GameHubParty в VK Mini Apps',
    description: 'Информация о версии GameHubParty для VK Mini Apps.',
    heading: 'GameHubParty в VK Mini Apps',
    paragraphs: [
      'Версия для VK использует тот же игровой сервис: комнаты, коды приглашения, профили и игровые сценарии.',
      'Параметры запуска VK обрабатываются только при открытии внутри платформы. Основная публичная версия сервиса всегда доступна на gamehubparty.ru.',
    ],
    index: false,
  },
  '/demo': {
    title: 'Статус и обновления — GameHubParty',
    description: 'Технический статус и история обновлений GameHubParty.',
    heading: 'Статус сервиса GameHubParty',
    paragraphs: ['Служебная страница показывает доступность сервиса и историю выпущенных обновлений.'],
    index: false,
  },
  '/profile': {
    title: 'Профиль игрока — GameHubParty',
    description: 'Профиль игрока GameHubParty.',
    heading: 'Профиль игрока',
    paragraphs: ['Здесь хранятся игровые доступы, покупки и настройки профиля.'],
    index: false,
  },
  '/admin': {
    title: 'Служебный вход — GameHubParty',
    description: 'Закрытый служебный раздел GameHubParty.',
    heading: 'Служебный раздел',
    paragraphs: ['Доступ к этому разделу ограничен.'],
    index: false,
  },
};

const navigation = [
  ['/', 'Все игры'],
  ['/games/spy', 'Шпион'],
  ['/games/alias', 'Alias'],
  ['/games/bunker', 'Бункер'],
  ['/games/truth-or-dare', 'Правда или действие'],
  ['/store', 'Магазин'],
  ['/contacts', 'Контакты'],
  ['/privacy', 'Политика'],
  ['/terms', 'Оферта'],
];

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function setMeta(html, name, content) {
  const tag = `<meta name="${name}" content="${escapeHtml(content)}" />`;
  const pattern = new RegExp(`<meta\\s+name=["']${name}["'][^>]*>`, 'i');
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `  ${tag}\n</head>`);
}

function setPropertyMeta(html, property, content) {
  const tag = `<meta property="${property}" content="${escapeHtml(content)}" />`;
  const pattern = new RegExp(`<meta\\s+property=["']${property}["'][^>]*>`, 'i');
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `  ${tag}\n</head>`);
}

function renderContent(page) {
  const paragraphs = page.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('');
  const related = (page.links || []).map((href) => {
    const target = publicPages[href];
    return `<li><a href="${href}">${escapeHtml(target?.heading || href)}</a></li>`;
  }).join('');
  const nav = navigation.map(([href, label]) => `<a href="${href}">${escapeHtml(label)}</a>`).join('');
  return `<main id="ghp-prerender"><header><a href="/">GameHubParty</a></header><article><h1>${escapeHtml(page.heading)}</h1>${paragraphs}${related ? `<h2>Выберите раздел</h2><ul>${related}</ul>` : ''}</article><nav aria-label="Разделы сайта">${nav}</nav></main>`;
}

export function renderPublicPage(template, pathname) {
  const page = publicPages[pathname];
  if (!page) return null;
  const canonical = `${SITE_ORIGIN}${pathname === '/' ? '/' : pathname}`;
  let html = template.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(page.title)}</title>`);
  html = setMeta(html, 'description', page.description);
  html = setMeta(html, 'robots', page.index === false ? 'noindex,follow' : 'index,follow');
  html = setPropertyMeta(html, 'og:title', page.title);
  html = setPropertyMeta(html, 'og:description', page.description);
  html = setPropertyMeta(html, 'og:url', canonical);
  const canonicalTag = `<link rel="canonical" href="${canonical}" />`;
  const canonicalPattern = /<link\s+rel=["']canonical["'][^>]*>/i;
  html = canonicalPattern.test(html)
    ? html.replace(canonicalPattern, canonicalTag)
    : html.replace('</head>', `  ${canonicalTag}\n</head>`);
  html = html.replace('</head>', `  <style>#ghp-prerender{box-sizing:border-box;max-width:760px;margin:0 auto;padding:32px 24px;font:16px/1.6 system-ui,sans-serif;color:#101828}#ghp-prerender header{margin-bottom:48px;font-weight:800}#ghp-prerender h1{font-size:clamp(32px,7vw,58px);line-height:1.05}#ghp-prerender nav{display:flex;flex-wrap:wrap;gap:12px;margin-top:48px}#ghp-prerender a{color:#175cd3}</style>\n</head>`);
  return html.replace('<div id="root"></div>', `<div id="root">${renderContent(page)}</div>`);
}

export function createPublicPageHandler(distDirectory) {
  const template = fs.readFileSync(path.join(distDirectory, 'index.html'), 'utf8');
  return (request, response) => {
    const pathname = request.path.length > 1 ? request.path.replace(/\/+$/, '') : '/';
    const html = renderPublicPage(template, pathname);
    response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('Expires', '0');
    if (html) return response.type('html').send(html);
    return response.status(404).type('html').send(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>Страница не найдена — GameHubParty</title><link rel="canonical" href="${SITE_ORIGIN}/"></head><body><main><h1>Страница не найдена</h1><p>Такого адреса на GameHubParty нет.</p><a href="/">Вернуться к играм</a></main></body></html>`);
  };
}

export function canonicalRedirectTarget(host, originalUrl = '/') {
  return String(host || '').toLowerCase().split(':')[0] === 'www.gamehubparty.ru'
    ? `${SITE_ORIGIN}${originalUrl}`
    : null;
}
