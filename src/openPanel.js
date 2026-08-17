import { OpenPanel } from '@openpanel/web';

const apiUrl = String(import.meta.env.VITE_OPENPANEL_API_URL || '').replace(/\/$/, '');
const clientId = String(import.meta.env.VITE_OPENPANEL_CLIENT_ID || '').trim();

let client = null;

export function initOpenPanel() {
  if (client || !apiUrl || !clientId) return client;
  client = new OpenPanel({
    apiUrl,
    clientId,
    trackScreenViews: false,
    trackOutgoingLinks: true,
    trackAttributes: true,
  });
  return client;
}

export function trackOpenPanelEvent(name, details = {}) {
  const instance = initOpenPanel();
  if (!instance || !name) return;
  const properties = { ...details };
  if (properties.playerId) properties.profileId = properties.playerId;
  instance.track(name, properties).catch(() => {});
}
