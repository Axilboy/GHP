import { useState } from 'react';
import { emit } from '../socket';
import { getAccount, getOrCreateDisplayName, getPlayerId, saveAccount, saveGuestDisplayName } from '../identity';
import { AuthModal } from '../RoadmapPanels';
import { Header, SubscriptionBadge } from '../shared/Header';
import { ErrorText } from '../shared/ui';
import { formatAccessDate, profileAccessList } from '../shared/helpers';

export function ProfileScreen({ navigate, profile, setProfile }) {
  const [authOpen, setAuthOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [avatarDraft, setAvatarDraft] = useState(null);
  const [profileError, setProfileError] = useState('');
  const name = profile?.name || getOrCreateDisplayName();
  const activeAccesses = profileAccessList(profile);
  const syncAccount = (nextProfile) => {
    const account = getAccount();
    if (account) saveAccount({ ...account, name: nextProfile.name, avatarDataUrl: nextProfile.avatarDataUrl || '' });
  };
  const saveProfileName = async (event) => {
    event.preventDefault();
    setProfileError('');
    try {
      const result = await emit('update_profile', { name: draftName });
      setProfile(result.profile);
      saveGuestDisplayName(result.profile.name);
      syncAccount(result.profile);
      setEditingName(false);
    } catch (error) {
      setProfileError(error.message || 'Не удалось изменить имя');
    }
  };
  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setProfileError('');
    if (!file.type.startsWith('image/')) {
      setProfileError('Выберите картинку в формате PNG, JPG или WEBP.');
      return;
    }
    if (file.size > 6000000) {
      setProfileError('Картинка слишком большая. Лучше выбрать файл до 6 МБ.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarDraft({ src: String(reader.result || ''), zoom: 1, x: 0, y: 0 });
    reader.readAsDataURL(file);
  };
  const saveAvatar = async () => {
    if (!avatarDraft?.src) return;
    setProfileError('');
    try {
      const avatarDataUrl = await cropAvatarImage(avatarDraft);
      const result = await emit('update_profile', { avatarDataUrl });
      setProfile(result.profile);
      syncAccount(result.profile);
      setAvatarDraft(null);
    } catch (error) {
      setProfileError(error.message || 'Не удалось обновить аватар');
    }
  };
  return <main className="app-screen">
    <Header navigate={navigate} right={<SubscriptionBadge profile={profile} />} />
    <section className="profile-hero wrap compact-profile-hero">
      <label className="avatar-large avatar-edit" title="Поменять аватар">
        {profile?.avatarDataUrl ? <img src={profile.avatarDataUrl} alt="" /> : name[0]?.toUpperCase()}
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadAvatar} />
      </label>
      <span className="eyebrow">Профиль игрока</span>
      {editingName ? <form className="profile-name-form" onSubmit={saveProfileName}>
        <input autoFocus value={draftName} onChange={(event) => setDraftName(event.target.value)} maxLength={24} />
        <button className="button small secondary" type="button" onClick={() => setEditingName(false)}>Отмена</button>
        <button className="button small primary" type="submit">Сохранить</button>
      </form> : <button className="profile-name-button" onClick={() => { setDraftName(name); setEditingName(true); }}><h1>{name}</h1><small>Нажмите, чтобы изменить имя</small></button>}
      <small className="profile-id">ID: {profile?.id || getPlayerId()}</small>
      <p>{profile?.accountType === 'guest' ? 'Гостевой профиль' : `Аккаунт ${profile?.email || 'подключен'}`}</p>
      {profileError && <ErrorText text={profileError} />}
    </section>
    <section className="section wrap profile-access-panel">
      <div className="section-title"><h2>Мои доступы</h2><button className="link" onClick={() => navigate('store')}>В магазин</button></div>
      {activeAccesses.length ? <div className="profile-access-list">{activeAccesses.map((access) => <article key={access.id}>
        <i>{access.title[0]}</i>
        <span><b>{access.title}</b><small>{access.label}</small><em>до {formatAccessDate(access.until)}</em></span>
        <p>{access.note}</p>
      </article>)}</div> : <div className="profile-empty-access"><b>FREE</b><span>Активных платных доступов нет. Базовые игры доступны бесплатно.</span></div>}
      {profile?.orders?.some((order) => order.status === 'pending') && <p className="guest-name-note">Есть незавершённые заказы. Проверьте их в магазине или обратитесь в поддержку.</p>}
      {profile?.accountType === 'guest' && <button className="button secondary full" onClick={() => setAuthOpen(true)}>Войти для сохранения покупок</button>}
    </section>
    {authOpen && <AuthModal close={() => setAuthOpen(false)} setProfile={setProfile} />}
    {avatarDraft && <AvatarCropModal draft={avatarDraft} setDraft={setAvatarDraft} close={() => setAvatarDraft(null)} save={saveAvatar} />}
  </main>;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Не удалось прочитать картинку'));
    image.src = src;
  });
}

async function cropAvatarImage({ src, zoom, x, y }) {
  const image = await loadImage(src);
  const size = 512;
  const previewSize = 184;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  context.fillStyle = '#edf4ff';
  context.fillRect(0, 0, size, size);
  const baseScale = Math.max(size / image.width, size / image.height);
  const scale = baseScale * Number(zoom || 1);
  const offsetScale = size / previewSize;
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const drawX = (size - drawWidth) / 2 + Number(x || 0) * offsetScale;
  const drawY = (size - drawHeight) / 2 + Number(y || 0) * offsetScale;
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  return canvas.toDataURL('image/jpeg', 0.86);
}

function AvatarCropModal({ draft, setDraft, close, save }) {
  const update = (field, value) => setDraft((current) => ({ ...current, [field]: Number(value) }));
  return <div className="backdrop avatar-crop-backdrop" onMouseDown={close}>
    <section className="modal avatar-crop-modal" onMouseDown={(event) => event.stopPropagation()}>
      <div className="modal-title"><div><span className="eyebrow">Аватар</span><h2>Выберите кадр</h2><p>Подвиньте картинку и настройте зум, чтобы лицо или нужная часть попали в круг.</p></div><button className="close" onClick={close}>×</button></div>
      <div className="avatar-crop-stage">
        <div className="avatar-crop-preview"><img src={draft.src} alt="" style={{ transform: `translate(${draft.x}px, ${draft.y}px) scale(${draft.zoom})` }} /></div>
      </div>
      <div className="avatar-crop-controls">
        <label><span>Зум</span><input type="range" min="1" max="2.6" step="0.01" value={draft.zoom} onChange={(event) => update('zoom', event.target.value)} /></label>
        <label><span>Сдвиг влево / вправо</span><input type="range" min="-80" max="80" step="1" value={draft.x} onChange={(event) => update('x', event.target.value)} /></label>
        <label><span>Сдвиг вверх / вниз</span><input type="range" min="-80" max="80" step="1" value={draft.y} onChange={(event) => update('y', event.target.value)} /></label>
      </div>
      <div className="avatar-crop-actions"><button className="button secondary full" onClick={close}>Отмена</button><button className="button primary full" onClick={save}>Сохранить аватар</button></div>
    </section>
  </div>;
}
