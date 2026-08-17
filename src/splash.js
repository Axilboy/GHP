// Ведёт стартовый сплэш: докачивает картинки первого экрана и показывает реальный прогресс.
// Разметка живёт в index.html и появляется мгновенно, ещё до загрузки бандла.
import partyUrl from './assets/ghp-theme-party-card.webp';
import spyUrl from './assets/ghp-game-spy-hero-card.webp';
import aliasUrl from './assets/ghp-game-alias-hero-card.webp';
import bunkerUrl from './assets/ghp-game-bunker-hero-card.webp';

const CRITICAL = [partyUrl, spyUrl, aliasUrl, bunkerUrl];
const HARD_TIMEOUT_MS = 4000; // ponytail: застрявший ассет не должен держать пользователя
// Бандл со стилями и шрифтами — это ~70% всей загрузки (замерено: 430 КБ из 596 КБ),
// поэтому CSS-анимация честно доводит полосу до 65%, а байты картинок докручивают остаток.
const BASE_PERCENT = 65;

// localStorage кидает в VK-iframe / приватном режиме — глотаем, сплэш работает и без него.
const seenBefore = () => { try { return Boolean(localStorage.getItem('ghp_splash_seen')); } catch { return false; } };
const markSeen = () => { try { localStorage.setItem('ghp_splash_seen', '1'); } catch { /* нет доступа — не критично */ } };

const formatMb = (bytes) => `${(bytes / 1048576).toFixed(1).replace('.', ',')} МБ`;

// Сколько браузер скачал до старта нашего кода: html, бандл, стили, шрифты.
// Сам бандл измерить по ходу нельзя — его грузит браузер, — но итог он отдаёт.
function bytesAlreadyDownloaded() {
  try {
    const resources = performance.getEntriesByType('resource');
    const [navigation] = performance.getEntriesByType('navigation');
    return resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0)
      + (navigation ? navigation.transferSize || 0 : 0);
  } catch {
    return 0;
  }
}

// Качает файл потоком, сообщая каждый пришедший кусок. Возвращает размер из заголовка.
async function fetchWithProgress(url, onChunk, onSize) {
  const response = await fetch(url);
  const declared = Number(response.headers.get('content-length')) || 0;
  onSize(declared);
  if (!response.body || typeof response.body.getReader !== 'function') {
    const buffer = await response.arrayBuffer();
    onChunk(buffer.byteLength);
    return;
  }
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(value.length);
  }
}

export function runSplash() {
  const el = document.getElementById('ghp-splash');
  if (!el) return; // сплэш уже убран страховочным таймером — ничего не делаем
  const fill = document.getElementById('ghp-splash-fill');
  const count = document.getElementById('ghp-splash-count');
  const bytesRow = document.getElementById('ghp-splash-bytes');

  const firstRun = !seenBefore();
  const minShow = firstRun ? 600 : 0; // на первом запуске даём бренду мелькнуть, дальше — мгновенно
  const started = performance.now();
  const baseBytes = bytesAlreadyDownloaded();
  const total = CRITICAL.length;

  let loadedFiles = 0;
  let loadedBytes = 0; // докачано нами
  let declaredBytes = 0; // сколько всего обещали заголовки картинок
  let shownPercent = BASE_PERCENT;
  let settled = false;

  const paint = () => {
    const done = baseBytes + loadedBytes;
    const expected = baseBytes + declaredBytes;
    if (fill) {
      fill.style.animation = 'none'; // забираем управление у CSS-анимации
      const real = expected > 0 ? Math.round((done / expected) * 100) : BASE_PERCENT;
      shownPercent = Math.min(100, Math.max(shownPercent, real)); // прогресс не должен пятиться
      fill.style.width = `${shownPercent}%`;
    }
    if (count) {
      count.textContent = loadedFiles < total ? `Загружаем игры… ${loadedFiles} из ${total}` : 'Готово';
    }
    if (bytesRow) {
      if (expected <= 0) { bytesRow.textContent = ''; return; }
      const elapsed = performance.now() - started;
      const remaining = Math.max(0, expected - done);
      const speed = loadedBytes / elapsed; // байт/мс, считаем только по своей докачке
      const eta = speed > 0 ? remaining / speed / 1000 : 0;
      // ETA показываем, только когда он осмысленный: иначе цифры мигают и врут.
      const showEta = elapsed > 400 && remaining > 0 && eta >= 1 && eta < 60;
      bytesRow.textContent = `${formatMb(done)} из ${formatMb(expected)}`
        + (showEta ? ` · осталось ~${Math.ceil(eta)} сек` : '');
    }
  };

  const settle = () => {
    if (settled) return;
    settled = true;
    markSeen();
    const wait = Math.max(0, minShow - (performance.now() - started));
    setTimeout(() => {
      el.classList.add('ghp-splash--hide');
      setTimeout(() => el.remove(), 400);
    }, wait);
  };

  const finishOne = () => {
    loadedFiles += 1;
    paint();
    if (loadedFiles >= total) settle();
  };

  for (const src of CRITICAL) {
    if (typeof fetch === 'function') {
      fetchWithProgress(
        src,
        (chunk) => { loadedBytes += chunk; paint(); },
        (size) => { declaredBytes += size; paint(); },
      ).then(finishOne, finishOne); // сеть отвалилась — не блокируем вход в приложение
    } else {
      const img = new Image(); // очень старый браузер: считаем по файлам, без байтов
      img.onload = finishOne;
      img.onerror = finishOne;
      img.src = src;
    }
  }
  paint();
  setTimeout(settle, HARD_TIMEOUT_MS);
}
