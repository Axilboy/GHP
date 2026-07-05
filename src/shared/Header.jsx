import { useEffect, useState } from 'react';
import { emit } from '../socket';
import { getOrCreateDisplayName, getPlayerId } from '../identity';
import { getSubscriptionStatus } from '../profileStatus';
import { APP_VERSION } from '../version';
import { currentPath, trackClientEvent } from './helpers';

export function FeedbackModal({ close }) {
  const [topic, setTopic] = useState('idea');
  const [message, setMessage] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const topics = [
    { id: 'idea', label: 'Предложение' },
    { id: 'bug', label: 'Баг' },
    { id: 'payment', label: 'Оплата' },
    { id: 'other', label: 'Другое' },
  ];
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (message.trim().length < 8) {
      setError('Напишите чуть подробнее, чтобы мы поняли ситуацию.');
      return;
    }
    setStatus('sending');
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic,
          message,
          contactEmail,
          playerId: getPlayerId(),
          playerName: getOrCreateDisplayName(),
          page: location.href,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Не получилось отправить обращение');
      setStatus('sent');
    } catch (sendError) {
      setStatus('idle');
      setError(sendError.message || 'Не получилось отправить обращение');
    }
  };
  return <div className="backdrop feedback-backdrop" onMouseDown={close}>
    <section className="modal feedback-modal" onMouseDown={(event) => event.stopPropagation()}>
      <button className="modal-close" type="button" aria-label="Закрыть обратную связь" onClick={close}>×</button>
      {status === 'sent' ? <>
        <div className="feedback-orb">✓</div>
        <span className="eyebrow">Обратная связь</span>
        <h2>Спасибо, сообщение ушло в поддержку</h2>
        <p>Если оставили почту, мы сможем ответить. Если нет — все равно разберем обращение и поправим продукт.</p>
        <button className="button primary full" type="button" onClick={close}>Готово</button>
      </> : <form onSubmit={submit}>
        <span className="eyebrow">Обратная связь</span>
        <h2>Что случилось?</h2>
        <p>Можно написать идею, баг, вопрос по оплате или просто что мешает нормально играть.</p>
        <label className="field">
          <span>Тип обращения</span>
          <select value={topic} onChange={(event) => setTopic(event.target.value)}>
            {topics.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Сообщение</span>
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} maxLength={2000} placeholder="Например: в комнате не запускается раунд, оплата зависла или есть идея для Шпиона..." />
        </label>
        <label className="field">
          <span>Почта для ответа <small>необязательно</small></span>
          <input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} maxLength={120} placeholder="you@example.com" />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="feedback-submit-bar">
          <button className="button primary full" type="submit" disabled={status === 'sending'}>{status === 'sending' ? 'Отправляем...' : 'Отправить в поддержку'}</button>
          <small className="feedback-note">Адрес поддержки: support@gamehubparty.ru</small>
        </div>
      </form>}
    </section>
  </div>;
}

export function Header({ right, navigate, gameTitle, brandTheme = 'ghp' }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [menuProfile, setMenuProfile] = useState(null);
  const [touchStartX, setTouchStartX] = useState(null);
  const name = getOrCreateDisplayName();
  useEffect(() => {
    if (menuOpen) emit('get_profile').then((result) => setMenuProfile(result.profile)).catch(() => {});
  }, [menuOpen]);
  const go = (nextView) => {
    setMenuOpen(false);
    if (navigate) navigate(nextView);
    else location.assign({ home: '/', spy: '/games/spy', alias: '/games/alias', bunker: '/games/bunker', profile: '/profile', store: '/store', vk: '/vk', admin: '/admin', demo: '/demo', privacy: '/privacy', terms: '/terms', contacts: '/contacts', refund: '/refund' }[nextView]);
  };
  const menuStatus = getSubscriptionStatus(menuProfile);
  const openFeedback = () => {
    setMenuOpen(false);
    trackClientEvent('feedback_opened', { page: currentPath() });
    setFeedbackOpen(true);
  };
  const createRoom = () => {
    setMenuOpen(false);
    window.dispatchEvent(new CustomEvent('gamehubparty:create-room'));
  };
  const logo = <><i>G</i><span>GameHub</span><mark>Party</mark></>;
  return <><header className="header wrap"><button className="brand project-logo ghp-logo" onClick={() => go('home')}>{logo}{gameTitle && <small>| {gameTitle}</small>}</button><div className="header-actions">{right}<button className="menu-button" aria-label="Открыть меню" onClick={() => setMenuOpen(true)}><span /><span /><span /></button></div></header>{menuOpen && <div className="backdrop menu-backdrop" onMouseDown={() => setMenuOpen(false)}><aside className="menu-sheet" onMouseDown={(event) => event.stopPropagation()} onTouchStart={(event) => setTouchStartX(event.touches[0].clientX)} onTouchEnd={(event) => { if (touchStartX !== null && touchStartX - event.changedTouches[0].clientX > 55) setMenuOpen(false); setTouchStartX(null); }}><button className="menu-profile" onClick={() => go('profile')}><div className={`menu-avatar ${menuStatus.active ? 'premium-avatar' : ''}`}>{name[0]?.toUpperCase()}{menuStatus.active && <span className="avatar-crown">♛</span>}</div><div><b>{menuProfile?.name || name}</b><small>{menuStatus.active ? `${menuStatus.plan} до ${menuStatus.untilText}` : 'Гостевой профиль'}</small></div><strong className={menuStatus.active ? 'premium-menu-badge' : ''}>{menuStatus.active ? menuStatus.plan : 'FREE'}</strong></button><nav><button onClick={() => go('store')}>Магазин и наборы</button><button onClick={openFeedback}>Обратная связь</button></nav><button className="button primary full" onClick={createRoom}>Создать комнату</button></aside></div>}{feedbackOpen && <FeedbackModal close={() => setFeedbackOpen(false)} />}</>;
}

export function VersionBadge() {
  return <span className="badge version-badge">v{APP_VERSION}</span>;
}

export function SubscriptionBadge({ profile }) {
  const status = getSubscriptionStatus(profile);
  if (!status.active) return null;
  return <span className="badge premium-badge">♛ {status.plan}</span>;
}
