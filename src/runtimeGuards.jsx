import { useCallback, useEffect, useState } from 'react';

const BUILD_ID = typeof __GHP_BUILD_ID__ === 'string' ? __GHP_BUILD_ID__ : 'development';
const AD_BLOCK_CHECK_ENABLED = import.meta.env.VITE_ADSTERRA_ENABLED === 'true';

async function removeLegacyCaches() {
  if ('caches' in window) {
    const keys = await window.caches.keys();
    await Promise.all(keys.map((key) => window.caches.delete(key)));
  }
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }
}

async function fetchCurrentBuild() {
  const response = await fetch(`/version.json?t=${Date.now()}`, {
    cache: 'no-store',
    credentials: 'same-origin',
  });
  if (!response.ok) throw new Error(`Version check failed: ${response.status}`);
  return response.json();
}

function useBuildRefresh() {
  const [pendingUpdate, setPendingUpdate] = useState(null);
  const [applyingUpdate, setApplyingUpdate] = useState(false);

  useEffect(() => {
    let disposed = false;
    const check = async () => {
      try {
        const manifest = await fetchCurrentBuild();
        if (disposed || !manifest?.buildId || manifest.buildId === BUILD_ID) return;
        setPendingUpdate((current) => current?.buildId === manifest.buildId ? current : manifest);
      } catch {
        // A temporary network failure must not interrupt an active party.
      }
    };
    removeLegacyCaches().catch(() => {});
    window.addEventListener('ghp:check-version', check);
    return () => {
      disposed = true;
      window.removeEventListener('ghp:check-version', check);
    };
  }, []);

  const applyUpdate = useCallback(async () => {
    if (!pendingUpdate?.buildId || applyingUpdate) return;
    setApplyingUpdate(true);
    try {
      try {
        sessionStorage.setItem(`ghp-build-reload:${pendingUpdate.buildId}`, '1');
      } catch {
        // Обновление работает и без sessionStorage в приватном режиме.
      }
      await removeLegacyCaches();
      const target = new URL(window.location.href);
      target.searchParams.set('_ghp_build', pendingUpdate.buildId);
      window.location.replace(target.toString());
    } catch {
      window.location.reload();
    }
  }, [applyingUpdate, pendingUpdate]);

  return { pendingUpdate, applyingUpdate, applyUpdate };
}

async function detectAdBlock() {
  if (!AD_BLOCK_CHECK_ENABLED) return false;
  const probe = document.createElement('div');
  probe.className = 'adsbox ad-banner ad-placement pub_300x250';
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:absolute;left:-10000px;top:-10000px;width:10px;height:10px;pointer-events:none;';
  document.body.append(probe);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const style = window.getComputedStyle(probe);
  const cosmeticallyBlocked = probe.offsetHeight === 0 || probe.offsetWidth === 0 || style.display === 'none' || style.visibility === 'hidden';
  probe.remove();

  const requestBlocked = await new Promise((resolve) => {
    window.__ghpAdProbeLoaded = false;
    const script = document.createElement('script');
    let settled = false;
    const finish = (blocked) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      script.remove();
      resolve(blocked);
    };
    const timeout = window.setTimeout(() => finish(false), 3500);
    script.onload = () => finish(window.__ghpAdProbeLoaded !== true);
    script.onerror = () => finish(true);
    script.src = `/ads-check.js?check=${Date.now()}`;
    document.head.append(script);
  });
  const appIsOnline = requestBlocked
    ? await fetch(`/api/health?t=${Date.now()}`, { cache: 'no-store' }).then((response) => response.ok).catch(() => false)
    : true;
  return cosmeticallyBlocked || (requestBlocked && appIsOnline);
}

export function RuntimeGuards({ children }) {
  const { pendingUpdate, applyingUpdate, applyUpdate } = useBuildRefresh();
  const [adBlockState, setAdBlockState] = useState(AD_BLOCK_CHECK_ENABLED ? 'checking' : 'clear');
  const runAdBlockCheck = useCallback(async () => {
    setAdBlockState('checking');
    const blocked = await detectAdBlock().catch(() => false);
    setAdBlockState(blocked ? 'blocked' : 'clear');
  }, []);

  useEffect(() => {
    runAdBlockCheck();
  }, [runAdBlockCheck]);

  useEffect(() => {
    document.documentElement.toggleAttribute('data-adblock-blocked', adBlockState === 'blocked');
    return () => document.documentElement.removeAttribute('data-adblock-blocked');
  }, [adBlockState]);

  return <>
    {children}
    {pendingUpdate && <aside className="update-notice" role="dialog" aria-modal="true" aria-labelledby="update-title" aria-describedby="update-description">
      <div className="update-notice-glow" />
      <div className="update-notice-copy">
        <span className="eyebrow">Доступна новая версия{pendingUpdate.versionLabel || pendingUpdate.version ? ` · v${pendingUpdate.versionLabel || pendingUpdate.version}` : ''}</span>
        <h2 id="update-title">{pendingUpdate.releaseName || 'GameHubParty обновился'}</h2>
        <p id="update-description">Нажмите кнопку, чтобы перезагрузить страницу и начать пользоваться новой версией.</p>
        <ul>
          {(Array.isArray(pendingUpdate.changes) && pendingUpdate.changes.length
            ? pendingUpdate.changes
            : ['Исправления и улучшения стабильности.']).slice(0, 4).map((change) => <li key={change}>{change}</li>)}
        </ul>
      </div>
      <button className="button primary full" type="button" disabled={applyingUpdate} onClick={applyUpdate}>
        {applyingUpdate ? 'Обновляем…' : 'ОК — обновить страницу'}
      </button>
    </aside>}
    {adBlockState === 'blocked' && <div className="adblock-gate" role="alertdialog" aria-modal="true" aria-labelledby="adblock-title">
      <section className="adblock-gate-card">
        <span className="eyebrow">GameHubParty</span>
        <h1 id="adblock-title">Отключите блокировщик рекламы</h1>
        <p>Бесплатные комнаты работают за счёт рекламы. Добавьте <b>gamehubparty.ru</b> в исключения AdBlock, uBlock Origin, AdGuard или встроенной защиты браузера.</p>
        <ol>
          <li>Откройте значок блокировщика рядом с адресной строкой.</li>
          <li>Разрешите рекламу на <b>gamehubparty.ru</b>.</li>
          <li>Нажмите кнопку ниже — страница проверит доступ ещё раз.</li>
        </ol>
        <button className="button primary full" onClick={() => { window.dispatchEvent(new Event('ghp:retry-ads')); runAdBlockCheck(); }}>Я отключил — проверить</button>
        <p className="adblock-gate-hint">Если расширений нет, проверьте «Защиту от рекламы» браузера, DNS-фильтр или веб-защиту антивируса.</p>
        <small>Платная подписка убирает рекламные паузы, но проверка блокировщика защищает работу бесплатной версии сайта.</small>
        <nav><a href="/privacy">Политика конфиденциальности</a><a href="/contacts">Поддержка</a></nav>
      </section>
    </div>}
  </>;
}
