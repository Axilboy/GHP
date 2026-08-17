import { useEffect, useRef, useState } from 'react';
import { localStore } from './browserStorage';
import { emit, socket } from './socket';
import { getOrCreateDisplayName, getPlayerId, saveAccount } from './identity';
import { trackClientEvent } from './shared/helpers';
import { FeedbackModal } from './shared/Header';
import { Setting } from './shared/ui';

const games = [
  { id: 'spy', name: 'Шпион', status: 'Доступно', art: 'spy' },
  { id: 'alias', name: 'Alias', status: 'Доступно', art: 'alias' },
  { id: 'bunker', name: 'Бункер', status: 'Доступно', art: 'bunker' },
];

function hasPartyPass(profile) {
  return profile?.partyPasses?.some((pass) => pass.activeUntil > Date.now());
}

function hasActiveGamePass(profile, gameId) {
  return Boolean(getActiveGamePass(profile, gameId));
}

function getActiveGamePass(profile, gameId) {
  return profile?.gamePasses?.find((pass) => pass.gameId === gameId && pass.activeUntil > Date.now()) || null;
}

function getActiveThemePass(profile, themeId) {
  return profile?.themePasses?.find((pass) => pass.themeId === themeId && pass.activeUntil > Date.now()) || null;
}

function formatPassUntil(activeUntil) {
  if (!activeUntil) return '';
  return new Date(activeUntil).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function normalizeCarouselLoop(element) {
  if (!element || element.dataset.loop !== 'true') return;
  const half = element.scrollWidth / 2;
  if (half <= element.clientWidth) return;
  if (element.scrollLeft >= half) element.scrollLeft -= half;
  if (element.scrollLeft < 0) element.scrollLeft += half;
}

function moveCarousel(ref, direction = 1) {
  const element = ref.current;
  if (!element) return;
  normalizeCarouselLoop(element);
  const firstCard = element.children?.[0];
  const gap = Number.parseFloat(getComputedStyle(element).columnGap || getComputedStyle(element).gap || '0') || 0;
  const step = firstCard ? firstCard.getBoundingClientRect().width + gap : Math.max(260, element.clientWidth * 0.92);
  element.scrollBy({ left: direction * step, behavior: 'smooth' });
  window.setTimeout(() => normalizeCarouselLoop(element), 520);
}

function useAutoCarousel(ref, deps = []) {
  useEffect(() => {
    const element = ref.current;
    if (!element || element.scrollWidth <= element.clientWidth) return undefined;
    const timer = setInterval(() => {
      if (element.matches(':hover') || document.hidden) return;
      moveCarousel(ref, 1);
    }, 10000);
    return () => clearInterval(timer);
  }, deps);
}

function trackStoreEvent(name, details = {}) {
  trackClientEvent(name, { page: 'store', ...details });
}

export function AdvancedSpySettings({ room, action, profile }) {
  const update = (patch) => action('update_settings', { settings: patch });
  const maxSpies = Math.max(1, room.players.filter((player) => player.online).length - 1);
  const spyAccess = Boolean(profile?.pro || profile?.proPlus || Number(profile?.subscription?.activeUntil || 0) > Date.now() || hasPartyPass(profile) || hasActiveGamePass(profile, 'spy'));
  const subjectType = room.settings.subjectType || 'location';

  return <>
    <Setting label="Что угадываем"><select value={subjectType} onChange={(event) => update({ subjectType: event.target.value })}><option value="location">Места</option><option value="item">Предметы</option></select></Setting>
    <Setting label="Шпионы"><select value={Math.min(room.settings.spyCount || 1, maxSpies)} onChange={(event) => update({ spyCount: Number(event.target.value) })}>{Array.from({ length: maxSpies }, (_, index) => { const value = index + 1; return <option key={value} value={value} disabled={value > 1 && !spyAccess}>{value}{value > 1 && !spyAccess ? ' · доступ' : ''}</option>; })}</select></Setting>
    <Setting label="Роли видны мирным"><input type="checkbox" checked={room.settings.revealRoles} onChange={(event) => update({ revealRoles: event.target.checked })} /></Setting>
    <Setting label={`Шпион может назвать ${subjectType === 'item' ? 'предмет' : 'локацию'}`}><input type="checkbox" checked={room.settings.allowSpyGuess} onChange={(event) => update({ allowSpyGuess: event.target.checked })} /></Setting>
    {!spyAccess && <p className="settings-note">Несколько шпионов и расширенные словари открываются в PRO, WeekendPass или Spy Pass.</p>}
  </>;
}

export function Storefront({ profile, setProfile, catalog, navigate }) {
  const [checkout, setCheckout] = useState(null);
  const [purchaseStatus, setPurchaseStatus] = useState('idle');
  const [purchaseError, setPurchaseError] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [offer, setOffer] = useState(null);
  const [proMonths, setProMonths] = useState(12);

  useEffect(() => {
    const orderId = new URLSearchParams(location.search).get('order');
    if (!orderId || profile?.accountType === 'guest') return;
    let active = true;
    setPurchaseStatus('checking');
    setPurchaseError('');
    emit('sync_order', { orderId }).then(({ profile: nextProfile, order }) => {
      if (!active) return;
      if (nextProfile) setProfile(nextProfile);
      if (order?.status === 'pending') setPurchaseError('Платёж ещё обрабатывается. Обновите магазин через несколько секунд.');
      if (order?.status === 'paid') {
        const trackedKey = `gamehubparty_purchase_tracked:${order.id}`;
        if (!localStore.getItem(trackedKey)) {
          localStore.setItem(trackedKey, '1');
          trackStoreEvent('payment_success', { type: order.type, productId: order.productId, amount_rub: order.amountRub || 0 });
          if (order.type === 'subscription' && order.productId === 'pro') {
            trackStoreEvent('pro_purchase', { months: order.months || 1, amount_rub: order.amountRub || 0 });
          }
        }
      }
      const url = new URL(location.href);
      url.searchParams.delete('order');
      history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }).catch((error) => {
      if (active) setPurchaseError(error.message || 'Не получилось проверить оплату. Напишите в поддержку.');
    }).finally(() => {
      if (active) setPurchaseStatus('idle');
    });
    return () => { active = false; };
  }, [profile?.accountType, setProfile]);

  const buy = async (type, productId, months = null) => {
    if (profile?.accountType === 'guest') {
      setAuthOpen(true);
      return;
    }
    setPurchaseError('');
    setPurchaseStatus('creating');
    trackStoreEvent('start_checkout', { type, productId, months: months || '' });
    try {
      const { profile: nextProfile, order, payment } = await emit('create_order', { type, productId, months });
      setProfile(nextProfile);
      if (payment?.confirmationUrl) {
        location.assign(payment.confirmationUrl);
        return;
      }
      setCheckout(order);
    } catch (error) {
      trackStoreEvent('payment_failed', { type, productId });
      setPurchaseError(error.message || 'Не удалось создать платёж. Попробуйте ещё раз.');
    } finally {
      setPurchaseStatus('idle');
    }
  };

  const confirmCheckout = async () => {
    const { profile: nextProfile } = await emit('confirm_demo_order', { orderId: checkout.id });
    trackStoreEvent('payment_success', { type: checkout.type, productId: checkout.productId });
    setProfile(nextProfile);
    setCheckout(null);
  };

  const products = buildStoreProducts(catalog, profile);
  const ownedProducts = products.filter((item) => item.owned);
  const weekend = products.find((item) => item.type === 'party_pass');
  const pro = products.find((item) => item.type === 'subscription');
  const gamePasses = products.filter((item) => item.group === 'games');
  const themePasses = products.filter((item) => item.group === 'themes');

  return <>
    {purchaseStatus === 'creating' && <p className="guest-name-note wrap">Готовим ссылку на оплату...</p>}
    {purchaseStatus === 'checking' && <p className="guest-name-note wrap">Проверяем оплату и открываем доступ...</p>}
    {purchaseError && <p className="form-error wrap">{purchaseError}</p>}

    <section className="store-hero-sale wrap">
      <div className="store-hero-copy">
        <span className="eyebrow">Доступ для комнаты</span>
        <h1>Платит один — играют все</h1>
        <p>Хост открывает доступ, друзья заходят по коду бесплатно. Реклама и ограничения уходят из комнаты.</p>
      </div>
      <div className="store-hero-proof">
        <span>Без рекламы</span>
        <span>Сразу после оплаты</span>
        <span>Чек на почту</span>
      </div>
    </section>

    {ownedProducts.length > 0 && <section className="store-active-access wrap">
      <span>Уже открыто</span>
      <b>{ownedProducts.map((item) => item.name).join(', ')}</b>
      <button className="button secondary small" onClick={() => navigate('home')}>Создать комнату</button>
    </section>}

    {pro && weekend && <PlanFork weekend={weekend} pro={pro} proMonths={proMonths} setProMonths={setProMonths} openOffer={setOffer} buy={buy} />}

    <ComparisonTable openPro={() => pro && setOffer(pro)} />

    <AddonCarousel eyebrow="Нужна одна игра" title="Game Pass" note="Расширения одной игры на месяц — если играете только в неё." items={gamePasses} openOffer={setOffer} />

    <AddonCarousel eyebrow="Настроение вечера" title="Тематические паки" note="Одна тема во всех играх на месяц. Сами игры и без рекламы — в WeekendPass, PRO или Game Pass." items={themePasses} openOffer={setOffer} />

    {profile?.accountType === 'guest' && <section className="wrap"><button className="auth-nudge" onClick={() => setAuthOpen(true)}><span><b>Войдите или зарегистрируйтесь</b><small>Покупки, чеки и восстановление доступа привязаны к почте.</small></span><strong>Войти</strong></button></section>}

    <section className="store-trust wrap">
      <article><b>Чек на почту</b><span>после каждой оплаты</span></article>
      <button type="button" onClick={() => setFeedbackOpen(true)}><b>Поддержка</b><span>открыть окно обратной связи</span></button>
    </section>

    <section className="store-faq wrap">
      <h2>Частые вопросы</h2>
      <details><summary>Нужно ли платить каждому игроку?</summary><p>Нет. Платит только хост комнаты — доступ и отключение рекламы действуют для всех, кто зашёл по коду.</p></details>
      <details><summary>Чем WeekendPass отличается от PRO?</summary><p>Ничем по возможностям — открывают одно и то же. WeekendPass действует 24 часа для одной встречи, PRO — месяц или год и выгоднее в пересчёте.</p></details>
      <details><summary>Что будет, когда доступ закончится?</summary><p>Ничего не пропадёт: базовые наборы всех игр останутся бесплатными, а покупки и история сохранятся в профиле.</p></details>
    </section>

    {offer && <OfferModal offer={offer} close={() => setOffer(null)} buy={(months = offer.months) => buy(offer.type, offer.productId, months)} />}
    {checkout && <CheckoutModal order={checkout} close={() => setCheckout(null)} confirm={confirmCheckout} />}
    {authOpen && <AuthModal close={() => setAuthOpen(false)} setProfile={setProfile} />}
    {feedbackOpen && <FeedbackModal close={() => setFeedbackOpen(false)} />}
  </>;
}

function buildAccessOffer(kind, pass = null) {
  if (kind === 'weekend') return {
    id: 'weekend',
    type: 'party_pass',
    productId: 'party_pass_24h',
    months: null,
    name: 'WeekendPass',
    kicker: 'Весь PRO — на один вечер',
    price: '149 ₽',
    short: 'Полный доступ как в PRO, только на 24 часа.',
    cta: 'Открыть вечер · 149 ₽',
    art: 'spy',
    slides: [
      { cover: 'party', title: 'Вся компания играет сегодня', text: 'Один хост открывает доступ, остальные просто заходят в комнату с телефона.' },
      { cover: 'city', title: 'Всё открыто на вечер', text: 'Все игры, наборы и режимы — то же, что в PRO, без отдельных покупок.' },
      { cover: 'drinks', title: 'Без рекламных пауз', text: 'Комната проходит вечер спокойнее: меньше ожидания, больше игры и меньше сбитого настроения.' },
    ],
    bullets: ['Все игры: Шпион, Alias, Бункер, Правда или действие', 'Все наборы, словари и тематические паки', 'Свои локации и расширенные режимы', 'Без рекламы в комнате — для всех, кто зашёл', 'Действует 24 часа · платит только хост'],
  };
  if (kind === 'pro') return {
    id: 'pro',
    type: 'subscription',
    productId: 'pro',
    months: 1,
    name: 'PRO подписка',
    kicker: 'Для тех, кто играет регулярно',
    price: 'от 249 ₽',
    short: 'То же, что WeekendPass, только постоянно — и выгоднее.',
    cta: 'Открыть PRO',
    art: 'alias',
    proPlans: [
      { months: 12, title: 'На год', price: '2990 ₽', note: '249 ₽/мес · 2 месяца в подарок' },
      { months: 1, title: 'На месяц', price: '299 ₽', note: 'Гибко, если играете нерегулярно' },
    ],
    slides: [
      { cover: 'party', title: 'Все игры под рукой', text: 'Одна подписка для Шпиона, Alias, Бункера и следующих игр платформы.' },
      { cover: 'secret', title: 'Больше контроля комнаты', text: 'Расширенные режимы, библиотеки, настройки и отсутствие рекламы для компаний хоста.' },
      { cover: 'memes', title: 'Свои наборы для своих людей', text: 'Личные локации и будущие инструменты хоста остаются в одном доступе.' },
    ],
    bullets: ['Все игры: Шпион, Alias, Бункер, Правда или действие', 'Все наборы, словари и тематические паки', 'Свои локации и расширенные режимы', 'Без рекламы в комнате — для всех, кто зашёл', 'Постоянно — месяц или год, для частых встреч'],
  };
  const game = games.find((item) => item.id === pass?.gameId) || games[0];
  const copy = {
    spy: {
      kicker: 'Фанатам Шпиона',
      short: 'Полная библиотека Шпиона, предметный режим, свои локации и расширенные режимы на месяц.',
      title: 'Шпион без ограничений',
      includes: ['Все платные локации: город, путешествия, секретные места, поп-культура и фэнтези', 'Тематические наборы 18+, для влюблённых, пьянок, мемов и корпоратива', 'Режим предметов: гаджеты, странные вещи, алкоголь и компьютерные игры', 'Свои локации и режим с двумя шпионами'],
    },
    alias: {
      kicker: 'Фанатам Alias',
      short: 'Месяц доступа к расширениям Alias: тематические слова, быстрые вечеринки и настройки команд.',
      title: 'Alias для частых игр',
      includes: ['Больше тематических словарей для компаний', 'Сложность и наборы под разные компании', 'Командные настройки и будущие режимы Alias', 'Без рекламы в комнатах Alias'],
    },
    bunker: {
      kicker: 'Фанатам Бункера',
      short: 'Месяц расширений Бункера: сценарии катастроф, дополнительные карточки и режимы вскрытия.',
      title: 'Бункер для больших споров',
      includes: ['Дополнительные наборы катастроф и убежищ', 'Больше профессий, особенностей, здоровья и багажа', 'Сценарные паки для жёстких и смешных партий', 'Без рекламы в комнатах Бункера'],
    },
  }[game.id] || {
    kicker: 'Game Pass',
    short: 'Месяц доступа к расширениям выбранной игры.',
    title: `${game.name} Pass`,
    includes: ['Расширения выбранной игры', 'Новые наборы', 'Без рекламы в комнате'],
  };
  return {
    id: pass?.id || `${game.id}_pass`,
    type: 'game_pass',
    productId: pass?.id || 'spy_pass',
    months: 1,
    name: pass?.name || copy.title,
    kicker: copy.kicker,
    price: `${pass?.priceRub || 99} ₽`,
    short: copy.short,
    description: `Подписка на 1 месяц за ${pass?.priceRub || 99} ₽. Нужна, если вы часто играете именно в ${game.name}: она открывает расширения этой игры и убирает рекламу в её комнатах.`,
    includes: copy.includes,
    cta: `Открыть на месяц · ${pass?.priceRub || 99} ₽`,
    art: game.art,
    slides: [
      { cover: game.id === 'spy' ? 'city' : 'party', title: copy.title, text: copy.short },
      { cover: game.id === 'bunker' ? 'secret' : 'pop', title: 'Месяц для любимой игры', text: `Подходит, если компания чаще всего выбирает ${game.name} и не хочет брать всю платформу.` },
      { cover: 'after_dark', title: 'Комната без рекламы', text: 'Активный Game Pass хоста убирает рекламные паузы в этой игре для всех участников комнаты.' },
    ],
    bullets: [],
  };
}

function buildThemePassOffer(pass) {
  const price = `${pass.priceRub || 129} ₽`;
  const slides = [
    { cover: pass.cover || 'party', title: pass.name, text: pass.short || pass.description },
    { cover: pass.cover || 'pop', title: 'Одна тема во всех играх', text: 'Выбирайте настроение вечера в лобби: Шпион, Alias, Бункер и Правда или действие получат свои наборы.' },
    { cover: pass.ageRating ? 'after_dark' : 'city', title: pass.ageRating ? 'Только для взрослых' : 'Без лишней подписки', text: pass.ageRating ? '18+ наборы помечены отдельно и рассчитаны на совершеннолетних игроков.' : 'Подходит, если нужна конкретная тема, а не весь каталог игры.' },
  ];
  return {
    id: pass.id,
    type: 'theme_pass',
    productId: pass.id,
    themeId: pass.themeId,
    months: 1,
    name: pass.name,
    kicker: pass.category || 'Тематический пропуск',
    price,
    short: pass.short || pass.description,
    description: pass.description,
    includes: pass.includes || [],
    cta: `Открыть тему · ${price}`,
    art: pass.art || 'spy',
    slides,
  };
}

const GAME_PASS_COVER = { spy: 'spy', alias: 'alias', bunker: 'bunker' };

// Единый источник товаров витрины: каждый товар — объект с обложкой, слайдами,
// составом и статусом владения. Новый товар добавляется данными, а не JSX.
function decorateProduct(offer, group, cover, owned, activeUntil = null) {
  return { ...offer, group, cover, owned, activeUntil };
}

function buildStoreProducts(catalog, profile) {
  const gamePasses = catalog?.gamePasses || [
    { id: 'spy_pass', name: 'Spy Pass', gameId: 'spy', priceRub: 99 },
    { id: 'alias_pass', name: 'Alias Pass', gameId: 'alias', priceRub: 99 },
    { id: 'bunker_pass', name: 'Bunker Pass', gameId: 'bunker', priceRub: 99 },
  ];
  const themePasses = catalog?.themePasses || [];
  const subscriptionActive = Number(profile?.subscription?.activeUntil || 0) > Date.now();
  const partyPass = profile?.partyPasses?.find((pass) => pass.activeUntil > Date.now()) || null;

  return [
    decorateProduct({ ...buildAccessOffer('weekend'), featured: true }, 'access', 'store_weekend', Boolean(partyPass), partyPass?.activeUntil || null),
    decorateProduct(buildAccessOffer('pro'), 'access', 'store_pro', subscriptionActive, subscriptionActive ? profile?.subscription?.activeUntil : null),
    ...gamePasses.map((pass) => {
      const active = getActiveGamePass(profile, pass.gameId || 'spy');
      return decorateProduct(buildAccessOffer('game_pass', pass), 'games', GAME_PASS_COVER[pass.gameId] || 'city', Boolean(active), active?.activeUntil || null);
    }),
    ...themePasses.map((pass) => {
      const active = getActiveThemePass(profile, pass.themeId);
      return decorateProduct(buildThemePassOffer(pass), 'themes', pass.cover || 'party', Boolean(active), active?.activeUntil || null);
    }),
  ];
}

// Первичное решение воронки: PRO (постоянно) vs WeekendPass (на вечер). Открывают одно
// и то же — разница в сроке и цене. PRO подсвечен как якорь, у него переключатель год/месяц.
function PlanFork({ weekend, pro, proMonths, setProMonths, openOffer, buy }) {
  return <section className="store-fork wrap">
    <div className="store-fork-head">
      <span className="eyebrow">Открыть всё</span>
      <h2>Один доступ — все игры для компании</h2>
      <p>WeekendPass и PRO открывают одно и то же. Вопрос один: на вечер или насовсем.</p>
    </div>
    <div className="pf-cards">
      <article className="pf-card pf-pro">
        <span className="pf-ribbon">Выгоднее всего</span>
        <span className="pf-kicker">Постоянно</span>
        <b className="pf-name">PRO</b>
        <div className="pf-toggle" role="tablist" aria-label="Срок PRO">
          <button type="button" role="tab" aria-selected={proMonths === 12} className={proMonths === 12 ? 'active' : ''} onClick={() => setProMonths(12)}>Год<em>−2 месяца</em></button>
          <button type="button" role="tab" aria-selected={proMonths === 1} className={proMonths === 1 ? 'active' : ''} onClick={() => setProMonths(1)}>Месяц</button>
        </div>
        <div className="pf-price"><strong>{proMonths === 12 ? '249 ₽' : '299 ₽'}</strong><span>{proMonths === 12 ? 'в месяц · 2990 ₽ за год' : 'в месяц'}</span></div>
        {pro.owned
          ? <em className="pf-owned">Активен до {formatPassUntil(pro.activeUntil)}</em>
          : <button className="button primary full" type="button" onClick={() => buy(pro.type, pro.productId, proMonths)}>Оформить PRO</button>}
        <button type="button" className="pf-more" onClick={() => openOffer(pro)}>Что входит</button>
      </article>
      <article className="pf-card pf-weekend">
        <span className="pf-kicker">На один вечер</span>
        <b className="pf-name">WeekendPass</b>
        <div className="pf-price"><strong>149 ₽</strong><span>доступ на 24 часа</span></div>
        <p className="pf-sub">Всё то же, что в PRO, только на сегодня — для одной встречи.</p>
        {weekend.owned
          ? <em className="pf-owned">Активен до {formatPassUntil(weekend.activeUntil)}</em>
          : <button className="button secondary full" type="button" onClick={() => buy(weekend.type, weekend.productId, null)}>Открыть вечер</button>}
        <button type="button" className="pf-more" onClick={() => openOffer(weekend)}>Что входит</button>
      </article>
    </div>
  </section>;
}

function ComparisonTable({ openPro }) {
  const rows = [
    ['Все игры: Шпион, Alias, Бункер, ПоД', 'base', true, true],
    ['Все словари, наборы и паки', false, true, true],
    ['Без рекламы в комнате', false, true, true],
    ['Свои локации и режимы', false, true, true],
    ['Действует', '∞', '24 часа', 'Месяц / год'],
  ];
  const cell = (value) => value === true
    ? <i className="cmp-yes">✓</i>
    : value === false
      ? <i className="cmp-no">–</i>
      : <span className="cmp-txt">{value === 'base' ? 'базовое' : value}</span>;
  return <section className="store-compare wrap">
    <div className="section-title"><div><span className="eyebrow">Сравнение</span><h2>Что открывает каждый доступ</h2></div></div>
    <div className="cmp-table">
      <div className="cmp-row cmp-head"><span /><span>Free</span><span>Weekend</span><span className="cmp-pro">PRO</span></div>
      {rows.map(([label, free, wk, proValue]) => <div className="cmp-row" key={label}>
        <span className="cmp-feature">{label}</span>
        <span>{cell(free)}</span>
        <span>{cell(wk)}</span>
        <span className="cmp-pro">{cell(proValue)}</span>
      </div>)}
      <div className="cmp-row cmp-price"><span className="cmp-feature">Цена</span><span>0 ₽</span><span>149 ₽</span><span className="cmp-pro">от 249 ₽</span></div>
    </div>
    <button type="button" className="button secondary full" onClick={openPro}>Подробнее о PRO</button>
  </section>;
}

function AddonCarousel({ eyebrow, title, note, items, openOffer }) {
  const ref = useRef(null);
  if (!items?.length) return null;
  return <section className="store-addons wrap">
    <div className="section-title carousel-title">
      <div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>
      <div className="carousel-controls"><button type="button" aria-label="Назад" onClick={() => moveCarousel(ref, -1)}>‹</button><button type="button" aria-label="Вперёд" onClick={() => moveCarousel(ref, 1)}>›</button></div>
    </div>
    {note && <p className="store-addons-note">{note}</p>}
    <div className="addon-carousel" ref={ref}>
      {items.map((item) => <button key={item.id} type="button" className={`addon-card${item.owned ? ' owned' : ''}`} onClick={() => openOffer(item)}>
        <span className={`addon-cover cover cover-${item.cover}`} />
        <span className="addon-body"><b>{item.name}</b><small>{item.short}</small></span>
        <span className="addon-foot">{item.owned ? <em>Открыто</em> : <strong>{item.price}</strong>}</span>
      </button>)}
    </div>
  </section>;
}

function OfferModal({ offer, close, buy }) {
  const slidesRef = useRef(null);
  useAutoCarousel(slidesRef, [offer.id]);
  const move = (direction) => slidesRef.current?.scrollBy({ left: direction * Math.max(240, slidesRef.current.clientWidth * 0.82), behavior: 'smooth' });
  const includes = offer.includes || offer.bullets || [];
  return <div className="backdrop offer-backdrop" onMouseDown={close}><section className="modal offer-modal" onMouseDown={(event) => event.stopPropagation()}>
    <button className="close" onClick={close}>×</button>
    <span className="eyebrow">{offer.kicker}</span>
    <h2>{offer.name}</h2>
    <div className="offer-carousel-wrap"><button className="offer-arrow left" type="button" onClick={() => move(-1)} aria-label="Назад">‹</button><div className="offer-slide-carousel" ref={slidesRef}>{offer.slides.map((slide) => <article key={slide.title} className={`offer-slide cover-${slide.cover}`}><div><b>{slide.title}</b><span>{slide.text}</span></div></article>)}</div><button className="offer-arrow right" type="button" onClick={() => move(1)} aria-label="Вперёд">›</button></div>
    {includes.length > 0 && <div className="offer-includes"><h3>Что входит</h3>{includes.map((item) => <p key={item}>{item}</p>)}</div>}
    {offer.owned ? <strong className="owned-product">Уже открыто до {formatPassUntil(offer.activeUntil)}</strong> : offer.proPlans ? <div className="pro-plan-choice">{offer.proPlans.map((plan) => <button key={plan.months} onClick={() => buy(plan.months)}><span><b>{plan.title}</b><small>{plan.note}</small></span><strong>{plan.price}</strong></button>)}</div> : <button className="button primary full" onClick={() => buy()}>{offer.cta}</button>}
    <small className="purchase-note">Доступ появится в профиле сразу после оплаты. Физическая доставка не требуется.</small>
  </section></div>;
}

export function AuthModal({ close, setProfile }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const requestCode = async (event) => {
    event.preventDefault();
    setError('');
    setStatus('sending');
    try {
      const response = await fetch('/api/auth/request-code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Не получилось отправить код');
      setSent(true);
    } catch (authError) {
      setError(authError.message || 'Не получилось отправить код');
    } finally {
      setStatus('idle');
    }
  };

  const verifyCode = async (event) => {
    event.preventDefault();
    setError('');
    setStatus('sending');
    try {
      const response = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, code, playerId: getPlayerId(), name: getOrCreateDisplayName() }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Код не подошёл');
      saveAccount(data.account);
      socket.emit('identify', { playerId: data.account.id });
      setProfile(data.profile);
      if (data.created) trackClientEvent('registration', { method: 'email' });
      close();
    } catch (authError) {
      setError(authError.message || 'Код не подошёл');
    } finally {
      setStatus('idle');
    }
  };

  return <div className="backdrop auth-backdrop" onMouseDown={close}><section className="modal auth-modal" onMouseDown={(event) => event.stopPropagation()}>
    <button className="close" onClick={close}>×</button>
    <span className="eyebrow">Аккаунт GameHubParty</span>
    <h2>{sent ? 'Введите код из письма' : 'Войдите или зарегистрируйтесь'}</h2>
    <p>{sent ? `Мы отправили код на ${email}. Он действует 10 минут.` : 'Почта нужна для покупок, чеков и восстановления доступа. Пароль придумывать не нужно.'}</p>
    <form onSubmit={sent ? verifyCode : requestCode}>
      <label><span>Почта</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" disabled={sent} /></label>
      {sent && <label><span>Код из письма</span><input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="123456" /></label>}
      {error && <p className="form-error">{error}</p>}
      <button className="button primary full" disabled={status === 'sending'}>{status === 'sending' ? 'Подождите...' : sent ? 'Войти' : 'Получить код'}</button>
      {sent && <button className="button secondary full" type="button" onClick={() => { setSent(false); setCode(''); }}>Изменить почту</button>}
    </form>
  </section></div>;
}

function PaymentReadinessPanel() {
  return <section className="payment-gate wrap" aria-label="Информация о платежах">
    <div className="payment-gate-hero">
      <span className="eyebrow">Платежи на сайте</span>
      <h2>Всё важное перед оплатой собрано в одном месте</h2>
      <p>GameHubParty продаёт цифровой доступ: вечерний доступ, Game Pass, PRO и оформление комнаты. Физической доставки нет: после оплаты доступ появляется в профиле игрока.</p>
      <div className="payment-gate-tags">
        <span>Цифровые товары</span>
        <span>Фиксированные цены</span>
        <span>Оферта</span>
        <span>Поддержка доступа</span>
      </div>
    </div>
    <div className="payment-gate-grid">
      <article><b>01</b><h3>Товары и цены</h3><p>На карточках магазина указаны названия, описания, состав доступа и цена в рублях до оформления заказа.</p></article>
      <article><b>02</b><h3>Получение заказа</h3><p>После подтверждения покупки цифровой доступ автоматически появляется в профиле и настройках комнаты.</p></article>
      <article><b>03</b><h3>Документы</h3><p>Оферта, политика и контакты доступны из нижнего меню и юридических страниц сайта.</p></article>
      <article><b>04</b><h3>Поддержка</h3><p>По заказам и доступу пишите на support@gamehubparty.ru. Реквизиты продавца опубликованы на странице контактов.</p></article>
    </div>
  </section>;
}

function CarouselTitle({ eyebrow, title, target }) {
  return <div className="section-title carousel-title"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div></div>;
}

function CarouselFrame({ target, children }) {
  return <div className="carousel-frame"><button className="carousel-card-arrow left" type="button" aria-label="Назад" onClick={() => moveCarousel(target, -1)}>‹</button>{children}<button className="carousel-card-arrow right" type="button" aria-label="Вперёд" onClick={() => moveCarousel(target, 1)}>›</button></div>;
}

function ThemeCard({ theme, owned, buy }) {
  const party = theme.id === 'partyhub';
  return <article className={`theme-card ${party ? 'theme-partyhub' : 'theme-ghp'}`}>
    <div className="theme-preview">
      <b>{party ? <><span>Party</span><mark>Hub</mark></> : <><span>G</span><span>H</span><span>P</span></>}</b>
      <small>{party ? 'тёмный логотип и тёплый акцент' : 'светлая базовая тема'}</small>
    </div>
    <div><span className="eyebrow">{theme.free ? 'Базовая' : 'Платная тема'}</span><h3>{theme.name}</h3><p>{party ? 'Оформление комнаты в стиле PartyHub: тёмный логотип, тёплые акценты и более контрастные кнопки.' : 'Нейтральная тема GameHubParty в текущем стиле проекта.'}</p>{owned ? <strong>Открыта</strong> : <button className="button primary full" onClick={buy}>{theme.priceRub} ₽</button>}</div>
  </article>;
}

function CheckoutModal({ order, close, confirm }) {
  return <div className="backdrop" onMouseDown={close}><section className="modal checkout-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><div><span className="eyebrow">Тестовый режим</span><h2>{order.title}</h2></div><button className="close" onClick={close}>×</button></div><p>Платежная ссылка не создана, поэтому заказ открыт только для локальной проверки. На продакшене доступ выдаётся после оплаты YooKassa.</p><div className="checkout-summary"><span>Заказ</span><b>{order.id}</b><span>Сумма</span><strong>{order.amountRub} ₽</strong><span>Статус</span><em>Тестовый заказ</em></div><button className="button primary full" onClick={confirm}>Тестово открыть доступ</button><button className="button secondary full" onClick={close}>Вернуться в магазин</button></section></div>;
}
