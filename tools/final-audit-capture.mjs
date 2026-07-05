import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = (process.env.AUDIT_BASE_URL || process.argv[2] || 'http://127.0.0.1:4173').replace(/\/$/, '');
const auditDir = path.resolve(process.env.AUDIT_DIR || 'outputs/final-release-audit-2026-07-02');
const chromePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const routes = [
  ['01-home', '/'],
  ['02-store', '/store'],
  ['03-profile', '/profile'],
  ['04-spy', '/games/spy'],
  ['05-alias', '/games/alias'],
  ['06-bunker', '/games/bunker'],
  ['07-demo', '/demo'],
  ['08-contacts', '/contacts'],
  ['09-refund', '/refund'],
  ['10-terms', '/terms'],
  ['11-privacy', '/privacy'],
];

const badPatterns = [
  /\u0420\u045f/,
  /\u0420\u045e/,
  /\u0420\u045c/,
  /\u0420\u045a/,
  /\u0420\u2019/,
  /\u0420\u00b0/,
  /\u0420\u00b5/,
  /\u0421\u0453/,
  /\u0421\u201a/,
  /\u0432\u201a/,
  /\u0432\u20ac/,
  /\ufffd/,
  /реальный провайдер следующим этапом/i,
  /оплата[^\n]{0,80}пауз/i,
  /подключением платежей/i,
  /Подтвердить заказ/i,
  /Когда появятся реальные оплаты/i,
  /будущей VK-версии/i,
  /Lorem|ipsum/i,
];

await fs.mkdir(auditDir, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: chromePath });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const results = [];

for (const [name, route] of routes) {
  const url = `${baseUrl}${route}`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(700);
  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    return {
      title: document.title,
      text: body.innerText || '',
      scrollWidth: Math.max(root.scrollWidth, body.scrollWidth),
      clientWidth: root.clientWidth,
      height: Math.max(root.scrollHeight, body.scrollHeight),
    };
  });
  const screenshot = path.join(auditDir, `${name}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  const stat = await fs.stat(screenshot);
  const badTextHits = badPatterns.flatMap((pattern) => {
    const match = metrics.text.match(pattern);
    return match ? [match[0]] : [];
  });
  results.push({
    name,
    route,
    title: metrics.title,
    screenshot,
    bytes: stat.size,
    horizontalOverflow: metrics.scrollWidth > metrics.clientWidth + 1,
    scrollWidth: metrics.scrollWidth,
    clientWidth: metrics.clientWidth,
    badTextHits,
  });
}

await browser.close();

const lines = [
  '# Final Release Visual Audit',
  '',
  'Date: 2026-07-02',
  'Viewport: 390x844 mobile',
  '',
  '## Steps',
  '',
];

for (const item of results) {
  const health = !item.horizontalOverflow && item.badTextHits.length === 0 && item.bytes > 5000 ? 'OK' : 'Needs review';
  lines.push(`- ${item.name} ${item.route}: ${health}`);
  lines.push(`  - screenshot: ${path.relative(process.cwd(), item.screenshot).replaceAll('\\', '/')}`);
  lines.push(`  - width: ${item.clientWidth}/${item.scrollWidth}; bad text hits: ${item.badTextHits.length ? item.badTextHits.join(', ') : 'none'}`);
}

await fs.writeFile(path.join(auditDir, 'README.md'), `${lines.join('\n')}\n`, 'utf8');

console.log(JSON.stringify({ auditDir, results }, null, 2));
