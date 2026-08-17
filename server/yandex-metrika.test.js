import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/yandexMetrika.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('Yandex Metrika uses the configured SPA and SSR-compatible counter code', () => {
  assert.match(source, /VITE_YANDEX_METRIKA_ID/);
  assert.match(source, /tag\.js\?id=\$\{metrikaId\}/);
  assert.match(source, /ssr: true/);
  assert.match(source, /webvisor: true/);
  assert.match(source, /trackMetrikaPageView/);
  assert.match(source, /gamehubparty_marketing_attribution/);
  assert.match(source, /utm_content/);
  assert.match(source, /reachGoal', goal, \{ \.\.\.getMetrikaAttribution\(\), \.\.\.params \}/);
  assert.match(html, /mc\.yandex\.ru\/watch\/%VITE_YANDEX_METRIKA_ID%/);
});

test('marketing events cover the paid funnel without exposing raw room ids', () => {
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const helpers = fs.readFileSync(new URL('../src/shared/helpers.js', import.meta.url), 'utf8');
  const store = fs.readFileSync(new URL('../src/RoadmapPanels.jsx', import.meta.url), 'utf8');
  assert.match(app, /trackClientEvent\('game_started'/);
  assert.match(app, /game_type:/);
  assert.match(app, /players_count:/);
  assert.match(app, /room_id_hash:/);
  assert.doesNotMatch(app, /game_started[^;]+roomId:/s);
  assert.match(helpers, /SHA-256/);
  assert.match(helpers, /return_visit/);
  assert.match(store, /trackClientEvent\('registration'/);
  assert.match(store, /trackStoreEvent\('pro_purchase'/);
});
