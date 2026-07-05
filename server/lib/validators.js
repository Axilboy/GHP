export function cleanName(value) {
  const name = String(value || '').trim().slice(0, 24);
  if (!name) throw new Error('Введите имя');
  return name;
}

export function cleanFeedbackText(value, limit) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

export function cleanEmail(value) {
  const email = String(value || '').trim().toLowerCase().slice(0, 160);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Введите корректную почту.');
  return email;
}

export function cleanAvatarDataUrl(value) {
  const dataUrl = String(value || '').trim();
  if (!dataUrl) return '';
  if (dataUrl.length > 350000) throw new Error('Картинка слишком большая. Выберите файл поменьше.');
  if (!/^data:image\/(png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(dataUrl)) throw new Error('Поддерживаются PNG, JPG и WEBP.');
  return dataUrl;
}

export function cleanPlayerId(value) {
  const id = String(value || '').trim();
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new Error('Некорректный идентификатор игрока');
  return id;
}
