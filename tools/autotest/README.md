# GameHubParty Autotest

Автотест запускает production-сборку сайта, проверяет публичные страницы и играет в игры через независимых виртуальных игроков.

## Запуск

```powershell
npm run test:auto
```

Проверка тестового сервера:

```powershell
npm run test:auto:test-server
```

Результат сохраняется в `artifacts/autotest-report.json`.

## Добавление новой игры

1. Создать сценарий в `tools/autotest/scenarios`.
2. Использовать `runner.player(id, name)` для независимых игроков.
3. Описать действия игры через `player.act(event, payload)`.
4. Добавить сценарий в `tools/autotest/run.mjs`.

Каждый сценарий должен проверять создание комнаты, подключение игроков, все роли, основные победные условия и возврат в лобби.
