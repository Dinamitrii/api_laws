# Безплатен администраторски достъп

Разархивирай в api_laws. Инсталаторът запазва текущите фирмени данни, Stripe и discovery поправките. Не са нужни нови SQL таблици. Панелът използва съществуващата таблица billing_orders.

```bash
cd ~/PycharmProjects/api_laws/firmi-app
node scripts/install-admin.mjs
npm run build
npx wrangler secret put ADMIN_USER_IDS --config dist/server/wrangler.json --name firmi
```

В prompt постави ID на твоя акаунт от изпратената Stripe заявка:

```
3e12b60a-219d-4bc9-beb5-baae2a668bfe
```

```bash
npx wrangler deploy --config dist/server/wrangler.json --name firmi
```

Влез със същия профил и отвори https://firmi.predictorian.workers.dev/admin . Профилът вече заобикаля изискването за плащане, дори STRIPE_REQUIRE_PAYMENT=true. /billing го пренасочва към /admin. Не се записва фиктивно плащане. Панелът показва общ брой профили, платени поръчки и последните 100 потребители. Само преглед; няма редактиране, изтриване или даване на роли от браузъра.

ADMIN_USER_IDS съдържа вътрешни ID, разделени със запетая. Само оператор с Cloudflare достъп може да задава администратори. За отнемане премахни ID чрез същата secret put команда. Не давай права по непотвърден имейл. Останалите потребители запазват съществуващите правила за плащане. ID от Stripe е идентификатор, а не парола: достъпът изисква и валидна сесия за този акаунт.

Тази промяна не поправя несъответствието recurring Price срещу еднократен Checkout. За обикновените клиенти използвай One-time Price, докато не е добавено пълно управление на абонаменти.
