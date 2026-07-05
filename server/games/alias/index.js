export const aliasDefinition = {
  id: 'alias',
  name: 'Alias',
  status: 'mvp',
  minPlayers: 4,
  maxPlayers: 20,
  playModes: ['teams'],
  defaultSettings: { roundSeconds: 60, targetScore: 20, dictionaryIds: ['everyday'] },
  settingsSchema: {
    roundSeconds: { type: 'number', values: [60, 90, 120] },
    targetScore: { type: 'number', min: 3, max: 50 },
    dictionaryIds: { type: 'dictionary-list' },
  },
  plannedFeatures: ['Командная игра', 'Таймер раунда', 'Автоматические слова', 'Подсчёт очков', 'Тематические словари'],
};

export const aliasDictionaryPreview = [
  { id: 'everyday', name: 'На каждый день', description: 'Простые слова для первой партии и семейного режима.', category: 'База', wordCount: 96, free: true, cover: 'city' },
  { id: 'party', name: 'Для вечеринки', description: 'Слова, которые хорошо заходят в шумной компании.', category: 'Вечеринка', wordCount: 64, free: true, cover: 'party' },
  { id: 'movies', name: 'Кино и сериалы', description: 'Персонажи, жанры, съёмки, стриминги и вечер перед экраном.', category: 'Поп-культура', wordCount: 72, free: false, cover: 'pop' },
  { id: 'memes', name: 'Мемы и интернет', description: 'Тренды, блогеры, чаты, игры и фразы, которые сложно объяснять спокойно.', category: 'Интернет', wordCount: 72, free: false, cover: 'memes' },
  { id: 'after_dark', name: '18+ Alias', description: 'Смелые слова для взрослых компаний без детского фильтра.', category: '18+', wordCount: 64, free: false, cover: 'after_dark', ageRating: '18+' },
  { id: 'family', name: 'Семейный Alias', description: 'Мягкий набор для смешанной компании, детей и родителей.', category: 'Семья', wordCount: 64, free: false, cover: 'couples' },
];

const ALIAS_WORDS = {
  everyday: [
    'балкон', 'зонт', 'такси', 'календарь', 'чайник', 'рюкзак', 'аптека', 'пицца', 'будильник', 'ключ',
    'сосед', 'пылесос', 'диван', 'пароль', 'наушники', 'чемодан', 'фонарик', 'шоколад', 'карандаш', 'мост',
    'парк', 'билет', 'зарядка', 'кошелек', 'лифт', 'подарок', 'лампа', 'зеркало', 'пляж', 'шарф',
    'кофе', 'магазин', 'перчатки', 'ноутбук', 'стакан', 'карта', 'велосипед', 'печенье', 'окно', 'дождь',
    'книга', 'музыка', 'такса', 'ремонт', 'рыбалка', 'поезд', 'салат', 'свеча', 'сюрприз', 'бутылка',
    'коробка', 'сумка', 'солнце', 'зарплата', 'пробка', 'сосиска', 'школа', 'каникулы', 'план', 'фото',
    'молоко', 'кроссовки', 'гитара', 'письмо', 'сахар', 'холодильник', 'стол', 'компас', 'плед', 'театр',
    'снежок', 'огород', 'пальто', 'банкомат', 'пирог', 'свитер', 'бассейн', 'маршрут', 'варенье', 'пауза',
    'пластырь', 'колонка', 'гараж', 'собрание', 'кафе', 'сковорода', 'пакет', 'канал', 'цветок', 'пружина',
    'расческа', 'пульт', 'метро', 'сыр', 'облако', 'записка',
  ],
  party: [
    'караоке', 'тост', 'танцпол', 'бармен', 'конфетти', 'плейлист', 'диджей', 'настолка', 'пицца', 'кальян',
    'вечеринка', 'фотобудка', 'шот', 'коктейль', 'гитара', 'балкон', 'сосед', 'подарок', 'свечи', 'шарики',
    'квест', 'мафия', 'танец', 'микрофон', 'громкость', 'дресс-код', 'такси', 'афиша', 'сюрприз', 'смех',
    'шампанское', 'день рождения', 'посуда', 'лед', 'закуска', 'ведущий', 'команда', 'розыгрыш', 'селфи', 'чат',
    'пижама', 'терраса', 'патифон', 'блеск', 'приглашение', 'очередь', 'кубик', 'фокус', 'аплодисменты', 'пауза',
    'перерыв', 'флирт', 'шутка', 'костюм', 'салфетка', 'браслет', 'бар', 'гость', 'хозяин', 'финал',
    'лимонад', 'колонка', 'диван', 'плед',
  ],
  movies: [
    'режиссёр', 'сценарий', 'премьера', 'попкорн', 'триллер', 'комедия', 'злодей', 'саундтрек', 'трейлер', 'камео',
    'сериал', 'сезон', 'спойлер', 'актёр', 'кадр', 'дубль', 'монтаж', 'оператор', 'киностудия', 'костюм',
    'супергерой', 'детектив', 'финал', 'эпизод', 'постер', 'озвучка', 'фэнтези', 'вестерн', 'мелодрама', 'ситком',
    'платформа', 'стриминг', 'кинотеатр', 'фанат', 'рейтинг', 'премия', 'оскар', 'аниме', 'документалка', 'шоураннер',
    'франшиза', 'приквел', 'сиквел', 'ремейк', 'сцена', 'массовка', 'грим', 'хлопушка', 'кастинг', 'звезда',
    'кинокритик', 'серия', 'пилот', 'сага', 'сюжет', 'пролог', 'титры', 'диалог', 'роль', 'драма',
    'хоррор', 'блокбастер', 'камера', 'декорации',
  ],
  memes: [
    'мем', 'стрим', 'донат', 'чат', 'лайк', 'репост', 'сторис', 'блогер', 'подкаст', 'аватарка',
    'никнейм', 'тренд', 'хэштег', 'бан', 'модератор', 'комментарий', 'скриншот', 'фейк', 'вайб', 'кринж',
    'рофл', 'шортс', 'клип', 'лента', 'уведомление', 'бот', 'нейросеть', 'чатик', 'сервер', 'логин',
    'пароль', 'капча', 'флешмоб', 'реакция', 'стикер', 'эмодзи', 'голосовое', 'подписка', 'алгоритм', 'реклама',
    'пранк', 'обзор', 'тред', 'форум', 'мод', 'геймер', 'патч', 'скин', 'косплей', 'турнир',
    'консоль', 'рандом', 'донатер', 'стример', 'монтаж', 'шаблон', 'зумер', 'ретро', 'чат-рулетка', 'подписчик', 'лайв',
  ],
  after_dark: [
    'свидание', 'флирт', 'поцелуй', 'ревность', 'бар', 'клуб', 'шот', 'компромат', 'секрет', 'страсть',
    'намёк', 'спальня', 'похмелье', 'татуировка', 'искушение', 'бывший', 'признание', 'роман', 'смелость', 'интрига',
    'ночь', 'такси', 'коктейль', 'душ', 'парфюм', 'сюрприз', 'бельё', 'свечи', 'афтерпати', 'запрет',
    'шёпот', 'объятие', 'реванш', 'авантюра', 'симпатия', 'провокация', 'риск', 'массаж', 'комплимент', 'тайна',
    'доверие', 'неловкость', 'балкон', 'сообщение', 'голосовое', 'танец', 'игра', 'спор', 'утро', 'взгляд',
    'желание', 'соблазн', 'драма', 'маска', 'вечер', 'свидетель', 'вино', 'искренность', 'пауза', 'финал',
    'сторис', 'молчание', 'притяжение', 'улыбка',
  ],
  family: [
    'зоопарк', 'мороженое', 'парк', 'подарок', 'пазл', 'сказка', 'велосипед', 'каникулы', 'поезд', 'мультфильм',
    'школа', 'портфель', 'песочница', 'аквариум', 'котёнок', 'пирог', 'бабушка', 'дедушка', 'суп', 'шарф',
    'снеговик', 'ёлка', 'пикник', 'компас', 'палатка', 'фонарик', 'книга', 'театр', 'музей', 'экскурсия',
    'фокусник', 'робот', 'конструктор', 'рисунок', 'краски', 'альбом', 'кукла', 'самолёт', 'ракета', 'планета',
    'радуга', 'песенка', 'хор', 'печенье', 'варенье', 'огород', 'семена', 'луна', 'звезда', 'облако',
    'двор', 'качели', 'рюкзак', 'письмо', 'глобус', 'карта', 'чемодан', 'пижама', 'подушка', 'сон',
    'сок', 'каша', 'магнит', 'игрушка',
  ],
};

export function normalizeAliasSettings(settings = {}) {
  const seconds = Number(settings.roundSeconds);
  const target = Number(settings.targetScore);
  const dictionaryIds = (Array.isArray(settings.dictionaryIds) ? settings.dictionaryIds : []).filter((id) => ALIAS_WORDS[id]);
  return {
    roundSeconds: aliasDefinition.settingsSchema.roundSeconds.values.includes(seconds) ? seconds : aliasDefinition.defaultSettings.roundSeconds,
    targetScore: Math.min(50, Math.max(3, Number.isFinite(target) ? target : aliasDefinition.defaultSettings.targetScore)),
    dictionaryIds: dictionaryIds.length ? dictionaryIds : aliasDefinition.defaultSettings.dictionaryIds,
  };
}

export function createAliasTeams(players) {
  const onlinePlayers = players.filter((player) => player.online);
  return [
    { id: 'team_1', name: 'Команда 1', playerIds: onlinePlayers.filter((_, index) => index % 2 === 0).map((player) => player.id) },
    { id: 'team_2', name: 'Команда 2', playerIds: onlinePlayers.filter((_, index) => index % 2 === 1).map((player) => player.id) },
  ];
}

export function aliasWordPool(dictionaryIds = ['everyday']) {
  const words = dictionaryIds.flatMap((id) => ALIAS_WORDS[id] || []);
  return [...new Set(words)];
}

export function createAliasRound(room, random = Math.random) {
  const teams = room.aliasTeams?.length ? room.aliasTeams : createAliasTeams(room.players);
  const lastTurnIndex = Number.isFinite(room.aliasTurnIndex) ? room.aliasTurnIndex : room.round?.turnIndex ?? -1;
  const turnIndex = lastTurnIndex + 1;
  const team = teams[turnIndex % teams.length];
  const pool = aliasWordPool(room.settings.dictionaryIds);
  const usedWords = new Set(room.usedAliasWords || []);
  const available = pool.filter((word) => !usedWords.has(word));
  const words = available.length >= 20 ? available : pool;
  const firstWord = words[Math.floor(random() * words.length)];
  room.aliasTurnIndex = turnIndex;
  return {
    number: (room.round?.number || 0) + 1,
    phase: 'alias_turn',
    turnIndex,
    teamId: team.id,
    teamName: team.name,
    word: firstWord,
    wordsSeen: [firstWord],
    correct: 0,
    skipped: 0,
    startedAt: Date.now(),
    endsAt: Date.now() + room.settings.roundSeconds * 1000,
    result: null,
  };
}

export function nextAliasWord(room, random = Math.random) {
  const pool = aliasWordPool(room.settings.dictionaryIds);
  const seen = new Set([...(room.usedAliasWords || []), ...(room.round?.wordsSeen || [])]);
  const available = pool.filter((word) => !seen.has(word));
  const words = available.length ? available : pool;
  const word = words[Math.floor(random() * words.length)];
  room.round.wordsSeen.push(word);
  room.round.word = word;
  return word;
}
