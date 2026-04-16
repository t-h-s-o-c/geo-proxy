# GeoProxy - Геоблок-прокси для браузера

Прозрачный прокси для обхода геоблокировки в РФ (Claude, OpenAI, Google, Ollama, GitHub и др.)

## Быстрый старт

### 1. Запуск через Docker (рекомендуется)

```bash
# Создайте файл .env с токеном Cloudflare Tunnel
echo "CLOUDFLARE_TUNNEL_TOKEN=cfk_YOUR_TOKEN" > .env

# Запуск
docker-compose up -d
```

### 2. Или запуск вручную

**Proxy Server:**
```bash
cd proxy-server
npm install
npm start
```

**Cloudflare Tunnel:**
```bash
# Установите cloudflared
winget install Cloudflare.cloudflared

# Запуск туннеля
cloudflared tunnel run --token cfk_YOUR_TOKEN
```

### 3. Установка Chrome Extension

1. Откройте `chrome://extensions/`
2. Включите **Режим разработчика**
3. Нажмите **Загрузить распакованное расширение**
4. Выберите папку `extension/`

## Использование

### Popup (иконка расширения)

- Статус прокси (Active/Inactive)
- Текущий домен и его статус
- Кнопка "Add to Proxy" для добавления текущего сайта
- Статистика

### Редактор доменов

Откройте через popup или напрямую откройте файл `extension/editor/editor.html`

Функции:
- Поиск и фильтрация доменов
- Добавление/удаление доменов
- Включение/выключение доменов
- Импорт/экспорт списка
- Быстрые пресеты (AI Services, GitHub, All Common)

## Архитектура

```
Browser → PAC File → Proxy (127.0.0.1:3128) → Cloudflare Tunnel → Internet
```

### PAC (Proxy Auto-Config)

PAC-файл определяет какие домены идут через прокси, а какие напрямую:

```javascript
function FindProxyForURL(url, host) {
  if (shExpMatch(host, "*claude.ai")) return "PROXY 127.0.0.1:3128";
  if (shExpMatch(host, "*openai.com")) return "PROXY 127.0.0.1:3128";
  return "DIRECT";
}
```

### Дефолтные домены

- Claude AI, OpenAI, Google AI, Ollama, Hugging Face
- GitHub, GitHub API, GitHub Raw
- Cohere, Mistral, Groq, Together AI, Perplexity, OpenRouter

## API

Расширение управляется через chrome.storage.local и chrome.runtime.sendMessage:

```javascript
chrome.runtime.sendMessage({ type: 'GET_DOMAINS' });
chrome.runtime.sendMessage({ type: 'ADD_DOMAIN', pattern: 'example.com' });
chrome.runtime.sendMessage({ type: 'REMOVE_DOMAIN', pattern: 'example.com' });
chrome.runtime.sendMessage({ type: 'TOGGLE_DOMAIN', pattern: 'example.com' });
chrome.runtime.sendMessage({ type: 'GET_STATUS' });
chrome.runtime.sendMessage({ type: 'IMPORT_DOMAINS', domains: [...] });
```

## Troubleshooting

### PAC не работает
1. Перезагрузите расширение в `chrome://extensions/`
2. Проверьте что proxy server запущен: `netstat -an | findstr 3128`

### Tunnel не подключается
1. Проверьте токен туннеля
2. Убедитесь что порт 7844 открыт для исходящих соединений

### SSL ошибки
Cloudflare Tunnel автоматически терминирует SSL. Убедитесь что proxy-сервер доверяет Cloudflare сертификатам.
