import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { APP_RELEASE_CHANGES, APP_RELEASE_DATE, APP_RELEASE_NAME, APP_VERSION } from './src/version.js';

const buildMoment = new Date();
const buildId = process.env.GHP_BUILD_ID || buildMoment.toISOString().replace(/[-:.TZ]/g, '');
const moscowParts = Object.fromEntries(new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
}).formatToParts(buildMoment).map(({ type, value }) => [type, value]));
const versionLabel = `${APP_VERSION}-${moscowParts.day}.${moscowParts.month}.${moscowParts.year}-${moscowParts.hour}-${moscowParts.minute}`;

export default defineConfig({
  define: {
    __GHP_BUILD_ID__: JSON.stringify(buildId),
    __GHP_VERSION_LABEL__: JSON.stringify(versionLabel),
  },
  plugins: [
    react(),
    {
      name: 'gamehubparty-build-manifest',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({
            buildId,
            version: APP_VERSION,
            versionLabel,
            releaseDate: APP_RELEASE_DATE,
            releaseName: APP_RELEASE_NAME,
            changes: APP_RELEASE_CHANGES,
          }),
        });
      },
    },
  ],
  build: {
    // Обложки — отдельными кэшируемыми файлами, а не base64 в CSS: браузер тянет
    // фон только когда карточка реально отрисована. Иначе весь каталог грузится всегда.
    assetsInlineLimit: 1024,
  },
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api': 'http://127.0.0.1:3100',
      '/socket.io': {
        target: 'http://127.0.0.1:3100',
        ws: true,
      },
    },
  },
});
