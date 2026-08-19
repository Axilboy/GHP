export const truthDareDefinition = {
  id: 'truthdare',
  name: 'Правда или действие',
  status: 'mvp',
  minPlayers: 2,
  maxPlayers: 20,
  playModes: ['party'],
  defaultSettings: { decks: ['party'], targetScore: 10 },
  settingsSchema: {
    decks: { type: 'dictionary-list' },
    targetScore: { type: 'number', min: 5, max: 30 },
  },
  plannedFeatures: ['Правда', 'Действие', 'Случайный игрок', 'Счёт выполненных заданий'],
};

// Уровень дерзости карточки: 1 — разогрев, 2 — вечеринка, 3 — смелые.
// Колода объявляет свои уровни и получает все универсальные карточки этих
// уровней плюс собственные тематические. Поэтому даже небольшая тематическая
// колода не начинает повторяться на втором круге.
export const truthDareDecks = [
  { id: 'family', name: 'Лёгкий', description: 'Добрые вопросы и простые задания для любой компании.', free: true, tier: 'free', levels: [1] },
  { id: 'party', name: 'Вечеринка', description: 'Больше смеха, воспоминаний и маленьких вызовов.', free: true, tier: 'free', levels: [1, 2] },
  { id: 'drinks', name: 'Бар и друзья', description: 'Мягкие взрослые карточки для застолья и шумной кухни.', tier: 'premium', ageRating: '18+', levels: [2] },
  { id: 'couples', name: 'Для влюблённых', description: 'Вопросы для свиданий, пар и двойных встреч.', tier: 'premium', levels: [1, 2] },
  { id: 'adult_couples', name: '18+ для пар', description: 'Откровеннее, но без грубости: для взрослых пар.', tier: 'premium', ageRating: '18+', levels: [2, 3] },
  { id: 'adult_party', name: '18+ вписка', description: 'Смелые карточки для совершеннолетней компании.', tier: 'premium', ageRating: '18+', levels: [2, 3] },
  { id: 'fandom', name: 'Фан-вселенные', description: 'Вопросы и задания для фанатов кино, игр, фэнтези и фантастики.', tier: 'premium', levels: [1, 2] },
  { id: 'harry_potter', name: 'Гарри Поттер', description: 'Магические вопросы, факультеты, квиддич и школьные дуэли.', tier: 'premium', levels: [1, 2] },
  { id: 'lotr', name: 'Властелин колец', description: 'Карточки для отряда, который готов спорить о кольце и походе.', tier: 'premium', levels: [1, 2] },
  { id: 'retro_movies', name: 'Ретро-кино', description: 'VHS, боевики, хорроры, культовые сцены и старый добрый пафос.', tier: 'premium', levels: [1, 2] },
  { id: 'video_games', name: 'Видеоигры', description: 'Рейды, лут, боссы, киберспорт и задания для игроков.', tier: 'premium', levels: [1, 2] },
  { id: 'bold', name: 'Смелый', description: 'Острее, но без жести: для компаний, которые уже разогрелись.', tier: 'premium', levels: [3] },
];

// В тексте карточки можно подставить живых людей за столом:
// {игрок} — случайный другой участник, {сосед} — сосед слева.
// Одна и та же подстановка внутри карточки всегда даёт одно и то же имя.
const UNIVERSAL = {
  truth: [
    { text: 'Что ты сделал за последний год, чем действительно гордишься?', level: 1 },
    { text: 'Какую вещь ты хранишь без всякой пользы и не можешь выбросить?', level: 1 },
    { text: 'О чём ты соврал в последний раз и зачем?', level: 1 },
    { text: 'Что ты умеешь делать лучше, чем о тебе думают?', level: 1 },
    { text: 'Какая привычка {игрок} тебе искренне нравится?', level: 1 },
    { text: 'Что ты гуглил последним? Покажи или расскажи честно.', level: 1 },
    { text: 'Какой совет ты часто даёшь другим, но сам ему не следуешь?', level: 1 },
    { text: 'За что ты был бы готов извиниться перед {игрок}, даже за мелочь?', level: 1 },
    { text: 'Сколько времени в день ты реально тратишь на телефон? Открой экранное время.', level: 2 },
    { text: 'Какое сообщение ты писал и стёр, так и не отправив?', level: 2 },
    { text: 'Что тебя раздражает в этой компании, но ты молчишь из вежливости?', level: 2 },
    { text: 'Какой поступок из прошлого ты бы отменил, будь такая кнопка?', level: 2 },
    { text: 'На что ты потратил деньги и до сих пор об этом жалеешь?', level: 2 },
    { text: 'В чём ты завидуешь {игрок}?', level: 2 },
    { text: 'Какую свою черту ты старательно прячешь от новых знакомых?', level: 2 },
    { text: 'Когда ты последний раз плакал и из-за чего?', level: 2 },
    { text: 'Что ты делал, когда был уверен, что тебя никто не видит?', level: 3 },
    { text: 'Кому в этой комнате ты бы доверил свой разблокированный телефон на час?', level: 3 },
    { text: 'Какой самый неловкий момент случился у тебя со свиданием?', level: 3 },
    { text: 'О чём ты думал, когда впервые увидел {игрок}?', level: 3 },
    { text: 'Какую тайну ты хранишь дольше пяти лет? Можно намёком.', level: 3 },
    { text: 'Что бы ты сделал, если бы неделя прошла без последствий?', level: 3 },
  ],
  dare: [
    { text: 'Дай {игрок} пять и скажи, за что ты его ценишь. Без шуток.', level: 1 },
    { text: 'Поменяйся местами с {сосед} и оставайся там до конца круга.', level: 1 },
    { text: 'Позвони {игрок} прямо отсюда и продержи разговор 20 секунд.', level: 1 },
    { text: 'Отдай телефон {сосед} — он ставит следующую песню, ты не споришь.', level: 1 },
    { text: 'Говори следующие два круга только шёпотом.', level: 1 },
    { text: 'Изобрази, как {игрок} заходит в комнату. Остальные угадывают.', level: 1 },
    { text: 'Сделай общее селфи так, чтобы в кадр попали все.', level: 1 },
    { text: 'Следующий круг ты обязан начинать любую фразу со слова «Итак».', level: 1 },
    { text: 'Открой галерею и покажи 7-е фото снизу. Без выбора.', level: 2 },
    { text: 'Дай {игрок} написать одно сообщение от твоего имени кому угодно из списка.', level: 2 },
    { text: 'Покажи последний диалог в мессенджере — три верхних сообщения.', level: 2 },
    { text: 'Скажи {игрок} то, что давно хотел сказать, но не было повода.', level: 2 },
    { text: 'Сделай 15 приседаний, считая вслух с ошибками.', level: 2 },
    { text: 'Отдай {сосед} свой телефон на два круга. Он держит его экраном вниз.', level: 2 },
    { text: 'Позволь {игрок} задать тебе один любой вопрос вне очереди.', level: 2 },
    { text: 'Спой припев песни, которую последней слушал. Не признаваться нельзя.', level: 2 },
    { text: 'Покажи свою переписку с человеком, который в контактах записан не по имени.', level: 3 },
    { text: 'Позвони {игрок} и скажи одну неудобную правду в лицо.', level: 3 },
    { text: 'Дай компании выбрать тебе фото профиля на сутки.', level: 3 },
    { text: 'Расскажи о самом смелом своём поступке так, будто это было вчера.', level: 3 },
    { text: 'Обними {игрок} и держи объятие, пока компания считает до десяти.', level: 3 },
    { text: 'Отправь {игрок} голосовое сообщение с комплиментом прямо сейчас.', level: 3 },
  ],
};

const DECK_PROMPTS = {
  family: {
    truth: [
      { text: 'Какое семейное правило тебя раздражало в детстве, а теперь кажется разумным?', level: 1 },
      { text: 'Кем ты хотел стать в семь лет?', level: 1 },
      { text: 'За что тебя чаще всего хвалили в школе?', level: 1 },
      { text: 'Какой запах мгновенно возвращает тебя в детство?', level: 1 },
      { text: 'Что {игрок} делает лучше тебя, и ты это признаёшь?', level: 1 },
      { text: 'Какое блюдо ты готов есть каждый день?', level: 1 },
    ],
    dare: [
      { text: 'Расскажи анекдот. Если никто не засмеялся — карточка не засчитана.', level: 1 },
      { text: 'Изобрази любимое животное {игрок} без слов.', level: 1 },
      { text: 'Придумай прозвище каждому за столом за 30 секунд.', level: 1 },
      { text: 'Нарисуй {сосед} за 20 секунд и покажи всем.', level: 1 },
      { text: 'Скажи скороговорку три раза подряд без запинки.', level: 1 },
      { text: 'Станцуй десять секунд без музыки.', level: 1 },
    ],
  },
  party: {
    truth: [
      { text: 'Что было самым глупым решением на вечеринке в твоей жизни?', level: 2 },
      { text: 'Кого из компании ты первым позовёшь, если нужно срочно уехать из города?', level: 2 },
      { text: 'Какое сообщение ты однажды отправил не тому человеку?', level: 2 },
      { text: 'За что тебе до сих пор неловко перед {игрок}?', level: 2 },
      { text: 'Какую вечеринку ты помнишь хуже всего и почему?', level: 2 },
      { text: 'Что ты обещал компании и так и не сделал?', level: 2 },
    ],
    dare: [
      { text: 'Произнеси тост за компанию так, будто вы выиграли премию.', level: 2 },
      { text: 'Пусть {игрок} выберет тебе позу — держи её один круг.', level: 2 },
      { text: 'Говори следующий круг только вопросами.', level: 2 },
      { text: 'Изобрази, как проходит утро после этой вечеринки.', level: 2 },
      { text: 'Дай {сосед} придумать тебе акцент — говори с ним до своего следующего хода.', level: 2 },
      { text: 'Сделай самое серьёзное лицо и продержись, пока компания шутит 20 секунд.', level: 2 },
    ],
  },
  drinks: {
    truth: [
      { text: 'Какой тост ты бы сказал этой компании прямо сейчас?', level: 2 },
      { text: 'Что ты заказываешь, когда не хочешь ничего решать?', level: 2 },
      { text: 'Кто из компании лучше всех спасает неловкую паузу?', level: 2 },
      { text: 'Какая история с кухни или бара до сих пор тебя смешит?', level: 2 },
      { text: 'Кому ты доверил бы выбрать музыку на весь вечер?', level: 2 },
      { text: 'Что для тебя точный признак, что вечер удался?', level: 2 },
    ],
    dare: [
      { text: 'Произнеси короткий тост лично за {игрок}.', level: 2 },
      { text: 'Изобрази бармена, который готовит самый драматичный коктейль в мире.', level: 2 },
      { text: 'Назови каждому напиток, с которым он ассоциируется, и объясни одним словом.', level: 2 },
      { text: 'Чокнись с каждым по очереди, каждый раз с новым пожеланием.', level: 2 },
      { text: 'Придумай название сегодняшней встрече за 10 секунд.', level: 2 },
      { text: 'Пусть {сосед} закажет тебе следующий напиток — ты соглашаешься заранее.', level: 2 },
    ],
  },
  couples: {
    truth: [
      { text: 'Какой маленький жест заботы ты ценишь сильнее всего?', level: 1 },
      { text: 'Что для тебя важнее на свидании: план или спонтанность?', level: 1 },
      { text: 'Какой комплимент тебе запомнился надолго?', level: 1 },
      { text: 'Как ты понимаешь, что человек тебе действительно интересен?', level: 2 },
      { text: 'Что в тебе изменилось из-за отношений?', level: 2 },
      { text: 'Какую мелочь партнёра ты замечаешь первой?', level: 2 },
    ],
    dare: [
      { text: 'Скажи {игрок} комплимент без шутки и сарказма, глядя в глаза.', level: 1 },
      { text: 'Опиши идеальное свидание за 15 секунд.', level: 1 },
      { text: 'Придумай парное прозвище себе и {игрок}.', level: 2 },
      { text: 'Покажи жестами фильм про романтическую катастрофу.', level: 1 },
      { text: 'Напиши {игрок} записку с одним словом и передай, не показывая другим.', level: 2 },
      { text: 'Расскажи о человеке, в которого влюбился первым, за 20 секунд.', level: 2 },
    ],
  },
  adult_couples: {
    truth: [
      { text: 'Какая граница в отношениях для тебя точно важна?', level: 2 },
      { text: 'Что звучит для тебя смелее: честный разговор или красивый жест?', level: 2 },
      { text: 'Какой намёк ты обычно понимаешь слишком поздно?', level: 2 },
      { text: 'Что помогает тебе доверять человеку сильнее?', level: 3 },
      { text: 'О чём ты жалеешь, что не сказал вовремя?', level: 3 },
      { text: 'Что тебя привлекает в человеке раньше внешности?', level: 3 },
    ],
    dare: [
      { text: 'Скажи {игрок} элегантный комплимент, от которого неловко станет всем.', level: 2 },
      { text: 'Покажи взглядом три настроения: интерес, ревность, доверие.', level: 2 },
      { text: 'Придумай название плейлиста для взрослого свидания.', level: 2 },
      { text: 'Изобрази человека, который очень старается не выдать симпатию.', level: 3 },
      { text: 'Расскажи о самом смелом свидании в своей жизни без имён.', level: 3 },
      { text: 'Дай {игрок} задать тебе один вопрос, на который нельзя не ответить.', level: 3 },
    ],
  },
  adult_party: {
    truth: [
      { text: 'Какой флирт ты считаешь смешным, а не удачным?', level: 2 },
      { text: 'Какой секрет о себе ты готов открыть только этой компании?', level: 3 },
      { text: 'Что на вечеринке быстро превращает смелость в неловкость?', level: 2 },
      { text: 'Кому здесь ты бы доверил свой телефон разблокированным?', level: 3 },
      { text: 'Что ты однажды сделал на спор и до сих пор не рассказывал?', level: 3 },
      { text: 'Какая взрослая тема оказывается смешнее, чем кажется?', level: 2 },
    ],
    dare: [
      { text: 'Покажи, как ты входишь в комнату, где все ждут только тебя.', level: 2 },
      { text: 'Придумай {игрок} и себе общее кодовое имя и объясни его.', level: 2 },
      { text: 'Скажи самому харизматичному игроку, в чём его сила.', level: 2 },
      { text: 'Пусть компания выберет, кому ты отправишь сообщение «я всё помню».', level: 3 },
      { text: 'Расскажи историю, после которой тебя точно будут переспрашивать.', level: 3 },
      { text: 'Дай {сосед} прочитать вслух любое твоё сообщение из последних десяти.', level: 3 },
    ],
  },
  fandom: {
    truth: [
      { text: 'В какой вселенной ты бы продержался дольше всего?', level: 1 },
      { text: 'Какой архетип тебе ближе: лидер, хитрец, учёный или одиночка?', level: 1 },
      { text: 'О какой фанатской теории ты можешь спорить слишком долго?', level: 2 },
      { text: 'Кто здесь был бы финальным боссом, а кто наставником?', level: 2 },
      { text: 'Какая история однажды сильно повлияла на твой вкус?', level: 1 },
      { text: 'Какой фандом ты стесняешься признать своим?', level: 2 },
    ],
    dare: [
      { text: 'Объясни эту компанию как трейлер большой саги.', level: 1 },
      { text: 'Назови каждому жанровую роль: герой, маг, пилот, разведчик.', level: 1 },
      { text: 'Изобрази финального босса, которому не хватило кофе.', level: 1 },
      { text: 'Скажи эпичную фразу перед стартом квеста так, чтобы поверили.', level: 2 },
      { text: 'Придумай {игрок} суперспособность и её слабое место.', level: 2 },
      { text: 'Опиши свой день как описание квеста в игре.', level: 2 },
    ],
  },
  harry_potter: {
    truth: [
      { text: 'На какой факультет ты бы попал и почему именно туда?', level: 1 },
      { text: 'Какое заклинание в обычной жизни тебе нужно чаще всего?', level: 1 },
      { text: 'Какой предмет в школе волшебства ты бы точно прогуливал?', level: 1 },
      { text: 'Что бы показало твоё зеркало желаний?', level: 2 },
      { text: 'С кем из компании ты бы пошёл в Запретный лес?', level: 1 },
      { text: 'Какой твой боггарт на самом деле?', level: 2 },
    ],
    dare: [
      { text: 'Произнеси тост так, будто это речь в Большом зале.', level: 1 },
      { text: 'Распредели троих игроков по факультетам и объясни одним словом.', level: 1 },
      { text: 'Изобрази, как ты впервые садишься на метлу.', level: 1 },
      { text: 'Придумай заклинание, которое спасло бы этот вечер, и произнеси его.', level: 1 },
      { text: 'Проведи дуэль взглядами с {игрок}. Кто моргнул — проиграл.', level: 2 },
      { text: 'Объясни магловский предмет так, будто ты волшебник.', level: 2 },
    ],
  },
  lotr: {
    truth: [
      { text: 'Кто из компании был бы самым надёжным спутником в походе?', level: 1 },
      { text: 'Что бы соблазнило тебя быстрее всего, будь у тебя кольцо власти?', level: 2 },
      { text: 'Ты больше хоббит дома, эльф на стиле или гном на характере?', level: 1 },
      { text: 'Кого нельзя отпускать одного в Мордор?', level: 1 },
      { text: 'Какая вещь из твоего рюкзака стала бы легендарным артефактом?', level: 1 },
      { text: 'От чего ты бы отказался ради общего дела?', level: 2 },
    ],
    dare: [
      { text: 'Скажи эпичную речь перед походом к Роковой горе.', level: 1 },
      { text: 'Назови каждому роль в отряде и объясни выбор.', level: 1 },
      { text: 'Покажи, как ты защищаешь второй завтрак от всей компании.', level: 1 },
      { text: 'Произнеси «ты не пройдёшь» в самой драматичной версии.', level: 1 },
      { text: 'Придумай название таверны, где собрался бы ваш отряд.', level: 1 },
      { text: 'Поклянись {игрок} в верности так, чтобы это звучало как древняя клятва.', level: 2 },
    ],
  },
  retro_movies: {
    truth: [
      { text: 'Какой жанр ретро-фильма лучше всего описывает твою жизнь?', level: 1 },
      { text: 'Кто из компании пережил бы хоррор до финальных титров?', level: 1 },
      { text: 'Какая твоя привычка выглядит как из боевика девяностых?', level: 1 },
      { text: 'Какой фильм ты пересматривал больше пяти раз?', level: 1 },
      { text: 'Кто сказал бы лучшую финальную реплику?', level: 2 },
      { text: 'Какая сцена из кино тебя однажды по-настоящему напугала?', level: 2 },
    ],
    dare: [
      { text: 'Скажи финальную реплику героя перед взрывом на фоне.', level: 1 },
      { text: 'Изобрази трейлер фильма про эту компанию.', level: 1 },
      { text: 'Покажи, как ты находишь странную VHS-кассету.', level: 1 },
      { text: 'Придумай название культового боевика с {игрок} в главной роли.', level: 1 },
      { text: 'Сделай голосом диктора рекламу сегодняшней игры.', level: 2 },
      { text: 'Разыграй с {сосед} сцену прощания в аэропорту.', level: 2 },
    ],
  },
  video_games: {
    truth: [
      { text: 'В какой игре ты мог зависнуть до утра?', level: 1 },
      { text: 'Кто здесь был бы танком, хилером, снайпером и переговорщиком?', level: 1 },
      { text: 'Какой твой реальный навык выглядит как игровая способность?', level: 1 },
      { text: 'Что бесит сильнее: лаги, тиммейты или нечестный босс?', level: 1 },
      { text: 'За какую ачивку из жизни тебе давно пора дать награду?', level: 2 },
      { text: 'Сколько денег ты потратил в играх и не жалеешь?', level: 2 },
    ],
    dare: [
      { text: 'Назови каждому игровой класс и объясни выбор.', level: 1 },
      { text: 'Покажи свою победную анимацию после финального босса.', level: 1 },
      { text: 'Объясни сегодняшнюю встречу как задание из RPG.', level: 1 },
      { text: 'Скажи «это был не баг, а фича» максимально серьёзно.', level: 1 },
      { text: 'Придумай название легендарного лута, который лежит рядом с тобой.', level: 1 },
      { text: 'Проведи с {игрок} дуэль в камень-ножницы-бумага до двух побед.', level: 2 },
    ],
  },
  bold: {
    truth: [
      { text: 'Какой поступок ты считаешь смелым, но сам пока не решался?', level: 3 },
      { text: 'Кому здесь ты доверил бы выбрать тебе свидание?', level: 3 },
      { text: 'Какой флирт сработал на тебе неожиданно хорошо?', level: 3 },
      { text: 'Что ты скрываешь от людей, которые знают тебя дольше всех?', level: 3 },
      { text: 'Какое своё решение ты защищаешь, хотя сам в нём не уверен?', level: 3 },
      { text: 'Что бы ты сказал {игрок}, если бы это осталось без последствий?', level: 3 },
    ],
    dare: [
      { text: 'Скажи каждому по одной честной вещи. Не только приятной.', level: 3 },
      { text: 'Дай компании прочитать вслух твою последнюю заметку в телефоне.', level: 3 },
      { text: 'Позвони {игрок} и говори только правду 30 секунд.', level: 3 },
      { text: 'Сделай уверенный рекламный слоган для себя за 10 секунд.', level: 3 },
      { text: 'Пусть {сосед} задаст тебе вопрос, от которого нельзя уйти.', level: 3 },
      { text: 'Признайся компании в том, о чём молчал весь вечер.', level: 3 },
    ],
  },
};

const REFUSALS_PER_MATCH = 2;
const RECENT_MEMORY = 14;

export function normalizeTruthDareSettings(settings = {}) {
  const target = Number(settings.targetScore);
  // settings.deck — старое поле одной колоды: комнаты и сохранённые состояния,
  // созданные до мультивыбора, продолжают открываться.
  const requested = Array.isArray(settings.decks) ? settings.decks : settings.deck ? [settings.deck] : [];
  const decks = [...new Set(requested)].filter((id) => truthDareDecks.some((deck) => deck.id === id));
  return {
    decks: decks.length ? decks : [...truthDareDefinition.defaultSettings.decks],
    targetScore: Math.min(30, Math.max(5, Number.isFinite(target) ? target : truthDareDefinition.defaultSettings.targetScore)),
  };
}

function activePlayers(room) {
  return room.players.filter((player) => player.online);
}

// Пул складывается из всех выбранных колод: уровни объединяются, тематические
// карточки идут следом, дубли между колодами схлопываются по тексту.
export function truthDarePool(deckIds, type) {
  const requested = Array.isArray(deckIds) ? deckIds : [deckIds];
  const decks = requested.map((id) => truthDareDecks.find((item) => item.id === id)).filter(Boolean);
  const selected = decks.length ? decks : [truthDareDecks[1]];
  const levels = new Set(selected.flatMap((deck) => deck.levels || [1, 2]));
  const prompts = [
    ...UNIVERSAL[type].filter((prompt) => levels.has(prompt.level)),
    ...selected.flatMap((deck) => DECK_PROMPTS[deck.id]?.[type] || []),
  ];
  return [...new Map(prompts.map((prompt) => [prompt.text, prompt])).values()];
}

// Подставляет живых игроков вместо {игрок} и {сосед}. Имя выбирается один раз
// на карточку, чтобы внутри текста оно не менялось.
export function fillPromptNames(text, room, activePlayerId, random = Math.random) {
  const players = activePlayers(room);
  const others = players.filter((player) => player.id !== activePlayerId);
  if (!others.length) return text.replace(/\{игрок\}|\{сосед\}/g, 'сосед справа');
  const someone = others[Math.floor(random() * others.length)];
  const activeIndex = players.findIndex((player) => player.id === activePlayerId);
  const neighbour = players[(activeIndex + 1) % players.length] || someone;
  return text
    .replace(/\{игрок\}/g, someone.name)
    .replace(/\{сосед\}/g, neighbour.id === activePlayerId ? someone.name : neighbour.name);
}

function pickPrompt(room, type, random) {
  const pool = truthDarePool(room.settings.decks, type);
  const recent = new Set(room.truthDareUsed || []);
  const fresh = pool.filter((prompt) => !recent.has(prompt.text));
  const source = fresh.length ? fresh : pool;
  return source[Math.floor(random() * source.length)];
}

function startTurn(room) {
  const players = activePlayers(room);
  const turnIndex = Number.isFinite(room.truthDareTurnIndex) ? room.truthDareTurnIndex + 1 : 0;
  const activePlayer = players[turnIndex % players.length] || players[0];
  room.truthDareTurnIndex = turnIndex;
  return {
    number: (room.round?.number || 0) + 1,
    phase: 'truthdare_choice',
    turnIndex,
    activePlayerId: activePlayer?.id || null,
    activePlayerName: activePlayer?.name || 'Игрок',
    promptType: null,
    promptText: null,
    promptLevel: null,
    reviewVotes: {},
    result: null,
  };
}

export function createTruthDareRound(room) {
  const freshMatch = !Number.isFinite(room.truthDareTurnIndex) || room.truthDareTurnIndex < 0;
  if (freshMatch) {
    room.truthDareTurnIndex = -1;
    room.truthDareUsed = [];
    room.truthDareTokens = Object.fromEntries(room.players.map((player) => [player.id, REFUSALS_PER_MATCH]));
  }
  return startTurn(room);
}

export function refusalsLeft(room, playerId) {
  return room.truthDareTokens?.[playerId] ?? REFUSALS_PER_MATCH;
}

// Активный игрок выбирает правду или действие — только после этого он видит текст.
export function chooseTruthDarePrompt(room, type, random = Math.random) {
  const prompt = pickPrompt(room, type, random);
  room.truthDareUsed = [prompt.text, ...(room.truthDareUsed || [])].slice(0, RECENT_MEMORY);
  room.round.promptType = type;
  room.round.promptText = fillPromptNames(prompt.text, room, room.round.activePlayerId, random);
  room.round.promptLevel = prompt.level;
  room.round.phase = 'truthdare_turn';
  room.round.reviewVotes = {};
}

export function truthDareJury(room) {
  return activePlayers(room).filter((player) => player.id !== room.round?.activePlayerId);
}

export function submitTruthDareAnswer(room) {
  room.round.phase = 'truthdare_review';
  room.round.reviewVotes = {};
}

// Компания решает, засчитать ли карточку. Побеждает строгое большинство жюри,
// при равенстве голосов карточка не засчитывается.
export function voteTruthDare(room, playerId, accepted) {
  room.round.reviewVotes[playerId] = accepted;
  const jury = truthDareJury(room);
  const votes = Object.values(room.round.reviewVotes);
  const yes = votes.filter(Boolean).length;
  const no = votes.length - yes;
  if (yes * 2 > jury.length) return 'accepted';
  if (no * 2 > jury.length) return 'rejected';
  if (votes.length >= jury.length) return yes > no ? 'accepted' : 'rejected';
  return null;
}

function pushHistory(room, outcome) {
  room.matchHistory ??= [];
  room.matchHistory.unshift({
    round: room.round?.number || 1,
    playerId: room.round?.activePlayerId,
    playerName: room.round?.activePlayerName || 'Игрок',
    result: outcome,
    promptType: room.round?.promptType,
    at: Date.now(),
  });
  room.matchHistory = room.matchHistory.slice(0, 20);
}

// Завершает ход: начисляет очко, пишет историю и либо заканчивает матч,
// либо передаёт ход следующему игроку.
export function finishTruthDareTurn(room, outcome) {
  const activePlayerId = room.round?.activePlayerId;
  if (outcome === 'accepted' && activePlayerId) {
    room.scores[activePlayerId] = (room.scores[activePlayerId] || 0) + 1;
  }
  pushHistory(room, outcome);
  const score = room.scores[activePlayerId] || 0;
  if (outcome === 'accepted' && score >= room.settings.targetScore) {
    room.round.result = { winnerId: activePlayerId, winnerName: room.round.activePlayerName, score };
    room.round.phase = 'truthdare_result';
    room.state = 'match_result';
    return;
  }
  room.round = startTurn(room);
}

export function refuseTruthDare(room, playerId) {
  const left = refusalsLeft(room, playerId);
  if (left <= 0) throw new Error('Жетоны отказа закончились — придётся выполнять');
  room.truthDareTokens ??= {};
  room.truthDareTokens[playerId] = left - 1;
  pushHistory(room, 'refused');
  room.round = startTurn(room);
}
