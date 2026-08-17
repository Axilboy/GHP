import { vkSummary } from '../vk';
import { Header } from '../shared/Header';

export function VkMiniAppPage({ navigate, vkLaunch }) {
  const summary = vkSummary(vkLaunch);
  return <main className="app-screen vk-page">
    <Header navigate={navigate} right={<span className="badge">VK</span>} />
    <section className="legal-hero wrap">
      <span className="eyebrow">VK Mini Apps</span>
      <h1>GameHubParty в VK Mini Apps</h1>
      <p>Версия для VK использует те же комнаты, игровые сценарии и профили, что и основной сайт GameHubParty.</p>
    </section>
    <section className="section wrap">
      <h2>Как работает версия для VK</h2>
      <div className="vk-checks">
        <article><b>Безопасное подключение</b><span>Мини-приложение открывает GameHubParty по защищённому HTTPS-соединению.</span></article>
        <article><b>Параметры VK</b><span>{summary ? `Пользователь: ${summary.userId || 'не передан'}, платформа: ${summary.platform || 'не передана'}` : 'Откройте страницу из VK, чтобы увидеть launch-параметры.'}</span></article>
        <article><b>Проверка запуска</b><span>{summary?.verified ? 'Параметры запуска проверены сервером.' : 'Откройте страницу внутри VK, чтобы проверить параметры запуска.'}</span></article>
      </div>
    </section>
    <section className="section wrap">
      <h2>Документы для модерации</h2>
      <div className="actions"><button className="button secondary" onClick={() => navigate('privacy')}>Политика конфиденциальности</button><button className="button secondary" onClick={() => navigate('terms')}>Пользовательское соглашение</button></div>
    </section>
  </main>;
}
