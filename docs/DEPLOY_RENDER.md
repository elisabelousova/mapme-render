# Deploy на Render

## Почему Render

Для MVP нужен web service, а не статический сайт: один Node-процесс принимает Telegram webhook и отдаёт личные карты.

## Важное про токен

Перед публичным деплоем лучше перевыпустить токен в `@BotFather`, потому что старый токен уже был отправлен в чат.

## Подготовка репозитория

Самый простой вариант: создать отдельный GitHub-репозиторий только из папки `saved-places-bot`.

В репозиторий нельзя добавлять:

- `.env`;
- `data/store.json`;
- `data/store.json.tmp`.

Они уже закрыты через `.gitignore`.

## Создание сервиса

1. Открыть Render Dashboard.
2. New → Web Service.
3. Подключить GitHub-репозиторий с `saved-places-bot`.
4. Если Render видит `render.yaml`, можно создать сервис из Blueprint.
5. Если настраивать руками:
   - Runtime: Node;
   - Build Command: `npm install`;
   - Start Command: `npm start`;
   - Instance Type: Free для теста.

## Environment variables

Обязательные:

```text
BOT_TOKEN=новый токен из BotFather
HOST=0.0.0.0
RUN_BOT=true
TELEGRAM_MODE=webhook
DATA_FILE=./data/store.json
WEBAPP_URL=https://your-service-name.onrender.com
```

Опционально:

```text
TELEGRAM_WEBHOOK_SECRET=любая длинная случайная строка
OPENAI_API_KEY=ключ OpenAI для AI-распознавания Instagram caption и OCR по скринам
OPENAI_MODEL=gpt-4.1-mini
```

Если `TELEGRAM_WEBHOOK_SECRET` не задан, приложение само сделает секретный webhook-путь из токена.

## Порядок первого деплоя

1. Создать сервис с временным `WEBAPP_URL=https://example.com`.
2. Дождаться, пока Render покажет настоящий URL сервиса.
3. Заменить `WEBAPP_URL` на настоящий URL.
4. Redeploy.
5. Написать боту `/start`.

После redeploy приложение само вызовет Telegram `setWebhook`.

## Ограничения MVP

На бесплатном Render-хостинге сервис может засыпать. Webhook-режим лучше long polling, потому что входящее сообщение от Telegram будит web service, но первый ответ после сна может быть медленнее.

Локальный JSON-файл подходит для теста, но для реальных пользователей нужна база данных или persistent disk. Иначе данные могут потеряться при redeploy или переносе сервиса.

## Smoke test

После деплоя открыть:

```text
https://your-service-name.onrender.com/api/health
```

Ожидаемый ответ:

```json
{"ok":true}
```
