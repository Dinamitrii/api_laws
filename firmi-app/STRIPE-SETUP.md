# Stripe за firmi-app

Еднократно плащане за безсрочен достъп до справките на регистрирания профил. Няма абонамент или кредити. Цената и валутата идват от Stripe Price. Платеният режим е изключен до изрично включване.

## Инсталация

Разархивирай в корена на api_laws. Инсталаторът добавя връзка „Плащания“ и свързва съществуващия accountGate, запазвайки текущата страница.

```bash
cd ~/PycharmProjects/api_laws/firmi-app
node scripts/install-stripe.mjs
node --test tests/account-auth.test.mjs tests/stripe-billing.test.mjs
npx tsc --noEmit --incremental false
npm run build
```

Изисква работещи AUTH_DB, регистрация, Turnstile и accountGate в build/sites-worker.ts. Използвай Worker `firmi` и production адреса `predictorian.online`.

## Настройване

В Stripe Sandbox създай продукт с еднократна цена (без recurring) и копирай price_... . Създай webhook destination със Snapshot payload за checkout.session.completed и checkout.session.async_payment_succeeded.

URL: https://predictorian.online/api/stripe/webhook

```bash
npx wrangler d1 execute predictorian-users --remote --config dist/server/wrangler.json --file migrations/0002_stripe.sql
npx wrangler secret put STRIPE_SECRET_KEY --config dist/server/wrangler.json --name firmi
npx wrangler secret put STRIPE_WEBHOOK_SECRET --config dist/server/wrangler.json --name firmi
npx wrangler secret put STRIPE_PRICE_ID --config dist/server/wrangler.json --name firmi
npx wrangler secret put STRIPE_APP_URL --config dist/server/wrangler.json --name firmi
npx wrangler deploy --config dist/server/wrangler.json --name firmi
```

Въведи съответно sk_test_..., whsec_..., price_... и https://predictorian.online . Не изпращай тайните в чат или Git. И публичните настройки са secrets тук, за да се запазват между build/deploy.

Влез с тестов профил, отвори /billing и направи Sandbox плащане с 4242 4242 4242 4242, бъдеща дата и произволен CVC. След връщане натисни „Провери плащането“. Провери отказ от Checkout и webhook delivery logs. Самото отваряне на success URL не активира достъп.

## Реални плащания

Използвай отделен тестов Worker и отделна AUTH_DB за Sandbox. Ако си тествал в реалната база, преди пускане провери и премахни само тестовите billing_orders след архивиране: иначе тестовите платени поръчки също дават достъп.

Замени ключа, Price и webhook secret със съответните Live стойности и създай Live Snapshot destination със същия URL и двата events. След успешна проверка включи платения режим:

```bash
npx wrangler secret put STRIPE_REQUIRE_PAYMENT --config dist/server/wrangler.json --name firmi
```

Въведи точно true. Неплатените профили вече се пренасочват към /billing, API връща 402. Това важи и за старите профили; няма администраторско изключение. За изключване въведи false със същата команда.

## Поведение и ограничения

Плащането се свързва с user_id. Webhook проверява HMAC-SHA256 върху суровото тяло и timestamp с толеранс 5 минути. Достъп се дава само при payment_status=paid и съвпадение с локална поръчка. Повторните доставки обновяват същия запис. При DB грешка връща 503 за повторна доставка.

Няма автоматично отнемане при refund/dispute, абонаменти, клиентски портал или възстановяване на парола. Възстановяванията са през Stripe; отнемането на достъп изисква отделна административна процедура. Няколко паралелни Checkout страници могат да доведат до повече от едно плащане; преглеждай дубликатите и ги възстановявай при нужда.

Преди продажби публикувай точните условия за достъп, контакт и възстановяване и попълни business данните в Stripe.

Проверени локално: TypeScript, вход/регистрация, подпис, CSRF, неплатени и чужди поръчки, успешно плащане и повторна доставка. Реално тестово плащане и deploy не са изпълнени; изискват Stripe/Cloudflare настройки.
