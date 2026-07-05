import { spawn } from 'node:child_process';

export async function waitForServer(baseUrl, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not become ready: ${baseUrl}`);
}

export async function startLocalServer(port) {
  const processHandle = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), NODE_ENV: 'production', REDIS_URL: '', AUTH_TEST_CODE: '111111', ALLOW_DEMO_CHECKOUT: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForServer(baseUrl);
  return { baseUrl, stop: () => processHandle.kill() };
}
