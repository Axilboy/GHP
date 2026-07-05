import { useRef } from 'react';
import { getOrCreateDisplayName } from '../identity';
import { Header, SubscriptionBadge } from '../shared/Header';
import { CarouselFrame, JoinModal, SeoLinks, VkStatus, useAutoScrollCarousel } from '../shared/ui';
import { LandingAccessShowcase } from '../shared/Landing';

export function ProjectLanding({ create, navigate, join, joinOpen, closeJoin, onJoin, vkLaunch, profile }) {
  const name = getOrCreateDisplayName();
  const gamesRef = useRef(null);
  useAutoScrollCarousel(gamesRef, []);
  return <main className="project-landing">
    <Header navigate={navigate} right={<SubscriptionBadge profile={profile} />} />
    <VkStatus launch={vkLaunch} />
    <section className="project-hero wrap upgraded-hero"><div className="landing-art hub-art" /><h1>Игры для компании в телефоне</h1><p>Создайте комнату, выберите игру и позовите друзей по коду. GameHubParty сам ведёт роли, таймер и голосование.</p><div className="actions"><button className="button primary" onClick={() => create(name)}>Начать игру</button><button className="button secondary" onClick={join}>Войти по коду</button></div></section>
    <section className="landing-section game-showcase-section wrap"><div className="section-title carousel-title"><div><span className="eyebrow">Игры для компании</span><h2>Витрина игр</h2></div></div><CarouselFrame target={gamesRef}><div className="landing-games game-showcase" ref={gamesRef}><button onClick={() => navigate('spy')}><div className="landing-game-art spy-art" /><span className="badge live">Готово</span><h3>Шпион</h3><p>Секретное место или предмет, вопросы вслух и голосование за подозреваемого.</p><strong>Открыть игру</strong></button><button onClick={() => navigate('alias')}><div className="landing-game-art alias-art" /><span className="badge live">Готово</span><h3>Alias</h3><p>Команды объясняют слова на скорость, а телефон ведёт таймер и счёт.</p><strong>Открыть Alias</strong></button><button onClick={() => navigate('bunker')}><div className="landing-game-art bunker-art" /><span className="badge live">Готово</span><h3>Бункер</h3><p>Катастрофа, карточки выживших и спор за место в убежище.</p><strong>Открыть Бункер</strong></button></div></CarouselFrame></section>
    <LandingAccessShowcase game="home" navigate={navigate} profile={profile} />
    <section className="landing-cta wrap"><h2>Готовы играть?</h2><p>Начните с комнаты для Шпиона или выберите игру в витрине.</p><button className="button primary full" onClick={() => create(name)}>Начать игру</button></section>
    <SeoLinks />
    {joinOpen && <JoinModal initialName={name} close={closeJoin} join={onJoin} />}
  </main>;
}

export function BottomNav({ active, navigate }) {
  return <nav className="bottom-nav">
    <button className={active === 'home' ? 'active' : ''} onClick={() => navigate('home')}><b>Главная</b><span>Играть</span></button>
    <button className={active === 'store' ? 'active' : ''} onClick={() => navigate('store')}><b>Магазин</b><span>Наборы</span></button>
    <button className={active === 'profile' ? 'active' : ''} onClick={() => navigate('profile')}><b>Профиль</b><span>Доступы</span></button>
  </nav>;
}
