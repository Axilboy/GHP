function items(entries) {
  return entries.map(([id, name, roles]) => ({ id, name, roles }));
}

function itemDictionary(id, name, description, category, priceRub, cover, free, entries) {
  return {
    id,
    name,
    description,
    category,
    priceRub,
    cover,
    free,
    subjectType: 'item',
    countLabel: 'предметов',
    locations: items(entries),
  };
}

const itemRoles = ['Владелец', 'Покупатель', 'Продавец', 'Мастер', 'Пользователь', 'Потерявший'];
const more = (prefix, names) => names.map((name, index) => [`${prefix}_${index + 1}`, name, itemRoles]);

export const HOME_ITEMS_DICTIONARY = itemDictionary('items_home', 'Дом и быт', 'Повседневные вещи, которые легко обсуждать и сложно не выдать лишней деталью.', 'Предметы', 0, 'items_home', true, [
  ['microwave', 'Микроволновка', ['Хозяин кухни', 'Гость', 'Мастер по ремонту', 'Покупатель', 'Сосед', 'Курьер']],
  ['umbrella', 'Зонт', ['Владелец', 'Потерявший', 'Прохожий', 'Продавец', 'Ребёнок', 'Сосед']],
  ['backpack', 'Рюкзак', ['Студент', 'Путешественник', 'Владелец', 'Продавец', 'Курьер', 'Друг']],
  ['toothbrush', 'Зубная щётка', ['Владелец', 'Сосед по комнате', 'Стоматолог', 'Покупатель', 'Гость', 'Родитель']],
  ...more('home_item', ['Чайник', 'Плед', 'Фен', 'Настольная лампа', 'Пульт от телевизора', 'Ключи', 'Зарядка', 'Кружка', 'Подушка', 'Ножницы', 'Зеркало', 'Сковородка']),
]);

export const PARTY_ITEMS_DICTIONARY = itemDictionary('items_party', 'Вещи вечеринки', 'Предметы, которые появляются на кухне, столе и танцполе во время шумной встречи.', 'Предметы', 0, 'items_party', true, [
  ...more('party_item', ['Колонка', 'Штопор', 'Игральные карты', 'Настолка', 'Гирлянда', 'Пакет льда', 'Одноразовый стаканчик', 'Микрофон караоке', 'Пицца', 'Бенгальский огонь', 'Пауэрбанк', 'Фотоаппарат']),
]);

export const GADGET_ITEMS_DICTIONARY = itemDictionary('items_gadgets', 'Гаджеты', 'Техника, аксессуары и устройства, про которые у каждого найдётся вопрос.', 'Техника', 129, 'items_gadgets', false, [
  ...more('gadget_item', ['Смартфон', 'Умные часы', 'Наушники', 'Игровая приставка', 'Ноутбук', 'Дрон', 'VR-шлем', 'Планшет', 'Робот-пылесос', 'Экшн-камера', 'Электросамокат', 'Умная колонка']),
]);

export const COUPLE_ITEMS_DICTIONARY = itemDictionary('items_couples', 'Предметы для влюбленных', 'Милые, романтичные и слегка неловкие вещи для пар и двойных свиданий.', 'Романтика', 149, 'items_couples', false, [
  ...more('couple_item', ['Кольцо', 'Букет', 'Подарочная коробка', 'Парные браслеты', 'Плед для пикника', 'Свеча', 'Фотоальбом', 'Билет в кино', 'Письмо', 'Ключ от квартиры', 'Десерт', 'Мягкая игрушка']),
]);

export const ADULT_ITEMS_DICTIONARY = itemDictionary('items_after_dark', '18+ намёки', 'Взрослые, но безопасные для игры предметы: больше намёков, меньше прямоты.', '18+', 179, 'items_after_dark', false, [
  ...more('adult_item', ['Маска для сна', 'Аромасвеча', 'Шёлковый халат', 'Бутылка шампанского', 'Красная помада', 'Парфюм', 'Приглашение на свидание', 'Ключ-карта от номера', 'Плейлист', 'Украшение', 'Шоколад', 'Записка']),
]);

export const WEIRD_ITEMS_DICTIONARY = itemDictionary('items_weird', 'Странные вещи', 'Неожиданные предметы, из-за которых раунд быстро становится смешным.', 'Юмор', 129, 'items_weird', false, [
  ...more('weird_item', ['Резиновая утка', 'Сломанный будильник', 'Пакет с пакетами', 'Сувенирный магнит', 'Носок без пары', 'Пластиковая корона', 'Игрушечная рация', 'Ложка для обуви', 'Светящийся браслет', 'Фальшивые усы', 'Пустая коробка', 'Секретная флешка']),
]);

export const ALCOHOL_ITEMS_DICTIONARY = itemDictionary('items_alcohol', 'Виды алкоголя', 'Напитки для взрослой компании: угадывать можно по бокалу, вкусу, поводу и подаче.', '18+', 179, 'items_alcohol', false, [
  ...more('alcohol_item', ['Вино', 'Шампанское', 'Пиво', 'Сидр', 'Виски', 'Ром', 'Текила', 'Джин', 'Водка', 'Ликёр', 'Коктейль', 'Глинтвейн']),
]);

export const COMPUTER_GAMES_ITEMS_DICTIONARY = itemDictionary('items_computer_games', 'Компьютерные игры', 'Игровые жанры, устройства и привычные вещи из мира геймеров.', 'Игры', 149, 'items_computer_games', false, [
  ...more('computer_game_item', ['Геймпад', 'Клавиатура', 'Игровая мышь', 'Гарнитура', 'Стрим', 'Рейд', 'Баттл-рояль', 'Пиксельная игра', 'Квест', 'Симулятор', 'Аркада', 'Киберспорт']),
]);

export const ITEM_SPY_DICTIONARIES = [
  HOME_ITEMS_DICTIONARY,
  PARTY_ITEMS_DICTIONARY,
  GADGET_ITEMS_DICTIONARY,
  COUPLE_ITEMS_DICTIONARY,
  ADULT_ITEMS_DICTIONARY,
  WEIRD_ITEMS_DICTIONARY,
  ALCOHOL_ITEMS_DICTIONARY,
  COMPUTER_GAMES_ITEMS_DICTIONARY,
];
