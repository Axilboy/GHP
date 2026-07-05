import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { VirtualPlayer } from './autotest/core/actor.mjs';

const PORT = Number(process.env.PORT || 3391);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const OUT_DIR = path.resolve('outputs', 'gameplay-recordings', '2026-06-30-bunker-mobile');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await delay(200);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function clickFirst(page, patterns, timeout = 10000) {
  for (const pattern of patterns) {
    const locator = page.getByRole('button', { name: pattern }).first();
    try {
      await locator.waitFor({ state: 'visible', timeout: 1500 });
      await locator.click();
      return;
    } catch {}
  }
  throw new Error(`Button not found: ${patterns.map(String).join(', ')}`);
}

async function waitText(page, pattern, timeout = 10000) {
  await page.getByText(pattern).first().waitFor({ state: 'visible', timeout });
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  for (const file of await fs.readdir(OUT_DIR).catch(() => [])) {
    if (file.endsWith('.webm')) await fs.unlink(path.join(OUT_DIR, file)).catch(() => {});
  }
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production', REDIS_URL: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let serverOutput = '';
  server.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
  server.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });

  const players = [];
  const guests = [];
  let browser;
  try {
    await waitFor(`${BASE_URL}/api/health`);

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      recordVideo: { dir: OUT_DIR, size: { width: 390, height: 844 } },
    });
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/games/bunker`, { waitUntil: 'networkidle' });
    await delay(900);
    await clickFirst(page, [/Создать комнату Бункер/i, /Начать Бункер/i]);
    await waitText(page, /Код комнаты/i);
    const rulesReady = page.getByRole('button', { name: /Понятно, играем/i }).first();
    if (await rulesReady.isVisible().catch(() => false)) await rulesReady.click();
    await delay(900);

    const session = await page.evaluate(() => JSON.parse(localStorage.getItem('gamehubparty_session') || '{}'));
    const hostId = await page.evaluate(() => localStorage.getItem('gamehubparty_player_id'));
    const roomId = session.roomId;
    const code = session.code;
    if (!roomId || !code || !hostId) throw new Error('Host session was not saved after room creation');

    const hostControl = new VirtualPlayer({
      baseUrl: BASE_URL,
      id: hostId,
      name: 'Хост',
      log: () => {},
    });
    players.push(hostControl);
    await hostControl.connect();
    hostControl.room = { id: roomId };

    for (const [index, name] of ['Ирина', 'Макс', 'Лена'].entries()) {
      const player = new VirtualPlayer({
        baseUrl: BASE_URL,
        id: `record-bunker-${index + 2}`,
        name,
        log: () => {},
      });
      players.push(player);
      guests.push(player);
      await player.connect();
      await player.joinRoom(code);
      await player.act('set_ready', { ready: true });
    }

    await waitText(page, /4 онлайн/i);
    await delay(1000);
    await clickFirst(page, [/Начать раунд/i]);
    await delay(5500);
    const adStart = page.locator('.ad-break-modal .button.primary').first();
    if (await adStart.isVisible().catch(() => false)) await adStart.click();

    await waitText(page, /Перед стартом/i);
    await delay(1200);
    await Promise.all(guests.map((player) => player.act('bunker_accept_rules')));
    await clickFirst(page, [/Принять правила/i]);

    await waitText(page, /Личная карточка/i);
    await delay(1000);
    await Promise.all(guests.map(async (player) => {
      await player.revealRole();
      await player.act('role_seen');
    }));
    await clickFirst(page, [/Открыть персонажа/i]);
    await delay(1200);
    await clickFirst(page, [/Готов к обсуждению/i]);

    await waitText(page, /Докажите, что нужны убежищу/i);
    await delay(3500);
    await hostControl.act('start_vote');

    await waitText(page, /Кто не проходит в бункер/i);
    await delay(1200);
    await page.locator('.vote-list button').first().click();
    await Promise.all(guests.map((player) => {
      const target = guests.find((candidate) => candidate.id !== player.id)?.id || 'record-bunker-2';
      return player.act('vote', { targetId: target });
    }));

    await waitText(page, /Совет решил|Бункер закрывается/i);
    await delay(3500);

    const screenshotPath = path.join(OUT_DIR, 'bunker-mobile-final.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await context.close();
    await browser.close();
    browser = null;

    const videos = await Promise.all((await fs.readdir(OUT_DIR))
      .filter((file) => file.endsWith('.webm') && file !== 'bunker-mobile-gameplay.webm')
      .map(async (file) => ({ file, stat: await fs.stat(path.join(OUT_DIR, file)) })));
    const webm = videos.sort((left, right) => right.stat.mtimeMs - left.stat.mtimeMs)[0]?.file;
    if (!webm) throw new Error('Playwright did not write a video file');
    const videoPath = path.join(OUT_DIR, 'bunker-mobile-gameplay.webm');
    await fs.unlink(videoPath).catch(() => {});
    await fs.rename(path.join(OUT_DIR, webm), videoPath).catch(async () => {
      await fs.copyFile(path.join(OUT_DIR, webm), videoPath);
      await fs.unlink(path.join(OUT_DIR, webm)).catch(() => {});
    });
    await fs.writeFile(path.join(OUT_DIR, 'README.md'), [
      '# Bunker mobile gameplay recording',
      '',
      `Recorded from ${BASE_URL}/games/bunker at 390x844 mobile viewport.`,
      'Scenario: create room, join 3 virtual players, start Bunker, accept rules, reveal host card, discussion, vote, result.',
      '',
      '- Video: bunker-mobile-gameplay.webm',
      '- Final screenshot: bunker-mobile-final.png',
      '',
    ].join('\n'), 'utf8');

    console.log(videoPath);
  } catch (error) {
    if (browser) await browser.close().catch(() => {});
    await fs.writeFile(path.join(OUT_DIR, 'server-output.log'), serverOutput, 'utf8').catch(() => {});
    throw error;
  } finally {
    for (const player of players) player.disconnect();
    server.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
