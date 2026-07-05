import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

async function waitFor(url, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

test('device lab serves panel and independent proxy origins', { timeout: 15000 }, async () => {
  const appPort = 3310;
  const panelPort = 4310;
  const devicePortStart = 4321;
  const app = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(appPort), NODE_ENV: 'production', REDIS_URL: '' },
    stdio: 'ignore',
  });
  const lab = spawn(process.execPath, ['tools/device-lab/server.mjs', `http://127.0.0.1:${appPort}`], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DEVICE_LAB_PANEL_PORT: String(panelPort),
      DEVICE_LAB_DEVICE_PORT_START: String(devicePortStart),
      DEVICE_LAB_DEVICE_COUNT: '2',
    },
    stdio: 'ignore',
  });
  try {
    await waitFor(`http://127.0.0.1:${appPort}/api/health`);
    assert.equal((await waitFor(`http://127.0.0.1:${panelPort}`)).status, 200);
    assert.equal((await waitFor(`http://127.0.0.1:${devicePortStart}/api/health`)).status, 200);
    assert.equal((await waitFor(`http://127.0.0.1:${devicePortStart + 1}/api/health`)).status, 200);
    assert.notEqual(new URL(`http://127.0.0.1:${devicePortStart}`).origin, new URL(`http://127.0.0.1:${devicePortStart + 1}`).origin);
  } finally {
    lab.kill();
    app.kill();
  }
});
