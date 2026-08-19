import { useEffect, useState } from 'react';
import { emit } from '../socket';
import { getOrCreateDisplayName, getPlayerId } from '../identity';
import { getSubscriptionStatus } from '../profileStatus';
import { APP_DISPLAY_VERSION } from '../version';
import { currentPath, trackClientEvent } from './helpers';

const supportTopics = [
  { id: 'idea', label: 'Предложение' },
  { id: 'bug', label: 'Баг' },
  { id: 'content', label: 'Свой набор карточек' },
  { id: 'payment', label: 'Оплата' },
  { id: 'other', label: 'Другое' },
];
const supportTopicNames = Object.fromEntries(supportTopics.map((item) => [item.id, item.label]));
const supportStatusNames = { open: 'В работе', accepted: 'Принято', rejected: 'Отклонено', closed: 'Закрыто' };

// Обратная связь — это переписка с админом, а не письмо в один конец. Пока окно
// открыто, ответы подтягиваются опросом: для поддержки этого хватает, отдельный
// сокет-канал ради чата заводить не нужно.
export function FeedbackModal({ close }) {
  const [threads, setThreads] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [composing, setComposing] = useState(false);
  const [topic, setTopic] = useState('idea');
  const [message, setMessage] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [reply, setReply] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const playerId = getPlayerId();

  const loadThreads = () => fetch('/api/threads?playerId=' + encodeURIComponent(playerId))
    .then((response) => response.json())
    .then((data) => { if (data.ok) setThreads(data.threads); })
    .catch(() => {});

  useEffect(() => {
    loadThreads();
    const timer = setInterval(loadThreads, 10000);
    return () => clearInterval(timer);
  }, []);

  const openThread = threads?.find((thread) => thread.id === openId) || null;
  useEffect(() => {
    if (!openThread?.unread) return;
    fetch('/api/threads/' + openThread.id + '/read', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ playerId }),
    }).then(loadThreads).catch(() => {});
  }, [openThread?.id, openThread?.unread]);

  const submitNew = async (event) => {
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
        body: JSON.stringify({ topic, message, contactEmail, playerId, playerName: getOrCreateDisplayName(), page: location.href }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Не получилось отправить обращение');
      setMessage('');
      setComposing(false);
      setOpenId(data.threadId);
      await loadThreads();
    } catch (sendError) {
      setError(sendError.message || 'Не получилось отправить обращение');
    } finally {
      setStatus('idle');
    }
  };

  const sendReply = async (event) => {
    event.preventDefault();
    if (!reply.trim()) return;
    setStatus('sending');
    setError('');
    try {
      const response = await fetch('/api/threads/' + openThread.id + '/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ playerId, text: reply }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Сообщение не отправилось');
      setReply('');
      await loadThreads();
    } catch (sendError) {
      setError(sendError.message || 'Сообщение не отправилось');
    } finally {
      setStatus('idle');
    }
  };

  const showForm = composing || (threads !== null && threads.length === 0);
  return <div className="backdrop feedback-backdrop" onMouseDown={close}>
    <section className="modal feedback-modal support-modal" onMouseDown={(event) => event.stopPropagation()}>
      <button className="modal-close" type="button" aria-label="Закрыть обратную связь" onClick={close}>×</button>

      {openThread ? <>
        <button className="link support-back" type="button" onClick={() => setOpenId(null)}>← Все обращения</button>
        <span className="eyebrow">{supportTopicNames[openThread.topic] || 'Обращение'}</span>
        <h2>Переписка с поддержкой</h2>
        <div className="support-messages">
          {openThread.messages.map((item) => <article key={item.id} className={'support-message support-' + item.from}>
            <span>{item.from === 'player' ? 'Вы' : item.from === 'admin' ? 'Поддержка' : 'Система'}</span>
            <p>{item.text}</p>
          </article>)}
        </div>
        {openThread.rewards?.length > 0 && <div className="support-rewards">
          <b>Начислено за помощь</b>
          {openThread.rewards.map((item, index) => <span key={item.productId + index}>{item.title || item.productId}</span>)}
        </div>}
        {error && <p className="form-error">{error}</p>}
        {openThread.status === 'closed'
          ? <p className="feedback-note">Обращение закрыто. Если тема снова актуальна, создайте новое.</p>
          : <form className="support-composer" onSubmit={sendReply}>
            <textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={2} maxLength={2000} placeholder="Ответить..." />
            <button className="button primary" type="submit" disabled={status === 'sending' || !reply.trim()}>Отправить</button>
          </form>}
      </> : showForm ? <form onSubmit={submitNew}>
        {threads?.length > 0 && <button className="link support-back" type="button" onClick={() => setComposing(false)}>← Все обращения</button>}
        <span className="eyebrow">Обратная связь</span>
        <h2>Что случилось?</h2>
        <p>Напишите идею, баг или свой набор карточек. Отвечаем в этом же окне, а за полезные находки начисляем доступ.</p>
        <label className="field">
          <span>Тип обращения</span>
          <select value={topic} onChange={(event) => setTopic(event.target.value)}>
            {supportTopics.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
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
          <button className="button primary full" type="submit" disabled={status === 'sending'}>{status === 'sending' ? 'Отправляем...' : 'Отправить'}</button>
          <small className="feedback-note">Адрес поддержки: support@gamehubparty.ru</small>
        </div>
      </form> : <>
        <span className="eyebrow">Обратная связь</span>
        <h2>Ваши обращения</h2>
        <div className="support-threads">
          {threads === null ? <p className="feedback-note">Загружаем...</p> : threads.map((thread) => <button key={thread.id} className="support-thread-row" type="button" onClick={() => setOpenId(thread.id)}>
            <span><b>{supportTopicNames[thread.topic] || 'Обращение'}</b><small>{thread.messages.at(-1)?.text.slice(0, 60)}</small></span>
            <strong className={'support-status support-status-' + thread.status}>{supportStatusNames[thread.status] || thread.status}{thread.unread > 0 ? ' · ' + thread.unread : ''}</strong>
          </button>)}
        </div>
        <button className="button primary full" type="button" onClick={() => setComposing(true)}>Новое обращение</button>
      </>}
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
    else location.assign({ home: '/', spy: '/games/spy', alias: '/games/alias', bunker: '/games/bunker', profile: '/profile', store: '/store', vk: '/vk', admin: '/admin', demo: '/demo', privacy: '/privacy', terms: '/terms', contacts: '/contacts' }[nextView]);
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
  return <span className="badge version-badge">v{APP_DISPLAY_VERSION}</span>;
}

export function SubscriptionBadge({ profile }) {
  const status = getSubscriptionStatus(profile);
  if (!status.active) return null;
  return <span className="badge premium-badge">♛ {status.plan}</span>;
}
