export const bunkerDefinition = {
  id: 'bunker',
  name: 'Бункер',
  status: 'mvp',
  minPlayers: 4,
  maxPlayers: 16,
  defaultSettings: { roundSeconds: 300, votingSeconds: 45, revealMode: 'private_table', contentPackId: 'classic' },
  settingsSchema: {
    roundSeconds: { type: 'number', values: [180, 300, 420] },
    votingSeconds: { type: 'number', values: [30, 45, 60] },
    revealMode: { type: 'mode', values: ['private_table', 'public_turns'] },
    contentPackId: { type: 'content-pack', values: ['classic', 'hard_medical', 'party18', 'corporate', 'space', 'mystic', 'wasteland'] },
  },
};

export const bunkerCardFields = [
  { id: 'profession', label: 'Профессия', publicHint: 'Что умеет делать человек' },
  { id: 'age', label: 'Возраст', publicHint: 'Сколько лет персонажу' },
  { id: 'biology', label: 'Биология', publicHint: 'Сильная или слабая сторона тела' },
  { id: 'health', label: 'Здоровье', publicHint: 'Болезнь, ограничение или норма' },
  { id: 'skill', label: 'Навык', publicHint: 'Практическая польза в бункере' },
  { id: 'baggage', label: 'Багаж', publicHint: 'Что принёс с собой' },
  { id: 'goal', label: 'Цель', publicHint: 'Личная мотивация персонажа' },
  { id: 'fact', label: 'Факт', publicHint: 'Секрет или странность' },
  { id: 'special', label: 'Спец-карта', publicHint: 'Разовое действие или сильный аргумент' },
];

export const bunkerContentPacks = [
  {
    id: 'classic',
    name: 'Классический бункер',
    description: 'Базовый набор катастроф, профессий, здоровья, целей, багажа и секретов.',
    tier: 'free',
    priceRub: 0,
    status: 'playable',
  },
  {
    id: 'hard_medical',
    name: 'Жёсткие болезни',
    description: 'Больше медицинских рисков, спорных диагнозов и моральных дилемм.',
    tier: 'premium',
    priceRub: 149,
    status: 'draft',
  },
  {
    id: 'party18',
    name: '18+ вечеринка',
    description: 'Абсурдные факты, токсичные привычки и компромат для взрослой компании.',
    tier: 'premium',
    priceRub: 149,
    status: 'draft',
    ageRating: '18+',
  },
  {
    id: 'corporate',
    name: 'Корпоратив',
    description: 'Офис, KPI, выживание отдела и люди, которые слишком любят совещания.',
    tier: 'premium',
    priceRub: 99,
    status: 'draft',
  },
  {
    id: 'space',
    name: 'Космос',
    description: 'Бункер становится кораблём, а место получают только нужные колонисты.',
    tier: 'premium',
    priceRub: 149,
    status: 'draft',
  },
  {
    id: 'mystic',
    name: 'Мистика',
    description: 'Аномалии, проклятия и персонажи, которым сложно верить.',
    tier: 'premium',
    priceRub: 149,
    status: 'draft',
  },
  {
    id: 'wasteland',
    name: 'Постапокалипсис',
    description: 'Рейдеры, пустоши, вода как валюта и бункер без права на ошибку.',
    tier: 'premium',
    priceRub: 149,
    status: 'draft',
  },
];

const classicPool = {
  catastrophes: [
    'Глобальная пылевая буря закрыла солнце на несколько лет.',
    'Неизвестный вирус заставил города закрыться один за другим.',
    'Сеть спутников сошла с орбиты, связь и навигация исчезли.',
    'Океан поднялся, прибрежные города ушли под воду.',
    'Роботы обслуживания решили, что людям нужен строгий карантин.',
    'Запасы кофе на планете внезапно испортились. Паника началась мгновенно.',
  ],
  shelters: [
    'Автономный бункер под старым санаторием: медблок, теплица, библиотека, 18 месяцев запасов.',
    'Научное убежище в метро: лаборатория, мастерская, слабая вентиляция, много инструментов.',
    'Военный склад в горах: генератор, оружейная, сухпайки, но почти нет медикаментов.',
    'Частный подземный дом: кухня, спортзал, кинозал, маленькая оранжерея и странный ИИ-дворецкий.',
    'Сельский погреб-комплекс: семена, вода из скважины, радиостанция, тесные жилые отсеки.',
  ],
  scenarioGoals: [
    'Восстановить первую безопасную общину после открытия дверей.',
    'Пережить 18 месяцев и выйти наружу с рабочим планом снабжения.',
    'Сохранить знания, медицину и навыки для следующего поколения.',
    'Найти лекарство и проверить, можно ли снова жить на поверхности.',
    'Запустить ферму и радиосвязь, чтобы собрать выживших вокруг бункера.',
    'Выбрать команду, которая не развалится от конфликтов в замкнутом пространстве.',
  ],
  professions: ['врач', 'инженер', 'повар', 'психолог', 'агроном', 'электрик', 'учитель', 'строитель', 'биолог', 'переводчик', 'механик', 'журналист', 'охранник', 'ветеринар', 'химик', 'музыкант'],
  ages: ['19 лет', '24 года', '27 лет', '33 года', '36 лет', '42 года', '47 лет', '58 лет'],
  biology: ['отличная выносливость', 'быстро учится', 'острое зрение', 'спокойный лидер', 'не переносит холод', 'аллергия на пыль', 'бессонница', 'крепкий иммунитет'],
  health: ['здоров', 'хроническая мигрень', 'нужны очки', 'панические атаки в темноте', 'перенёс операцию на колене', 'редко болеет', 'плохой слух на одно ухо', 'быстро устаёт без еды'],
  skills: ['умеет чинить генераторы', 'знает первую помощь', 'выращивает зелень дома', 'ведёт переговоры без крика', 'может готовить из чего угодно', 'умеет организовать людей', 'знает основы химии', 'умеет фильтровать воду'],
  baggage: ['ящик консервов', 'аптечка', 'набор инструментов', 'семена овощей', 'солнечная панель', 'радиоприёмник', 'настольные игры', '20 метров верёвки', 'ноутбук без интернета', 'коробка батареек'],
  goals: ['найти семью после выхода', 'сохранить знания для детей', 'построить новую ферму', 'доказать, что достоин доверия', 'дожить до открытия бункера', 'возглавить группу', 'искупить старую ошибку', 'вывести наружу дневник катастрофы'],
  facts: ['тайно боится ответственности', 'однажды спас незнакомца', 'умеет убедительно врать', 'всем должен денег', 'знает вход в соседний тоннель', 'плохо переносит чужой храп', 'пишет дневник катастрофы', 'не ест мясо'],
  specialCards: [
    'Иммунитет: один раз можете отменить голос против себя.',
    'Досье: попросите любого игрока открыть одно скрытое поле.',
    'Обмен: предложите обменяться багажом с другим игроком.',
    'Второй шанс: после исключения получите 30 секунд финальной речи.',
    'Секретный ресурс: ваш багаж считается вдвое полезнее, если вы его раскрыли.',
    'Ремонтный рывок: если вы инженер, механик или электрик, получите сильный аргумент за место.',
  ],
};

const bunkerPools = {
  classic: classicPool,
  hard_medical: {
    ...classicPool,
    health: ['диабет без полного запаса инсулина', 'эпилепсия', 'последствия тяжёлой травмы', 'носитель редкой инфекции', 'аллергия на антибиотики', 'здоров, но скрывает фобию крови'],
    scenarioGoals: ['Найти лекарство до выхода наружу.', 'Собрать медицинский протокол для новой общины.', 'Решить, кого можно спасти при дефиците препаратов.'],
    specialCards: ['Карантин: заставьте игрока скрыть здоровье до голосования.', 'Консилиум: откройте здоровье двух игроков.', 'Запас лекарств: снимите один медицинский минус со своей речи.'],
  },
  party18: {
    ...classicPool,
    facts: ['помнит компромат на половину комнаты', 'устроил вечеринку в день эвакуации', 'путает честность и флирт', 'не умеет хранить секреты', 'слишком харизматичен, когда врёт'],
    scenarioGoals: ['Пережить бункер и не переругаться окончательно.', 'Выбрать людей, с которыми не страшно провести год без интернета.', 'Сохранить мораль группы, даже если все всё про всех узнают.'],
    specialCards: ['Компромат: заставьте игрока открыть факт.', 'Очарование: попросите не голосовать против вас один круг.', 'Слух: выберите игрока, он должен открыть цель или факт.'],
  },
  corporate: {
    ...classicPool,
    professions: ['тимлид', 'HR', 'бухгалтер', 'продакт', 'системный админ', 'юрист', 'офис-менеджер', 'аналитик'],
    baggage: ['ноутбук с таблицами', 'коробка бейджей', 'кофемашина', 'папка договоров', 'склад канцтоваров', 'пауэрбанк на 50000 мАч'],
    scenarioGoals: ['Построить новую компанию после конца старого мира.', 'Выжить в бункере и не превратить его в бесконечное совещание.', 'Собрать команду, которая умеет делать, а не только обсуждать.'],
    specialCards: ['Совещание: заставьте всех за 20 секунд сказать, зачем они нужны.', 'KPI: откройте навык любого игрока.', 'Отпуск: пропустите одно голосование против себя.'],
  },
  space: {
    ...classicPool,
    catastrophes: ['Земля больше не пригодна для жизни, последний корабль уходит к колонии.', 'Орбитальная станция повреждена, спасательная капсула берёт только половину экипажа.'],
    shelters: ['Колониальный модуль: гидропоника, медкапсула, слабый двигатель, запас кислорода на 14 месяцев.', 'Корабль-ковчег: лаборатория, криосон, ремонтный отсек и один подозрительно молчаливый автопилот.'],
    scenarioGoals: ['Собрать экипаж для основания первой колонии.', 'Долететь до планеты и не потерять ключевые навыки.', 'Выбрать людей, которые выдержат изоляцию и полёт.'],
    specialCards: ['Криокапсула: один раз переживите исключение без права голоса в следующем круге.', 'Сканер: откройте здоровье любого игрока.', 'Автопилот: поменяйте порядок вскрытия двух игроков.'],
  },
  mystic: {
    ...classicPool,
    catastrophes: ['Над городами появились зоны, где перестали работать причинно-следственные связи.', 'После ночного сияния люди начали слышать голоса из закрытых помещений.'],
    scenarioGoals: ['Выяснить природу аномалии и не впустить её в убежище.', 'Сохранить рациональность группы, когда факты больше не сходятся.', 'Выбрать тех, кому можно доверять при необъяснимых событиях.'],
    specialCards: ['Предчувствие: посмотрите одно скрытое поле игрока.', 'Проклятая метка: вынудите игрока открыть спец-карту.', 'Зеркало: скопируйте эффект последней сыгранной спец-карты.'],
  },
  wasteland: {
    ...classicPool,
    catastrophes: ['После ресурсных войн вода стала главной валютой, города держатся на караванах.', 'Пустошь растёт каждый месяц, а безопасных укрытий почти не осталось.'],
    shelters: ['Бетонный узел под старой дамбой: фильтры воды, склад топлива, мало еды и плохая вентиляция.', 'Бункер караванщиков: мастерская, оружейный шкаф, радиомаяк и конфликт с соседней базой.'],
    scenarioGoals: ['Создать базу, способную торговать и защищаться.', 'Наладить воду, еду и охрану до первого выхода наружу.', 'Выбрать команду, которая выдержит рейды и дефицит.'],
    specialCards: ['Канистра воды: получите сильный аргумент против исключения.', 'Рейд: заставьте игрока открыть багаж.', 'Бартер: обменяйте свою спец-карту на багаж другого игрока.'],
  },
};

function pick(list, random) {
  return list[Math.floor(random() * list.length)];
}

function contentPack(id) {
  return bunkerPools[id] || bunkerPools.classic;
}

function emptyReveals(playerIds) {
  return Object.fromEntries(playerIds.map((playerId) => [playerId, Object.fromEntries(bunkerCardFields.map((field) => [field.id, false]))]));
}

export function normalizeBunkerSettings(settings = {}) {
  const seconds = Number(settings.roundSeconds);
  const votingSeconds = Number(settings.votingSeconds);
  const revealMode = bunkerDefinition.settingsSchema.revealMode.values.includes(settings.revealMode) ? settings.revealMode : bunkerDefinition.defaultSettings.revealMode;
  const contentPackId = bunkerDefinition.settingsSchema.contentPackId.values.includes(settings.contentPackId) ? settings.contentPackId : bunkerDefinition.defaultSettings.contentPackId;
  return {
    roundSeconds: bunkerDefinition.settingsSchema.roundSeconds.values.includes(seconds) ? seconds : bunkerDefinition.defaultSettings.roundSeconds,
    votingSeconds: bunkerDefinition.settingsSchema.votingSeconds.values.includes(votingSeconds) ? votingSeconds : bunkerDefinition.defaultSettings.votingSeconds,
    revealMode,
    contentPackId,
  };
}

export function createBunkerRound(room, random = Math.random) {
  const activePlayers = room.players.filter((player) => player.online);
  const playerIds = activePlayers.map((player) => player.id);
  const pool = contentPack(room.settings.contentPackId);
  const cards = {};
  for (const player of activePlayers) {
    cards[player.id] = {
      profession: pick(pool.professions, random),
      age: pick(pool.ages, random),
      biology: pick(pool.biology, random),
      health: pick(pool.health, random),
      skill: pick(pool.skills, random),
      baggage: pick(pool.baggage, random),
      goal: pick(pool.goals, random),
      fact: pick(pool.facts, random),
      special: pick(pool.specialCards, random),
    };
  }
  return {
    number: 1,
    phase: 'briefing',
    catastrophe: pick(pool.catastrophes, random),
    shelter: pick(pool.shelters, random),
    scenarioGoal: pick(pool.scenarioGoals, random),
    shelterCapacity: Math.max(2, Math.floor(activePlayers.length / 2)),
    contentPackId: room.settings.contentPackId,
    cards,
    acceptedRuleIds: [],
    revealOrder: playerIds,
    currentRevealIndex: 0,
    bunkerReveals: emptyReveals(playerIds),
    eliminatedIds: [],
    seenIds: [],
    startedAt: null,
    endsAt: null,
    votingEndsAt: null,
    votes: {},
    voteRound: 1,
    voteCandidateIds: null,
    voteStartRequestIds: [],
    result: null,
  };
}

export function startBunkerAfterBriefing(room) {
  if (!room.round || room.round.phase !== 'briefing') return;
  if (room.settings.revealMode === 'public_turns') {
    room.round.phase = 'public_reveal';
    room.round.currentRevealIndex = 0;
    return;
  }
  room.round.phase = 'role_reveal';
}

export function continueBunkerRound(room) {
  room.round.number += 1;
  room.round.phase = 'discussion';
  room.round.startedAt = Date.now();
  room.round.endsAt = Date.now() + room.settings.roundSeconds * 1000;
  room.round.votingEndsAt = null;
  room.round.votes = {};
  room.round.voteRound = 1;
  room.round.voteCandidateIds = null;
  room.round.voteStartRequestIds = [];
  room.round.result = null;
}

export function getBunkerPlayerCard(room, playerId) {
  if (!room.round) return null;
  return {
    ...room.round.cards?.[playerId],
    eliminated: room.round.eliminatedIds?.includes(playerId) || false,
  };
}

export function currentBunkerRevealPlayer(room) {
  const order = room.round?.revealOrder || [];
  return order[room.round?.currentRevealIndex || 0] || null;
}

export function publicBunkerCards(room) {
  const reveals = room.round?.bunkerReveals || {};
  const eliminated = new Set(room.round?.eliminatedIds || []);
  return room.players.map((player) => {
    const card = room.round?.cards?.[player.id] || {};
    const playerReveals = reveals[player.id] || {};
    return {
      playerId: player.id,
      playerName: player.name,
      eliminated: eliminated.has(player.id),
      fields: bunkerCardFields.map((field) => ({
        ...field,
        revealed: Boolean(playerReveals[field.id]),
        value: playerReveals[field.id] ? card[field.id] : null,
      })),
    };
  });
}

export function bunkerActiveContestants(room) {
  const eliminated = new Set(room.round?.eliminatedIds || []);
  return room.players.filter((player) => player.online && !eliminated.has(player.id));
}
