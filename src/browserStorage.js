const fallbackStorage = new Map();

function fallbackKey(type, key) {
  return `${type}:${key}`;
}

function getStorage(type) {
  try {
    return globalThis?.[type] || null;
  } catch (_) {
    return null;
  }
}

function getItem(type, key) {
  const storage = getStorage(type);
  try {
    const value = storage?.getItem(key);
    return value == null ? fallbackStorage.get(fallbackKey(type, key)) || null : value;
  } catch (_) {
    return fallbackStorage.get(fallbackKey(type, key)) || null;
  }
}

function setItem(type, key, value) {
  const nextValue = String(value);
  fallbackStorage.set(fallbackKey(type, key), nextValue);
  const storage = getStorage(type);
  try {
    storage?.setItem(key, nextValue);
  } catch (_) {}
}

function removeItem(type, key) {
  fallbackStorage.delete(fallbackKey(type, key));
  const storage = getStorage(type);
  try {
    storage?.removeItem(key);
  } catch (_) {}
}

export const localStore = {
  getItem: (key) => getItem('localStorage', key),
  setItem: (key, value) => setItem('localStorage', key, value),
  removeItem: (key) => removeItem('localStorage', key),
};

export const sessionStore = {
  getItem: (key) => getItem('sessionStorage', key),
  setItem: (key, value) => setItem('sessionStorage', key, value),
  removeItem: (key) => removeItem('sessionStorage', key),
};
