import http from 'node:http';
import { URL } from 'node:url';
import httpProxy from 'http-proxy';

const PANEL_PORT = Number(process.env.DEVICE_LAB_PANEL_PORT || 4200);
const DEVICE_PORT_START = Number(process.env.DEVICE_LAB_DEVICE_PORT_START || 4211);
const DEVICE_COUNT = Number(process.env.DEVICE_LAB_DEVICE_COUNT || 8);
const target = new URL(process.argv[2] || 'http://127.0.0.1:5173');
const proxy = httpProxy.createProxyServer({
  target: target.origin,
  changeOrigin: true,
  secure: true,
  ws: true,
});

proxy.on('error', (error, _request, response) => {
  if (response?.writeHead) {
    response.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(`Device Lab cannot reach ${target.origin}\n${error.message}`);
  }
});

for (let index = 0; index < DEVICE_COUNT; index += 1) {
  const port = DEVICE_PORT_START + index;
  const server = http.createServer((request, response) => proxy.web(request, response));
  server.on('upgrade', (request, socket, head) => proxy.ws(request, socket, head));
  server.listen(port, '127.0.0.1');
}

const panel = http.createServer((_request, response) => {
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(renderPanel());
});

panel.listen(PANEL_PORT, '127.0.0.1', () => {
  console.log(`Device Lab: http://127.0.0.1:${PANEL_PORT}`);
  console.log(`Target: ${target.origin}`);
});

function renderPanel() {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GameHubParty Device Lab</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #eceef1; color: #18181b; font: 14px system-ui, sans-serif; }
    header { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; align-items: end; gap: 10px; padding: 12px; border-bottom: 1px solid #d2d4d9; background: #fff; }
    header strong { margin-right: auto; font-size: 16px; }
    label { display: grid; gap: 3px; color: #62626b; font-size: 11px; }
    input, select, button { min-height: 38px; border: 1px solid #d2d4d9; border-radius: 8px; background: #fff; padding: 0 10px; font: inherit; }
    input { width: 230px; }
    button { cursor: pointer; font-weight: 650; }
    .help { margin: 10px 12px 0; padding: 10px 12px; border-radius: 9px; background: #fff; color: #62626b; font-size: 12px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, 390px); align-items: start; gap: 14px; padding: 12px; }
    .phone { overflow: hidden; width: 390px; border: 1px solid #c9cbd1; border-radius: 14px; background: #fff; box-shadow: 0 7px 22px #18181b16; }
    .bar { height: 40px; display: flex; align-items: center; justify-content: space-between; padding: 0 9px; border-bottom: 1px solid #e3e4e7; background: #fafafa; font-size: 11px; font-weight: 700; }
    .bar button { min-height: 27px; padding: 0 8px; font-size: 10px; }
    iframe { display: block; width: 390px; height: 844px; border: 0; background: #fff; }
    body.compact .grid { grid-template-columns: repeat(auto-fill, 292px); }
    body.compact .phone { width: 292px; }
    body.compact iframe { transform: scale(.75); transform-origin: top left; margin-bottom: -211px; }
  </style>
</head>
<body>
  <header>
    <strong>GameHubParty Device Lab</strong>
    <label>Устройств
      <select id="count">${Array.from({ length: DEVICE_COUNT - 1 }, (_, index) => `<option value="${index + 2}" ${index === 1 ? 'selected' : ''}>${index + 2}</option>`).join('')}</select>
    </label>
    <label>Путь на сайте
      <input id="path" value="/" placeholder="/">
    </label>
    <button id="open">Открыть на всех</button>
    <button id="reload">Обновить все</button>
    <button id="compact">Уместить больше</button>
  </header>
  <div class="help">Каждый телефон имеет отдельный origin и отдельные localStorage/cookies. Это независимые пользователи без тестового кода внутри сайта. Цель: ${target.origin}</div>
  <main class="grid" id="grid"></main>
  <script>
    const count = document.querySelector('#count');
    const path = document.querySelector('#path');
    const grid = document.querySelector('#grid');
    const ports = Array.from({ length: ${DEVICE_COUNT} }, (_, index) => ${DEVICE_PORT_START} + index);

    function normalizedPath() {
      const value = path.value.trim() || '/';
      return value.startsWith('/') ? value : '/' + value;
    }

    function render() {
      const amount = Number(count.value);
      grid.innerHTML = '';
      ports.slice(0, amount).forEach((port, index) => {
        const phone = document.createElement('article');
        phone.className = 'phone';
        phone.innerHTML = '<div class="bar"><span>Телефон ' + (index + 1) + ' · :' + port + '</span><button>Перезагрузить</button></div><iframe title="Телефон ' + (index + 1) + '"></iframe>';
        const frame = phone.querySelector('iframe');
        frame.src = 'http://127.0.0.1:' + port + normalizedPath();
        phone.querySelector('button').onclick = () => frame.src = frame.src;
        grid.appendChild(phone);
      });
    }

    function navigateAll() {
      [...grid.querySelectorAll('iframe')].forEach((frame, index) => {
        frame.src = 'http://127.0.0.1:' + ports[index] + normalizedPath();
      });
    }

    count.onchange = render;
    document.querySelector('#open').onclick = navigateAll;
    document.querySelector('#reload').onclick = () => [...grid.querySelectorAll('iframe')].forEach(frame => frame.src = frame.src);
    document.querySelector('#compact').onclick = () => document.body.classList.toggle('compact');
    path.onkeydown = event => { if (event.key === 'Enter') navigateAll(); };
    render();
  </script>
</body>
</html>`;
}
