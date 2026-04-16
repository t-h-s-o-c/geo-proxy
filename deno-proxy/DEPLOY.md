# Деплой на Deno Deploy

## Вариант 1: GitHub Actions (рекомендуется)

1. Создайте репозиторий на GitHub
2. Запушьте код (включая `.github/workflows/deploy.yml`)
3. В репозитории: Settings → Secrets → Actions → New secret
   - Name: `DENO_DEPLOY_TOKEN`
   - Secret: `ddo_c7T80MJxVUvc6VedVMoo4StT2V0E3041ji4r`
4. Пушите на ветку `main`
5. Deploy запустится автоматически

## Вариант 2: Через браузер

1. Зайдите на https://dash.deno.com
2. Войдите через GitHub
3. New Project → "Deploy from local folder"
4. Выберите папку `deno-proxy` из этого проекта
5. Скопируйте токен и добавьте его

## Вариант 3: Исправление Windows CLI

Проблема: Deno CLI на Windows не работает с путями через кириллицу.

Решение:
```powershell
# Скопировать в папку без кириллицы
Copy-Item -Recurse -Path ".\deno-proxy" -Destination "C:\temp\geo"
cd C:\temp\geo
deno deploy deploy --token=ddo_c7T80MJxVUvc6VedVMoo4StT2V0E3041ji4r --app=geo-proxy-rf
```

## После деплоя

URL будет: `https://geo-proxy-rf-rrtnrdjztkjv.t-h-s-o-c.deno.net`

Проверка:
```bash
curl "https://geo-proxy-rf-rrtnrdjztkjv.t-h-s-o-c.deno.net/health"
```

## Использование с расширением

1. Пересоберите/обновите расширение в Chrome
2. Откройте `chrome://extensions`
3. Нажмите "Обновить"
4. Расширение теперь проксирует трафик через Deno Deploy
