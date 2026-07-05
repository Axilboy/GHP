import { useEffect, useMemo, useRef, useState } from 'react';
import { APP_VERSION } from '../version';
import { vkSummary } from '../vk';
import { formatTime } from './helpers';

export function VkStatus({ launch }) {
  const summary = vkSummary(launch);
  if (!summary) return null;
  return <section className="vk-status wrap"><b>VK Mini Apps</b><span>{summary.verified ? 'Запуск проверен' : 'VK-режим найден'} · {summary.platform || 'платформа не указана'}</span></section>;
}

export function useAutoScrollCarousel(ref, deps = []) {
  useEffect(() => {
    const node = ref.current;
    if (!node || node.scrollWidth <= node.clientWidth) return undefined;
    const timer = window.setInterval(() => {
      const step = Math.max(260, Math.round(node.clientWidth * 0.82));
      const atEnd = node.scrollLeft + node.clientWidth >= node.scrollWidth - 8;
      node.scrollTo({ left: atEnd ? 0 : node.scrollLeft + step, behavior: 'smooth' });
    }, 4500);
    return () => window.clearInterval(timer);
  }, deps);
}

export function CarouselControls({ target }) {
  const move = (direction) => {
    const node = target.current;
    if (!node) return;
    node.scrollBy({ left: direction * Math.max(260, Math.round(node.clientWidth * 0.82)), behavior: 'smooth' });
  };
  return <div className="carousel-controls"><button type="button" aria-label="Назад" onClick={() => move(-1)}>‹</button><button type="button" aria-label="Вперёд" onClick={() => move(1)}>›</button></div>;
}

export function CarouselFrame({ target, children }) {
  const move = (direction) => {
    const node = target.current;
    if (!node) return;
    const firstCard = node.children?.[0];
    const gap = Number.parseFloat(getComputedStyle(node).gap || '0') || 0;
    const step = firstCard ? firstCard.getBoundingClientRect().width + gap : Math.max(260, Math.round(node.clientWidth * 0.82));
    node.scrollBy({ left: direction * step, behavior: 'smooth' });
  };
  return <div className="carousel-frame game-showcase-frame"><button className="carousel-card-arrow left" type="button" aria-label="Назад" onClick={() => move(-1)}>‹</button>{children}<button className="carousel-card-arrow right" type="button" aria-label="Вперёд" onClick={() => move(1)}>›</button></div>;
}

export function Setting({ label, children }) { return <div className="setting"><span>{label}</span>{children}</div>; }
export function Counter({ value, min, max, change }) { return <div className="counter"><button onClick={() => change(Math.max(min, value - 1))}>−</button><b>{value}</b><button onClick={() => change(Math.min(max, value + 1))}>+</button></div>; }
export function ErrorText({ text }) { return <p className="error-text">{text}</p>; }

export function GameSwitcher({ gameId, changeGame }) {
  return <Setting label="Игра"><select value={gameId} onChange={(event) => changeGame(event.target.value)}><option value="spy">Шпион</option><option value="alias">Alias</option><option value="bunker">Бункер</option></select></Setting>;
}

export function VoteResults({ counts, players }) {
  return <div className="vote-results"><b>Результаты голосования</b>{Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([id, count]) => <span key={id}>{players.find((player) => player.id === id)?.name || 'Игрок'}: {count}</span>)}</div>;
}

export function ScanIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4M8 8h3v3H8zm5 0h3v3h-3zm-5 5h3v3H8zm5 0h3v3h-3z" /></svg>;
}

export function QrScanner({ close, onCode }) {
  const [message, setMessage] = useState('Разрешите доступ к камере и наведите её на QR-код комнаты.');
  const videoRef = useMemo(() => ({ current: null }), []);
  useEffect(() => {
    let stream;
    let timer;
    const start = async () => {
      if (!('BarcodeDetector' in window)) return setMessage('Этот браузер пока не умеет сканировать QR. Откройте камеру телефона или введите код комнаты.');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        videoRef.current.srcObject = stream;
        const detector = new BarcodeDetector({ formats: ['qr_code'] });
        timer = setInterval(async () => {
          const codes = await detector.detect(videoRef.current).catch(() => []);
          const value = codes[0]?.rawValue || '';
          const roomCode = new URL(value, location.origin).searchParams.get('room') || value.match(/\d{6}/)?.[0];
          if (roomCode) onCode(roomCode);
        }, 400);
      } catch {
        setMessage('Не удалось открыть камеру. Проверьте разрешение или введите код комнаты.');
      }
    };
    start();
    return () => { clearInterval(timer); stream?.getTracks().forEach((track) => track.stop()); };
  }, [onCode]);
  return <div className="scanner-panel"><video ref={videoRef} autoPlay playsInline muted /><p>{message}</p><button type="button" className="button secondary full" onClick={close}>Вернуться к коду</button></div>;
}

export function JoinModal({ initialName, close, join }) {
  const [code, setCode] = useState(new URLSearchParams(location.search).get('room') || '');
  const [error, setError] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    try { await join({ code, name: initialName }); } catch (nextError) { setError(nextError.message); }
  };
  return <div className="backdrop" onMouseDown={close}><section className="modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><div><h2>Войти в комнату</h2><p>Введите код или отсканируйте QR приглашения</p></div><button className="close" onClick={close}>×</button></div><form onSubmit={submit}><label>Код комнаты<input className="code" inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000 000" autoFocus /></label><button type="button" className="button secondary full qr-entry" onClick={() => setScannerOpen(true)}><ScanIcon />Войти по QR-коду</button><p className="guest-name-note">Вы войдёте как <b>{initialName}</b>. Имя можно изменить в лобби.</p>{error && <ErrorText text={error} />}<button className="button primary full" disabled={code.length !== 6}>Войти</button></form>{scannerOpen && <QrScanner close={() => setScannerOpen(false)} onCode={(nextCode) => { setCode(nextCode); setScannerOpen(false); }} />}</section></div>;
}

export function NameModal({ value, setValue, close, save }) {
  return <div className="backdrop" onMouseDown={close}><section className="modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><div><h2>Изменить имя</h2><p>Это имя увидят остальные игроки.</p></div><button className="close" onClick={close}>×</button></div><label>Ваше имя<input value={value} maxLength={24} onChange={(event) => setValue(event.target.value)} autoFocus /></label><button className="button primary full name-save" disabled={!value.trim()} onClick={save}>Сохранить</button></section></div>;
}

export function SeoLinks() {
  return <footer className="seo-links wrap"><b>Игры для компании</b><nav><a href="/games/spy">Шпион онлайн</a><a href="/games/alias">Alias онлайн</a><a href="/">Все игры</a><a href="/store">Магазин</a><a href="/demo">Статус</a><a href="/vk">VK Mini Apps</a><a href="/contacts">Контакты</a><a href="/refund">Возвраты</a><a href="/privacy">Политика</a><a href="/terms">Оферта</a></nav><span className="site-version">GameHubParty v{APP_VERSION}</span></footer>;
}

export function SessionReturnBanner({ session, now, returnToSession, closeSavedSession }) {
  const timeLeft = session.pausedUntil - now;
  if (timeLeft <= 0) return null;
  const code = session.code ? `${session.code.slice(0, 3)} ${session.code.slice(3)}` : 'сессия';
  return <aside className="session-return-banner" aria-live="polite">
    <div className="session-return-glow" />
    <div className="session-return-copy">
      <span>Активная игра</span>
      <b>Вернуться в комнату {code}</b>
      <small>Мы держим место ещё {formatTime(timeLeft)}. Можно уйти окончательно или одним нажатием вернуться к компании.</small>
    </div>
    <div className="session-return-actions">
      <button className="button primary small" onClick={returnToSession}>Вернуться</button>
      <button className="button secondary small" onClick={closeSavedSession}>Выйти</button>
    </div>
  </aside>;
}

export function SessionExitModal({ close, confirm }) {
  return <div className="backdrop session-exit-backdrop" onMouseDown={close}>
    <section className="modal session-exit-modal" onMouseDown={(event) => event.stopPropagation()}>
      <h2>Выйти в меню?</h2>
      <p>Комната сохранится на 5 минут. Вернуться можно будет без кода.</p>
      <div className="actions">
        <button className="button primary full" onClick={confirm}>Выйти в меню</button>
        <button className="button secondary full" onClick={close}>Остаться в игре</button>
      </div>
    </section>
  </div>;
}

export function LobbyPlayerAdBanner({ adPolicy, navigate }) {
  if (!adPolicy?.enabled) return null;
  return <section className="lobby-ad-banner" data-ad-slot="lobby_player_banner">
    <div><span>Free-комната</span><b>Короткая пауза перед стартом</b><p>Во время роли, таймера и голосования рекламы не будет. WeekendPass, Game Pass или PRO отключит паузы для всей комнаты.</p></div>
    <AdsterraBanner unit="mobile320x50" slot="lobby_player_banner" />
    <button className="button small secondary" onClick={() => navigate('store')}>Убрать рекламу</button>
  </section>;
}

export function AdStatusCard({ adPolicy, navigate }) {
  if (adPolicy?.adFree) {
    return <section className="ad-status-card ad-free"><span>Без рекламы</span><b>{adPolicy.sponsorName || 'PRO-игрок'} убрал рекламу для всей комнаты</b><p>Раунд начнется сразу, без рекламной паузы.</p></section>;
  }
  return <section className="ad-status-card"><span>Free-режим</span><b>Паузы можно убрать для всех</b><p>Игра не прерывается во время роли, таймера и голосования. WeekendPass или PRO убирает короткие паузы у всей комнаты.</p><button className="button small secondary" onClick={() => navigate('store')}>Убрать паузы</button></section>;
}

export function AdBreakModal({ placement, slot = 'internal_ad_slot', seconds = 5, continueLabel = 'Продолжить', onContinue, close }) {
  const [secondsLeft, setSecondsLeft] = useState(seconds);
  useEffect(() => {
    const timer = setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, []);
  const title = placement === 'post_round' ? 'Короткая пауза между раундами' : 'Короткая пауза перед стартом';
  const continueGame = async () => {
    await onContinue?.();
    close();
  };
  return <div className="backdrop ad-break-backdrop" onMouseDown={close}><section className="modal ad-break-modal" onMouseDown={(event) => event.stopPropagation()}><span className="eyebrow">Рекламная пауза</span><h2>{title}</h2><AdsterraBanner unit="rectangle300x250" slot={slot} /><p>В активной игре рекламы нет. WeekendPass, Game Pass или PRO отключит такие паузы для всей комнаты.</p><button className="button primary full" disabled={secondsLeft > 0} onClick={continueGame}>{secondsLeft > 0 ? `Начнём через ${secondsLeft}` : continueLabel}</button><button className="button secondary full" onClick={close}>Вернуться без старта</button></section></div>;
}

const adsterraUnits = {
  mobile320x50: {
    key: 'd5c1fe703354df9437609dcf4bea1ac7',
    width: 320,
    height: 50,
    src: 'https://www.highperformanceformat.com/d5c1fe703354df9437609dcf4bea1ac7/invoke.js',
  },
  rectangle300x250: {
    key: '464f545a84d6f512006bbbae88f7450a',
    width: 300,
    height: 250,
    src: 'https://www.highperformanceformat.com/464f545a84d6f512006bbbae88f7450a/invoke.js',
  },
};

export function AdsterraBanner({ unit, slot }) {
  const [status, setStatus] = useState('loading');
  const containerRef = useRef(null);
  const config = adsterraUnits[unit] || adsterraUnits.mobile320x50;
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    setStatus('loading');
    container.innerHTML = '';
    const frame = document.createElement('iframe');
    frame.title = `Adsterra ${slot}`;
    frame.width = String(config.width);
    frame.height = String(config.height);
    frame.scrolling = 'no';
    frame.className = 'adsterra-host-frame';
    container.append(frame);
    const doc = frame.contentWindow?.document;
    if (!doc) {
      setStatus('failed');
      return undefined;
    }
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><style>html,body{width:${config.width}px;height:${config.height}px;margin:0;overflow:hidden;background:transparent}</style></head><body><script type="text/javascript">atOptions=${JSON.stringify({
      key: config.key,
      format: 'iframe',
      height: config.height,
      width: config.width,
      params: {},
    })};</script><script type="text/javascript" src="${config.src}"></script></body></html>`);
    doc.close();
    const hasCreative = () => {
      const body = frame.contentWindow?.document?.body;
      if (!body) return false;
      return Boolean(body.querySelector('iframe, ins, a, img, object, embed')) || body.children.length > 2;
    };
    const interval = window.setInterval(() => {
      if (hasCreative()) {
        setStatus('loaded');
        window.clearInterval(interval);
      }
    }, 500);
    const timeout = window.setTimeout(() => {
      setStatus((current) => (current === 'loading' && !hasCreative() ? 'failed' : current));
      window.clearInterval(interval);
    }, 10000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
      container.innerHTML = '';
    };
  }, [config.height, config.key, config.src, config.width, slot]);
  return <div className={`adsterra-ad adsterra-${unit} ${status === 'loaded' ? 'adsterra-loaded' : ''}`} style={{ '--ad-width': `${config.width}px`, '--ad-height': `${config.height}px` }} data-ad-slot={slot}>
    <div ref={containerRef} className="adsterra-script-slot" aria-label={`Adsterra ${slot}`} />
    {status === 'failed' && <span className="adsterra-fallback">Реклама не загрузилась</span>}
  </div>;
}
