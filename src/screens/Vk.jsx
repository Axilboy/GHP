import { vkSummary } from '../vk';
import { Header } from '../shared/Header';

export function VkMiniAppPage({ navigate, vkLaunch }) {
  const summary = vkSummary(vkLaunch);
  return <main className="app-screen vk-page">
    <Header navigate={navigate} right={<span className="badge">VK</span>} />
    <section className="legal-hero wrap">
      <span className="eyebrow">VK Mini Apps</span>
      <h1>GameHubParty готовится к запуску во ВКонтакте</h1>
      <p>Эта страница нужна для проверки мини-приложения, модерации и будущей отдельной сборки под VK.</p>
    </section>
    <section className="section wrap">
      <h2>Статус запуска</h2>
      <div className="vk-checks">
        <article><b>HTTPS-домен</b><span>Для VK нужно указать адрес приложения, например vk.gamehubparty.ru.</span></article>
        <article><b>Параметры VK</b><span>{summary ? `Пользователь: ${summary.userId || 'не передан'}, платформа: ${summary.platform || 'не передана'}` : 'Откройте страницу из VK, чтобы увидеть launch-параметры.'}</span></article>
        <article><b>Проверка подписи</b><span>{summary?.verified ? 'Подпись проверена сервером.' : 'Подпись будет проверяться после добавления VK_APP_SECRET на сервер.'}</span></article>
      </div>
    </section>
    <section className="section wrap">
      <h2>Документы для модерации</h2>
      <div className="actions"><button className="button secondary" onClick={() => navigate('privacy')}>Политика конфиденциальности</button><button className="button secondary" onClick={() => navigate('terms')}>Пользовательское соглашение</button></div>
    </section>
  </main>;
}
