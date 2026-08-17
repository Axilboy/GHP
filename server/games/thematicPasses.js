export const themePassCatalog = [
  {
    id: 'theme_party',
    themeId: 'party',
    name: 'Вечеринка Pass',
    category: 'Вечеринка',
    priceRub: 129,
    cover: 'party',
    art: 'alias',
    short: 'Наборы для шумной компании во всех играх.',
    description: 'Открывает тематические наборы для вечеринки в Шпионе, Alias, Бункере и карточках Правда или действие на 1 месяц.',
    includes: ['Шпион: места и предметы вечеринки', 'Alias: шумные слова для компании', 'Бункер: вечеринка после катастрофы', 'Правда или действие: карточки для разогрева'],
  },
  {
    id: 'theme_drinks',
    themeId: 'drinks',
    name: 'Бар Pass',
    category: 'Для друзей',
    priceRub: 149,
    cover: 'drinks',
    art: 'spy',
    short: 'Наборы для взрослой компании с барной атмосферой.',
    description: 'Открывает барные и застольные наборы во всех играх на 1 месяц. Только для взрослых компаний.',
    ageRating: '18+',
    includes: ['Шпион: барные локации и предметы', 'Alias: слова про тосты, бар и вечер', 'Бункер: спор за место после шумной ночи', 'Правда или действие: мягкие задания для застолья'],
  },
  {
    id: 'theme_couples',
    themeId: 'couples',
    name: 'Пары Pass',
    category: 'Для влюбленных',
    priceRub: 149,
    cover: 'couples',
    art: 'truthdare',
    short: 'Романтичные наборы для свиданий и парных компаний.',
    description: 'Открывает романтические наборы для пар и двойных свиданий во всех играх на 1 месяц.',
    includes: ['Шпион: романтические места и предметы', 'Alias: слова про свидания и отношения', 'Бункер: парные дилеммы и доверие', 'Правда или действие: вопросы для сближения'],
  },
  {
    id: 'theme_adult_couples',
    themeId: 'adult_couples',
    name: '18+ для пар Pass',
    category: '18+ пары',
    priceRub: 179,
    cover: 'adult_couples',
    art: 'truthdare',
    short: 'Смелые, но не грубые наборы для взрослых пар.',
    description: 'Открывает более откровенные наборы для взрослых пар во всех играх на 1 месяц.',
    ageRating: '18+',
    includes: ['Шпион: намеки и приватная атмосфера', 'Alias: смелые слова для пары', 'Бункер: доверие, ревность и секреты', 'Правда или действие: откровенные вопросы без жесткости'],
  },
  {
    id: 'theme_adult_party',
    themeId: 'adult_party',
    name: '18+ вписка Pass',
    category: '18+ компания',
    priceRub: 179,
    cover: 'adult_party',
    art: 'spy',
    short: 'Смелые наборы для взрослых компаний и вечеринок.',
    description: 'Открывает взрослые party-наборы во всех играх на 1 месяц. Контент рассчитан на совершеннолетних игроков.',
    ageRating: '18+',
    includes: ['Шпион: ночные места и намеки', 'Alias: 18+ слова для компании', 'Бункер: компромат и неудобные секреты', 'Правда или действие: смелые карточки для вписок'],
  },
  {
    id: 'theme_fandom',
    themeId: 'fandom',
    name: 'Фан-вселенные Pass',
    category: 'Фанаты',
    priceRub: 199,
    cover: 'fandom',
    art: 'bunker',
    short: 'Все фан-наборы для кино, игр, фэнтези и любимых франшиз.',
    description: 'Открывает фанатские наборы во всех играх на 1 месяц: магическая школа, кольца и походы, ретро-кино, видеоигры и общая поп-культура.',
    includes: ['Шпион: локации по фан-вселенным', 'Alias: слова по любимым сагам и играм', 'Бункер: жанровые сценарии выживания', 'Правда или действие: задания для фанатов франшиз'],
  },
  {
    id: 'theme_harry_potter',
    themeId: 'harry_potter',
    name: 'Гарри Поттер Pass',
    category: 'Фанаты',
    priceRub: 149,
    cover: 'harry_potter',
    art: 'truthdare',
    short: 'Магическая школа, факультеты, квиддич и волшебные дуэли.',
    description: 'Открывает наборы в духе Гарри Поттера во всех играх на 1 месяц.',
    includes: ['Шпион: Хогвартс и магические места', 'Alias: слова для поттероманов', 'Бункер: магический кризис и отбор', 'Правда или действие: карточки для школы магии'],
  },
  {
    id: 'theme_lotr',
    themeId: 'lotr',
    name: 'Властелин колец Pass',
    category: 'Фанаты',
    priceRub: 149,
    cover: 'lotr',
    art: 'bunker',
    short: 'Шир, Мордор, эльфы, гномы, поход и спор за кольцо.',
    description: 'Открывает наборы в духе Властелина колец во всех играх на 1 месяц.',
    includes: ['Шпион: Средиземье и легендарные места', 'Alias: слова для поклонников похода к Роковой горе', 'Бункер: фэнтези-совет выживших', 'Правда или действие: задания для отряда'],
  },
  {
    id: 'theme_retro_movies',
    themeId: 'retro_movies',
    name: 'Ретро-кино Pass',
    category: 'Фанаты',
    priceRub: 129,
    cover: 'retro_movies',
    art: 'alias',
    short: 'VHS, боевики, фантастика, слэшеры и культовые кино-вечера.',
    description: 'Открывает ретро-киношные наборы во всех играх на 1 месяц.',
    includes: ['Шпион: видеосалон и съемочные площадки', 'Alias: слова из мира VHS и культовых фильмов', 'Бункер: катастрофа как в старом блокбастере', 'Правда или действие: задания для киноманов'],
  },
  {
    id: 'theme_video_games',
    themeId: 'video_games',
    name: 'Видеоигры Pass',
    category: 'Фанаты',
    priceRub: 149,
    cover: 'video_games',
    art: 'spy',
    short: 'Рейды, боссы, лут, киберспорт, приставки и ночные катки.',
    description: 'Открывает игровые наборы во всех играх на 1 месяц.',
    includes: ['Шпион: игровые локации и арены', 'Alias: геймерские слова и жанры', 'Бункер: выживание как кооперативный рейд', 'Правда или действие: задания для игроков'],
  },
];

export const contentThemeMap = {
  spy: {
    party_house: ['party'],
    office_party: ['party'],
    memes: ['party', 'fandom'],
    drinks: ['drinks'],
    items_alcohol: ['drinks'],
    couples: ['couples'],
    items_couples: ['couples'],
    after_dark: ['adult_party'],
    items_after_dark: ['adult_party', 'adult_couples'],
    pop: ['fandom'],
    fantasy: ['fandom'],
    harry_potter: ['harry_potter', 'fandom'],
    lotr: ['lotr', 'fandom'],
    retro_movies: ['retro_movies', 'fandom'],
    video_games: ['video_games', 'fandom'],
    items_computer_games: ['fandom'],
  },
  alias: {
    party: ['party'],
    drinks: ['drinks'],
    couples: ['couples'],
    adult_couples: ['adult_couples'],
    after_dark: ['adult_party'],
    fandom: ['fandom'],
    harry_potter: ['harry_potter', 'fandom'],
    lotr: ['lotr', 'fandom'],
    retro_movies: ['retro_movies', 'fandom'],
    video_games: ['video_games', 'fandom'],
    movies: ['fandom'],
    memes: ['fandom'],
  },
  bunker: {
    party: ['party'],
    drinks: ['drinks'],
    couples: ['couples'],
    adult_couples: ['adult_couples'],
    party18: ['adult_party'],
    fandom: ['fandom'],
    harry_potter: ['harry_potter', 'fandom'],
    lotr: ['lotr', 'fandom'],
    retro_movies: ['retro_movies', 'fandom'],
    video_games: ['video_games', 'fandom'],
    space: ['fandom'],
    mystic: ['fandom'],
    wasteland: ['fandom'],
  },
  truthdare: {
    party: ['party'],
    drinks: ['drinks'],
    couples: ['couples'],
    adult_couples: ['adult_couples'],
    adult_party: ['adult_party'],
    bold: ['adult_party'],
    fandom: ['fandom'],
    harry_potter: ['harry_potter', 'fandom'],
    lotr: ['lotr', 'fandom'],
    retro_movies: ['retro_movies', 'fandom'],
    video_games: ['video_games', 'fandom'],
  },
};

const themePassByProductId = new Map(themePassCatalog.map((pass) => [pass.id, pass]));
const themePassByThemeId = new Map(themePassCatalog.map((pass) => [pass.themeId, pass]));

export function listThemePasses() {
  return themePassCatalog.map((pass) => ({ ...pass, type: 'theme_pass', months: 1 }));
}

export function getThemePass(productId) {
  return themePassByProductId.get(String(productId || '').trim()) || null;
}

export function getThemePassByThemeId(themeId) {
  return themePassByThemeId.get(String(themeId || '').trim()) || null;
}

export function getContentThemeIds(gameId, contentId) {
  return contentThemeMap[String(gameId || '').trim()]?.[String(contentId || '').trim()] || [];
}

export function themePassPriceMap() {
  return Object.fromEntries(themePassCatalog.map((pass) => [pass.id, pass.priceRub]));
}

export function themePassTitleMap() {
  return Object.fromEntries(themePassCatalog.map((pass) => [pass.id, `${pass.name} на месяц`]));
}
