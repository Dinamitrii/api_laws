# Поправка на llms.txt и ai-catalog.json

Разархивирай в api_laws. Не заменя страницата, Stripe интеграцията или текущата регистрация. Добавя само публичен отговор за четири точно определени адреса преди проверката за вход:
/llms.txt, /ai-catalog.json, /.well-known/ai-catalog.json, /.well-known/ard.json.

```bash
cd ~/PycharmProjects/api_laws/firmi-app
node scripts/install-discovery.mjs
npm run build
npx wrangler deploy --config dist/server/wrangler.json --name firmi
```

Отвори /llms.txt и /.well-known/ai-catalog.json без вход. Първият трябва да започва с # Фирмено досие; вторият с { и да има entries. Не трябва да се пренасочват към /auth. След това повтори Lighthouse. Ако Worker е с друго име, използвай обичайното си --name.

Проверка по желание:
```bash
curl -i https://firmi.predictorian.workers.dev/llms.txt
curl -i https://firmi.predictorian.workers.dev/.well-known/ai-catalog.json
node --test tests/public-discovery.test.mjs
```

Каталогът описва реален Markdown ресурс, без да обявява несъществуващ MCP или публичен API. Новият ARD адрес е ard.json, а ai-catalog.json е поддържан за съвместимост с проверката. llms.txt е описание, а не техническа забрана за обучение или заместител на robots.txt.
