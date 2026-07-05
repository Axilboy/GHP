import { useEffect, useState } from 'react';
import { Header, VersionBadge } from '../shared/Header';
import { APP_RELEASE_DATE, APP_RELEASE_NAME, APP_VERSION } from '../version';
import { screenshotFolders } from './releaseNotes';

export function DemoPage({ navigate }) {
  const [status, setStatus] = useState(null);
  const [updatedAt] = useState(() => new Date().toLocaleString('ru-RU'));
  useEffect(() => {
    fetch('/api/status').then((response) => response.json()).then(setStatus).catch(() => setStatus({ ok: false }));
  }, []);
  return <main className="app-screen demo-page">
    <Header navigate={navigate} right={<VersionBadge />} />
    <section className="legal-hero wrap">
      <span className="eyebrow">Статус и обновления</span>
      <h1>GameHubParty v{APP_VERSION}</h1>
      <p>{APP_RELEASE_NAME}: актуальная версия от {APP_RELEASE_DATE}. Здесь собраны быстрые ссылки, состояние сервера и история визуальных обновлений.</p>
      <div className="actions"><button className="button primary" onClick={() => navigate('spy')}>Играть в Шпиона</button><button className="button secondary" onClick={() => navigate('store')}>Открыть магазин</button></div>
    </section>
    <section className="section wrap demo-status">
      <div className="section-title"><h2>Статус</h2><span className={`badge ${status?.ok ? 'live' : ''}`}>{status ? status.ok ? 'Онлайн' : 'Ошибка' : 'Проверяем'}</span></div>
      <div className="purchase-status-grid"><article><b>{status?.activeRooms ?? '...'}</b><span>активных комнат</span></article><article><b>{status?.games?.length ?? '...'}</b><span>игры в каталоге</span></article><article><b>v{APP_VERSION}</b><span>текущая версия</span></article><article><b>{updatedAt}</b><span>время открытия</span></article></div>
    </section>
    <section className="section wrap">
      <h2>Быстрый просмотр</h2>
      <div className="demo-links"><button onClick={() => navigate('home')}>Главная</button><button onClick={() => navigate('spy')}>Лендинг Шпиона</button><button onClick={() => navigate('store')}>Магазин</button><button onClick={() => navigate('profile')}>Профиль</button><button onClick={() => navigate('contacts')}>Контакты</button><button onClick={() => navigate('refund')}>Возвраты</button><button onClick={() => navigate('alias')}>Alias</button><button onClick={() => navigate('vk')}>VK-страница</button></div>
    </section>
    <section className="section wrap">
      <div className="section-title"><h2>История обновлений</h2><span>{screenshotFolders.length}</span></div>
      <div className="screenshot-folders">{screenshotFolders.map((folder) => <article className="screenshot-folder-card" key={folder.title}>
        <div className="screenshot-folder-head"><div><b>{folder.title}</b><p>{folder.description}</p></div><span>{folder.shots.length} скринов</span></div>
        <div className="screenshot-carousel">{folder.shots.map((shot) => <a key={shot.file} href={shot.file} target="_blank" rel="noreferrer"><img src={shot.file} alt={shot.title} loading="lazy" /><small>{shot.title}</small></a>)}</div>
      </article>)}</div>
      <p className="guest-name-note">Каждая папка содержит описание правок и скриншоты для проверки после релиза.</p>
    </section>
  </main>;
}
