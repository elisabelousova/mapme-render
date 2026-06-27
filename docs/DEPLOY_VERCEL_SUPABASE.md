# Deploy MapMe на Vercel + Supabase

## Почему так

Vercel подходит для Telegram webhook: функция запускается только на входящий запрос. Supabase хранит пользователей и места, потому что файловая система serverless не подходит для постоянных данных.

## 1. Supabase

1. Создать проект в Supabase.
2. Открыть SQL Editor.
3. Выполнить SQL из `docs/SUPABASE_SCHEMA.sql`.
4. Открыть Project Settings → API.
5. Скопировать:
   - Project URL → `SUPABASE_URL`;
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY`.

`service_role` нельзя публиковать во frontend. Он хранится только в Vercel Environment Variables.

## 2. Vercel

1. New Project.
2. Import GitHub repo `elisabelousova/mapme-render`.
3. Framework Preset: Other.
4. Build Command: оставить пустым или `npm run check`.
5. Output Directory: оставить пустым.
6. Deploy.

## 3. Environment Variables в Vercel

Обязательные:

```text
BOT_TOKEN=новый токен из BotFather
WEBAPP_URL=https://your-vercel-project.vercel.app
TELEGRAM_WEBHOOK_SECRET=длинная случайная строка
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=service_role_key
```

Для AI/OCR:

```text
OPENAI_API_KEY=ключ OpenAI
OPENAI_MODEL=gpt-4.1-mini
```

После изменения env-переменных нужно сделать Redeploy.

## 4. Telegram webhook

После деплоя webhook URL будет:

```text
https://your-vercel-project.vercel.app/api/telegram/webhook/TELEGRAM_WEBHOOK_SECRET
```

Самый простой способ зарегистрировать webhook — открыть:

```text
https://your-vercel-project.vercel.app/api/admin/set-webhook/TELEGRAM_WEBHOOK_SECRET
```

Ожидаемый ответ:

```json
{"ok":true}
```

Альтернативно можно через Telegram Bot API:

```text
https://api.telegram.org/botBOT_TOKEN/setWebhook?url=https%3A%2F%2Fyour-vercel-project.vercel.app%2Fapi%2Ftelegram%2Fwebhook%2FTELEGRAM_WEBHOOK_SECRET&allowed_updates=%5B%22message%22%5D
```

Или через `curl`:

```bash
curl -X POST "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://your-vercel-project.vercel.app/api/telegram/webhook/TELEGRAM_WEBHOOK_SECRET","allowed_updates":["message"]}'
```

## 5. Проверки

Health:

```text
https://your-vercel-project.vercel.app/api/health
```

Ожидаемый ответ:

```json
{"ok":true}
```

После `/start` в Telegram бот должен прислать личную ссылку:

```text
https://your-vercel-project.vercel.app/u/...
```
