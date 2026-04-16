# Deno Deploy Proxy

## Локальный запуск

```bash
cd deno-proxy
deno run --allow-net --allow-env --allow-read server.ts
```

## Деплой на Deno Deploy

```bash
cd deno-proxy
deno deploy deploy
```

Или через GitHub:
1. Push код на GitHub
2. Подключить репозиторий к Deno Deploy

## Использование

```
http://localhost:3000/?h=example.com/path
```

Замените `localhost:3000` на ваш Deno Deploy URL после деплоя.

## API

- `GET /health` - проверка статуса
- `GET /?h=<domain>` - проксирование запроса

## Примеры

```bash
# Anthropic/Claude
curl "http://localhost:3000/?h=claude.ai"

# OpenAI
curl "http://localhost:3000/?h=api.openai.com/v1/chat/completions"

# GitHub
curl "http://localhost:3000/?h=api.github.com"
```
