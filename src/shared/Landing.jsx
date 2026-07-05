import { hasTimedGameAccess } from './helpers';

export function GameFunnelStrip({ game = 'home', navigate }) {
  const copy = {
    home: {
      eyebrow: 'Быстрый путь',
      title: 'Сначала игра, потом усиления',
      steps: [
        ['1', 'Создайте комнату', 'Хост запускает игру и получает код.'],
        ['2', 'Позовите друзей', 'Ссылка, код или QR открываются с телефона.'],
        ['3', 'Откройте наборы', 'После первой партии легко докупить темы и словари.'],
      ],
    },
    spy: {
      eyebrow: 'Игровая воронка',
      title: 'Запуск Шпиона без паузы',
      steps: [
        ['1', 'Комната за минуту', 'Базовые места доступны сразу.'],
        ['2', 'Вопросы вслух', 'Телефон хранит роль и ведёт таймер.'],
        ['3', 'Больше партий', 'Spy Pass открывает полную библиотеку и свои локации.'],
      ],
    },
    alias: {
      eyebrow: 'Игровая воронка',
      title: 'Alias быстро разогревает компанию',
      steps: [
        ['1', 'Команды', 'Игроки делятся и сразу видят очередь.'],
        ['2', 'Ход по таймеру', 'На экране только слово и крупные действия.'],
        ['3', 'Наборы позже', 'Словари под компании станут естественной покупкой.'],
      ],
    },
    bunker: {
      eyebrow: 'Игровая воронка',
      title: 'Бункер держит драму на телефонах',
      steps: [
        ['1', 'Карточка игрока', 'Каждый видит свои факты и решает, что раскрыть.'],
        ['2', 'Спор вслух', 'Сайт показывает цель, бункер и время.'],
        ['3', 'Сценарии', 'Новые катастрофы и паки дают повод сыграть ещё.'],
      ],
    },
  }[game];
  return <section className="funnel-strip wrap">
    <span className="eyebrow">{copy.eyebrow}</span>
    <h2>{copy.title}</h2>
    <div className="funnel-steps">{copy.steps.map(([num, title, text]) => <article key={num}><b>{num}</b><span>{title}</span><small>{text}</small></article>)}</div>
    <button className="button secondary full" onClick={() => navigate('store')}>Посмотреть доступы и наборы</button>
  </section>;
}

export function LandingPlaybook({ game = 'spy' }) {
  const copy = {
    spy: {
      eyebrow: 'Как играется',
      title: 'Роли на телефонах, спор за столом',
      items: [
        ['Секрет у мирных', 'Место или предмет видят все, кроме Шпиона.'],
        ['Вопросы вслух', 'Игроки отвечают так, чтобы помочь своим и не раскрыться чужому.'],
        ['Финальное решение', 'Шпион может рискнуть с ответом, а компания голосует.'],
      ],
    },
    alias: {
      eyebrow: 'Как играется',
      title: 'Быстрые ходы без карточек и ведущего',
      items: [
        ['Команды готовы', 'Хост выбирает время и счёт до победы.'],
        ['Слово на экране', 'Объясняйте ассоциациями, примерами и ситуациями.'],
        ['Счёт сам ведётся', 'Отмечайте угаданные и пропущенные слова одним нажатием.'],
      ],
    },
    bunker: {
      eyebrow: 'Как играется',
      title: 'Выживание на телефонах, драма вслух',
      items: [
        ['Карточка персонажа', 'Профессия, здоровье, навык, багаж и факт остаются под рукой.'],
        ['Убежище на виду', 'Катастрофа, цель и условия бункера видны всей комнате.'],
        ['Совет решает', 'После обсуждения компания голосует, кто остаётся снаружи.'],
      ],
    },
  }[game];
  return <section className="landing-section landing-playbook wrap"><span className="eyebrow">{copy.eyebrow}</span><h2>{copy.title}</h2><div>{copy.items.map(([title, text]) => <article key={title}><b>{title}</b><span>{text}</span></article>)}</div></section>;
}

export function LandingAccessShowcase({ game = 'spy', navigate, profile }) {
  const gameNames = { home: 'все игры', spy: 'Шпиона', alias: 'Alias', bunker: 'Бункер' };
  const passNames = { home: 'PRO', spy: 'Spy Pass', alias: 'Alias Pass', bunker: 'Bunker Pass' };
  const hasAccess = game === 'home' ? hasTimedGameAccess(profile, 'spy') && hasTimedGameAccess(profile, 'alias') && hasTimedGameAccess(profile, 'bunker') : hasTimedGameAccess(profile, game);
  const cards = {
    home: [
      ['cover-city', 'Больше сценариев', 'Дополнительные наборы для разных компаний.'],
      ['cover-after_dark', 'Комнаты без рекламы', 'Активный доступ хоста убирает паузы у всех.'],
      ['cover-party', 'Один профиль', 'Покупки и сроки доступа остаются в профиле.'],
    ],
    spy: [
      ['cover-city', 'Полная библиотека', 'Локации, предметы и тематические наборы.'],
      ['cover-drinks', 'Режимы для компании', 'Два шпиона, быстрые раунды и больше поводов спорить.'],
      ['cover-memes', 'Свои локации', 'Добавляйте места под вашу компанию.'],
    ],
    alias: [
      ['cover-party', 'Словари под вечер', 'Домашние, офисные и вечериночные темы.'],
      ['cover-pop', 'Больше темпа', 'Новые наборы быстро освежают повторные партии.'],
      ['cover-office_party', 'Для хоста', 'Одна покупка открывает комнату без рекламы.'],
    ],
    bunker: [
      ['cover-secret', 'Новые катастрофы', 'Медицинские, космические и суровые сценарии.'],
      ['cover-fantasy', 'Больше ролей', 'Спецкарты и цели, которые меняют аргументы игроков.'],
      ['cover-after_dark', 'Без рекламных пауз', 'Game Pass этой игры убирает рекламу в комнате.'],
    ],
  }[game];
  return <section className="landing-section landing-access wrap"><div className="landing-access-head"><span className="eyebrow">Что откроется</span><h2>{passNames[game]} или PRO для {gameNames[game]}</h2><p>{hasAccess ? 'Доступ уже активен. Можно сразу создавать комнату и пользоваться расширениями.' : 'Начните бесплатно, а когда компания втянется — откройте расширения и уберите рекламу в комнате.'}</p></div><div className="landing-access-grid">{cards.map(([cover, title, text]) => <article key={title}><div className={`cover mini ${cover}`} /><b>{title}</b><span>{text}</span></article>)}</div><button className="button secondary full" onClick={() => navigate('store')}>{hasAccess ? 'Посмотреть мои доступы' : 'Открыть магазин'}</button></section>;
}
