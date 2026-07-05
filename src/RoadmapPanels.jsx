import { useEffect, useRef, useState } from 'react';
import { sessionStore } from './browserStorage';
import { emit, socket } from './socket';
import { getOrCreateDisplayName, getPlayerId, saveAccount } from './identity';
import { reachMetrikaGoal } from './yandexMetrika';

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

function formatPassUntil(activeUntil) {
  if (!activeUntil) return '';
  return new Date(activeUntil).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function loopCarouselItems(items = []) {
  return items.length > 1 ? [...items, ...items] : items;
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

function isProductOwned(product, profile) {
  if (!product) return false;
  if (product.type === 'theme') return product.free || profile?.ownedThemeIds?.includes(product.id);
  if (product.type === 'game_pass') return hasActiveGamePass(profile, product.gameId || 'spy');
  if (product.type === 'game_expansion') return product.free || profile?.pro || hasPartyPass(profile) || hasActiveGamePass(profile, product.gameId);
  if (product.type === 'dictionary') return product.free || profile?.pro || hasPartyPass(profile) || hasActiveGamePass(profile, 'spy') || profile?.ownedDictionaryIds?.includes(product.id);
  if (product.type === 'creator') return profile?.pro || hasPartyPass(profile) || hasActiveGamePass(profile, 'spy') || profile?.customDictionaryOwned;
  return product.dictionaryIds?.every((id) => profile?.pro || hasPartyPass(profile) || hasActiveGamePass(profile, 'spy') || profile?.ownedDictionaryIds?.includes(id));
}

function productPrice(product) {
  if (product.price) return product.price;
  if (product.free) return 'Бесплатно';
  return `${product.priceRub || 0} ₽ · доступ к набору`;
}

function dictionaryCount(product) {
  if (product.wordCount) return `${product.wordCount} слов`;
  if (product.cardCount) return `${product.cardCount} карточек`;
  const label = product.countLabel || (product.subjectType === 'item' ? 'предметов' : 'локаций');
  return `${product.locationCount || product.locations?.length || 0} ${label}`;
}

function analyticsSessionId() {
  const key = 'gamehubparty_analytics_session';
  try {
    const saved = sessionStore.getItem(key);
    if (saved) return saved;
    const next = `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStore.setItem(key, next);
    return next;
  } catch (_) {
    return '';
  }
}

function trackStoreEvent(name, details = {}) {
  const params = new URLSearchParams(location.search);
  fetch('/api/analytics/track', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name,
      details: {
        page: 'store',
        path: location.pathname,
        playerId: getPlayerId(),
        sessionId: analyticsSessionId(),
        referrer: document.referrer,
        source: params.get('utm_source') || '',
        medium: params.get('utm_medium') || '',
        campaign: params.get('utm_campaign') || '',
        ...details,
      },
    }),
    keepalive: true,
  }).catch(() => {});
  reachMetrikaGoal(name, details);
}

export function AdvancedSpySettings({ room, action, profile }) {
  const update = (patch) => action('update_settings', { settings: patch });
  const maxSpies = Math.min(3, Math.max(1, room.players.filter((player) => player.online).length - 2));
  const proAccess = profile?.pro || hasPartyPass(profile) || hasActiveGamePass(profile, 'spy');
  const subjectType = room.settings.subjectType || 'location';

  return <div className="roadmap-panel">
    <label>Что угадываем<select value={subjectType} onChange={(event) => update({ subjectType: event.target.value })}><option value="location">Места</option><option value="item">Предметы</option></select></label>
    <label>Режим раунда<select value={room.settings.mode} onChange={(event) => update({ mode: event.target.value })}><option value="classic">Классический</option><option value="quick">Быстрый раунд</option><option value="duo" disabled={!proAccess}>Два шпиона · PRO</option></select></label>
    <label>Количество шпионов<select value={room.settings.spyCount} onChange={(event) => update({ spyCount: Number(event.target.value) })}>{Array.from({ length: maxSpies }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label>
    <label className="check-setting"><input type="checkbox" checked={room.settings.revealRoles} onChange={(event) => update({ revealRoles: event.target.checked })} /> Показывать роли мирным</label>
    <label className="check-setting"><input type="checkbox" checked={room.settings.allowSpyGuess} onChange={(event) => update({ allowSpyGuess: event.target.checked })} /> Шпион может назвать {subjectType === 'item' ? 'предмет' : 'локацию'}</label>
    {!proAccess && <p className="settings-note">Spy Pass, вечерний доступ или PRO открывают режим «Два шпиона» и полную библиотеку Шпиона для комнаты.</p>}
  </div>;
}

export function Storefront({ profile, setProfile, catalog, navigate }) {
  const [details, setDetails] = useState(null);
  const [offer, setOffer] = useState(null);
  const [checkout, setCheckout] = useState(null);
  const [purchaseStatus, setPurchaseStatus] = useState('idle');
  const [purchaseError, setPurchaseError] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const passesRef = useRef(null);
  const gamePasses = catalog?.gamePasses || [
    { id: 'spy_pass', name: 'Spy Pass', gameId: 'spy', priceRub: 99 },
    { id: 'alias_pass', name: 'Alias Pass', gameId: 'alias', priceRub: 99 },
    { id: 'bunker_pass', name: 'Bunker Pass', gameId: 'bunker', priceRub: 99 },
  ];
  useAutoCarousel(passesRef, [gamePasses.length]);

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
    setDetails(null);
  };

  const weekendOffer = buildAccessOffer('weekend');
  const proOffer = buildAccessOffer('pro');
  const passOffers = gamePasses.map((pass) => {
    const activePass = getActiveGamePass(profile, pass.gameId || 'spy');
    return { ...buildAccessOffer('game_pass', pass), owned: Boolean(activePass), activeUntil: activePass?.activeUntil || null };
  });

  return <>
    {purchaseStatus === 'creating' && <p className="guest-name-note wrap">Готовим ссылку на оплату...</p>}
    {purchaseStatus === 'checking' && <p className="guest-name-note wrap">Проверяем оплату и открываем доступ...</p>}
    {purchaseError && <p className="form-error wrap">{purchaseError}</p>}

    <section className="store-title wrap">
      <span className="eyebrow">Магазин GameHubParty</span>
      <h1>Доступы для игры</h1>

      {profile?.accountType === 'guest' && <button className="auth-nudge" onClick={() => setAuthOpen(true)}><span><b>Войдите или зарегистрируйтесь</b><small>Покупки, чеки и восстановление доступа привязаны к почте.</small></span><strong>Войти</strong></button>}
    </section>

    <section className="store-funnel wrap">
      <button className="access-card weekend-card" onClick={() => setOffer(weekendOffer)}>
        <i className="access-art access-weekend" />
        <span>01 · На сегодня</span>
        <b>WeekendPass</b>
        <strong>149 ₽ <small>/ 24 часа</small></strong>
        <p>Один вечер, все доступные игры, расширенные наборы и без рекламы для комнаты.</p>
      </button>

      <button className="access-card pro-access-card" onClick={() => setOffer(proOffer)}>
        <i className="access-art access-pro" />
        <span>02 · Для хоста</span>
        <b>PRO подписка</b>
        <strong>299 ₽ <small>/ месяц</small></strong>
        <p>Для регулярных встреч: вся платформа, режимы, библиотеки и свои наборы.</p>
      </button>
    </section>

    <section className="store-section wrap">
      <CarouselTitle eyebrow="03 · Game Pass" title="Подписка на игру" target={passesRef} />
      <p className="store-section-note">Одна любимая игра на месяц: все её расширения и без рекламных пауз в комнате.</p>
      <CarouselFrame target={passesRef}><div className="game-pass-showcase" ref={passesRef} data-loop={passOffers.length > 1}>{loopCarouselItems(passOffers).map((item, index) => <button key={`${item.id}-${index}`} className="game-pass-card" onClick={() => setOffer(item)}><i className={`game-thumb ${item.art}`} /><span>{item.kicker}</span><b>{item.name}</b><p>{item.owned ? `Уже открыт до ${formatPassUntil(item.activeUntil)}` : item.short}</p>{!item.owned && item.includes?.length > 0 && <small className="game-pass-utp">{item.includes.slice(0, 2).join(' · ')}</small>}<strong>{item.owned ? 'Открыто' : item.price}</strong></button>)}</div></CarouselFrame>
    </section>

    {offer && <OfferModal offer={offer} close={() => setOffer(null)} buy={(months = offer.months) => buy(offer.type, offer.productId, months)} />}
    {details && <ProductModal product={details} profile={profile} close={() => setDetails(null)} buy={async () => { if (details.type === 'game_expansion') await buy('game_pass', details.productId, 1); if (details.type === 'dictionary') await buy('game_pass', 'spy_pass', 1); if (details.type === 'bundle') await buy('game_pass', 'spy_pass', 1); if (details.type === 'creator') await buy('game_pass', 'spy_pass', 1); }} />}
    {checkout && <CheckoutModal order={checkout} close={() => setCheckout(null)} confirm={confirmCheckout} />}
    {authOpen && <AuthModal close={() => setAuthOpen(false)} setProfile={setProfile} />}
  </>;
}

function buildAccessOffer(kind, pass = null) {
  if (kind === 'weekend') return {
    id: 'weekend',
    type: 'party_pass',
    productId: 'party_pass_24h',
    months: null,
    name: 'WeekendPass',
    kicker: 'Для одной встречи',
    price: '149 ₽',
    short: 'Открывает вечер для всей комнаты.',
    cta: 'Открыть вечер · 149 ₽',
    art: 'spy',
    slides: [
      { cover: 'party', title: 'Вся компания играет сегодня', text: 'Один хост открывает доступ, остальные просто заходят в комнату с телефона.' },
      { cover: 'city', title: 'Игры и наборы сразу', text: 'Шпион, Alias и Бункер доступны на вечер, а расширенная библиотека Шпиона не требует отдельных покупок.' },
      { cover: 'drinks', title: 'Без рекламных пауз', text: 'Комната проходит вечер спокойнее: меньше ожидания, больше игры и меньше сбитого настроения.' },
    ],
    bullets: ['24 часа доступа', 'Для всей комнаты хоста', 'Расширенные наборы Шпиона', 'Без рекламы в комнате'],
  };
  if (kind === 'pro') return {
    id: 'pro',
    type: 'subscription',
    productId: 'pro',
    months: 1,
    name: 'PRO подписка',
    kicker: 'Для постоянного хоста',
    price: 'от 299 ₽',
    short: 'Месяц или год доступа ко всей платформе.',
    cta: 'Открыть PRO',
    art: 'alias',
    proPlans: [
      { months: 1, title: 'Ежемесячно', price: '299 ₽', note: 'Гибко, если играете нерегулярно.' },
      { months: 12, title: 'Ежегодно', price: '2990 ₽', note: 'Два месяца дешевле для частых встреч.' },
    ],
    slides: [
      { cover: 'party', title: 'Все игры под рукой', text: 'Одна подписка для Шпиона, Alias, Бункера и следующих игр платформы.' },
      { cover: 'secret', title: 'Больше контроля комнаты', text: 'Расширенные режимы, библиотеки, настройки и отсутствие рекламы для компаний хоста.' },
      { cover: 'memes', title: 'Свои наборы для своих людей', text: 'Личные локации и будущие инструменты хоста остаются в одном доступе.' },
    ],
    bullets: ['Все текущие игры', 'Все стандартные библиотеки', 'Свои локации и режимы', 'Без рекламы для комнаты'],
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

function StoreReadyGameCard({ game, buy, navigate }) {
  const selected = games.find((item) => item.id === game) || games[0];
  const copy = {
    alias: {
      eyebrow: 'Игра доступна сейчас',
      title: 'Alias без карточек и ведущего',
      text: 'Команды, таймер и счёт уже внутри. Вечерний доступ убирает рекламные паузы и открывает игры на весь вечер.',
      cta: 'Создать комнату Alias',
      route: 'alias',
    },
    bunker: {
      eyebrow: 'Игра доступна сейчас',
      title: 'Бункер с карточками на телефоне',
      text: 'Профессии, катастрофа, убежище и голосование собираются автоматически. Вечерний доступ подходит для одной большой партии.',
      cta: 'Создать комнату Бункер',
      route: 'bunker',
    },
  }[game];
  return <section className="store-ready-card wrap">
    <i className={`game-thumb large ${selected.art}`} />
    <span className="eyebrow">{copy.eyebrow}</span>
    <h2>{copy.title}</h2>
    <p>{copy.text}</p>
    <div className="store-ready-actions">
      <button className="button primary full" onClick={() => navigate?.(copy.route)}>{copy.cta}</button>
      <button className="button secondary full" onClick={() => buy('party_pass', 'party_pass_24h')}>Вечерний доступ · 149 ₽</button>
    </div>
  </section>;
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
        <span>Возвраты</span>
      </div>
    </div>
    <div className="payment-gate-grid">
      <article><b>01</b><h3>Товары и цены</h3><p>На карточках магазина указаны названия, описания, состав доступа и цена в рублях до оформления заказа.</p></article>
      <article><b>02</b><h3>Получение заказа</h3><p>После подтверждения покупки цифровой доступ автоматически появляется в профиле и настройках комнаты.</p></article>
      <article><b>03</b><h3>Документы</h3><p>Оферта, политика, возвраты и контакты доступны из нижнего меню и юридических страниц сайта.</p></article>
      <article><b>04</b><h3>Поддержка</h3><p>По заказам и возвратам пишите на support@gamehubparty.ru. Реквизиты продавца опубликованы на странице контактов.</p></article>
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

function PackCard({ pack, index, owned, open, buy, actionLabel = 'Spy Pass' }) {
  return <article className="pack-card" onClick={open}><div className={`cover cover-${pack.cover || index % 6}`} /><span>{pack.category}</span><h3>{pack.name}</h3><p>{pack.description}</p><footer><small>{dictionaryCount(pack)}</small>{owned ? <strong>Открыто</strong> : <button onClick={(event) => { event.stopPropagation(); buy(); }}>{actionLabel}</button>}</footer></article>;
}

function PackRow({ pack, index, owned, open, buy }) {
  return <article className="store-pack" onClick={open}><div className={`cover mini cover-${pack.cover || index % 6}`} /><div><b>{pack.name}</b><p>{pack.description}</p><small>{dictionaryCount(pack)} · {pack.category}</small></div>{owned ? <strong>Открыто</strong> : <button className="button small secondary" onClick={(event) => { event.stopPropagation(); buy(); }}>Spy Pass</button>}</article>;
}

function ProductModal({ product, profile, close, buy }) {
  const included = product.includes || product.locations?.slice(0, 12).map((location) => location.name) || [];
  const owned = isProductOwned(product, profile);
  const price = productPrice(product);
  return <div className="backdrop" onMouseDown={close}><section className="modal product-modal" onMouseDown={(event) => event.stopPropagation()}><div className={`product-cover cover cover-${product.cover || 'base'}`} /><div className="modal-title"><div><span className="eyebrow">{product.category || 'GameHubParty'}</span><h2>{product.name}</h2></div><button className="close" onClick={close}>×</button></div><p>{product.description}</p><div className="product-price">{price}</div><h3>Что входит</h3><ul className="included-list">{included.map((item) => <li key={item}>✓ {item}</li>)}</ul>{product.locations?.length > included.length && <p className="guest-name-note">И ещё {product.locations.length - included.length} {product.countLabel || (product.subjectType === 'item' ? 'предметов' : 'локаций')}.</p>}{owned ? <strong className="owned-product">Уже открыто</strong> : <button className="button primary full" onClick={buy}>Получить · {price}</button>}<small className="purchase-note">Это цифровой товар. После оплаты доступ автоматически появится в профиле GameHubParty.</small></section></div>;
}

function CheckoutModal({ order, close, confirm }) {
  return <div className="backdrop" onMouseDown={close}><section className="modal checkout-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><div><span className="eyebrow">Тестовый режим</span><h2>{order.title}</h2></div><button className="close" onClick={close}>×</button></div><p>Платежная ссылка не создана, поэтому заказ открыт только для локальной проверки. На продакшене доступ выдаётся после оплаты YooKassa.</p><div className="checkout-summary"><span>Заказ</span><b>{order.id}</b><span>Сумма</span><strong>{order.amountRub} ₽</strong><span>Статус</span><em>Тестовый заказ</em></div><button className="button primary full" onClick={confirm}>Тестово открыть доступ</button><button className="button secondary full" onClick={close}>Вернуться в магазин</button></section></div>;
}

