# GameHubParty

Текущая версия: `v0.3.26` — расширения Alias и Бункера.

GameHubParty — мобильный web-сервис для быстрых игр в компании. На desktop интерфейс должен оставаться в центре как телефонное приложение, а не растягиваться на всю ширину браузера.

## Что уже есть

- Игры: Шпион, Alias, Бункер.
- Комнаты по коду и QR, роли, таймеры, голосования, результаты раундов.
- Профиль игрока, email-вход, покупки, история заказов и доступов.
- Магазин: WeekendPass, Game Pass для отдельных игр, PRO, тема PartyHub.
- YooKassa: создание платежа, возврат на сайт, webhook, проверка суммы и автоматическая выдача доступа.
- Админка по `/admin`: комнаты, заказы, игроки, выдача/отзыв доступов.
- Публичные страницы: контакты, оферта, политика, возвраты.

## Рабочая папка

```text
C:\Users\axilb\OneDrive\Рабочий стол\PROGS\GameHubParty
```

Главный паспорт проекта: `PROJECT_STATE.md`.

Финансовая модель: `FINANCE.md`.

Юридические риски и чеклист: `LEGAL.md`.

Инструкция по YooKassa: `YOOKASSA.md`.

## Проверки

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run test:auto
```

## Локальная очистка

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\cleanup-local.ps1 -WhatIf
powershell -ExecutionPolicy Bypass -File .\tools\cleanup-local.ps1
```

Скрипт удаляет только локальный системный мусор, npm-cache и старые временные артефакты внутри этой папки проекта.

## Деплой

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1 -KeyPath ".deploy-keys\gamehubparty_deploy"
```

`deploy.ps1` сам запускает сборку и тесты перед отправкой на сервер.

## Визуальная приемка

После визуальных правок проверять мобильный viewport около `390px`: главная, магазин, профиль, лобби, карточка роли, обсуждение, голосование, результат. Важно: без горизонтального скролла и без битого текста.

Новые релизные скриншоты складывать в `public/demo/screenshots/...` с `README.md` внутри папки.
