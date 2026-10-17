# Отворена регистрация за Predictorian

## 1. Копиране

Разархивирай съдържанието в `~/PycharmProjects/api_laws/firmi-app`.
Файловете са добавки; пакетът не заменя твоя package.json или бизнес страницата.
След това:

```bash
cd ~/PycharmProjects/api_laws/firmi-app
node scripts/install-accounts.mjs
```

Инсталаторът добавя проверка в съществуващия Worker, бутон „Профил / Изход“
и автоматична настройка след всеки build. При различен Worker спира с грешка,
за да не презапише персонални промени. Прегледай промените с `git diff`.

## 2. База за потребителите

```bash
npx wrangler d1 create predictorian-users
```

Ако Wrangler предлага да редактира конфигурацията автоматично, избери No —
следващата стъпка я настройва постоянно. Копирай получения `database_id`.
Ако такава база вече съществува, вземи нейния ID от `npx wrangler d1 list`.

## 3. Turnstile срещу ботове

В https://dash.cloudflare.com/ отвори Turnstile → Add widget.
Име: Predictorian. Hostname: `predictorian.predictorian.workers.dev`
(без https:// и без път). Избери Managed.
При друг домейн добави точния hostname и него.

Копирай Site key и Secret key. Site key е публичен, Secret key е таен.
Не изпращай Secret key в чат и не го записвай в Git.

## 4. Постоянни настройки и build

Замени двете стойности със своите, без ъглови скоби:

```bash
node scripts/prepare-account-deploy.mjs ТВОЯТ_DATABASE_ID ТВОЯТ_SITE_KEY
npm run build
```

Настройките се пазят в `predictorian-auth.json` (само публични ID).
След всеки build скриптът настройва AUTH_DB, Turnstile Site key, името
predictorian, твоя съществуващ KV ID и премахва неподдържания legacy_env.
Задава и assets.run_worker_first=true, за да не заобикалят статичните HTML
страници проверката за вход. Запази файла и postbuild скрипта в Git.

## 5. Таблици и тайни

```bash
npx wrangler d1 execute predictorian-users --remote --config dist/server/wrangler.json --file migrations/0001_accounts.sql
npx wrangler secret put TURNSTILE_SECRET_KEY --config dist/server/wrangler.json --name predictorian
```

На последната команда постави Secret key от Turnstile в интерактивния prompt.
После създай случаен сървърен ключ за защита на паролите:

```bash
openssl rand -hex 32 | npx wrangler secret put AUTH_PEPPER --config dist/server/wrangler.json --name predictorian
```

Не сменяй AUTH_PEPPER след започване на регистрациите — съществуващите пароли
няма да могат да бъдат проверявани. Запази го в мениджъра си за тайни, ако
имаш нужда от възстановяване на цялата среда. D1 данните също изискват backup.

## 6. Деплой

```bash
npx wrangler deploy --config dist/server/wrangler.json --name predictorian
```

При следващи промени е достатъчно `npm run deploy:predictorian`.

Отвори https://predictorian.predictorian.workers.dev — трябва да се отвори
страницата за вход. Избери Регистрация и създай профил. Провери справките,
излез през „Профил / Изход“ и потвърди, че справките вече изискват вход.
В инкогнито директна заявка към /api/companybook трябва да върне 401.

## Какво включва

- Отворена регистрация с имейл и парола от 12 до 128 символа; автоматичен вход.
- Turnstile при регистрация И вход; сървърна проверка на success, hostname и action.
  При липсващи ключове или неуспешна проверка достъпът се отказва.
- D1 акаунти; PBKDF2-SHA512 (100 000 итерации), уникална сол и отделна HMAC тайна.
- Случайни 256-битови сесии с валидност 7 дни; в базата се пази само SHA-256
  отпечатъкът. Cookie: __Host-, Secure, HttpOnly, SameSite=Lax. Изходът отнема сесията.
- Атомарни броячи в D1: до 5 регистрации / IP / 15 минути,
  до 20 входа / IP / 15 минути и общо 10 опита / имейл / 15 минути.
- Проверка на Origin, honeypot поле, лимит на заявките, параметризирани SQL заявки.
- Защитени страници и API, независимо от състоянието на браузърния интерфейс.

Никоя проверка не гарантира нула ботове. Това е начална версия без потвърждение
на имейл, забравена парола, администраторски роли и индивидуални квоти за справки.
Притежанието на имейла не е доказано. Не използвай непотвърдения адрес за достъп
до чужди фирмени или лични данни. Потребителските данни в текущата бизнес страница
остават в паметта на браузъра както досега.

## Проверки

Тестовете изискват Node.js 22.13+ с node:sqlite и наличния esbuild:

```bash
node --test tests/account-auth.test.mjs
npx tsc --noEmit --incremental false
```

Покрити са пароли, блокирана регистрация при неуспешен Turnstile,
погрешен hostname, CSRF Origin, сесия, изтекла сесия, изход, лимит на опитите
и отказ при липсваща конфигурация. SQL тестовете използват SQLite;
реалните D1 и Turnstile трябва да се проверят след настройката в Cloudflare.
