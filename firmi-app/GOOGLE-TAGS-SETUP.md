# Google Search Console и Google Analytics

## Search Console

Search Console вече се потвърждава чрез публичния файл:

`https://predictorian.online/googlef65d0e60ad506076.html`

В Search Console добави property за `https://predictorian.online/` и избери
потвърждение чрез HTML файла. След потвърждението изпрати sitemap:

`https://predictorian.online/sitemap.xml`

Този verification файл не съдържа секрет и е нормално да бъде публичен.

## Google Analytics 4

1. В Google Analytics отвори **Admin → Data streams → Web**.
2. Създай stream за `https://predictorian.online` или отвори съществуващия.
3. Копирай Measurement ID, който започва с `G-`.
4. Добави го локално в `.env.local`:

```env
GOOGLE_ANALYTICS_GTAG=G-XXXXXXXXXX
```

Стойността е публичен Measurement ID, не secret. Не добавяй API keys,
service-account JSON или Stripe/Turnstile secrets в клиентския код.

След това deploy-ът е:

```bash
npm run deploy:firmi
```

Ако `GOOGLE_ANALYTICS_GTAG` липсва или не е във формат `G-...`, tag-ът не се
рендерира. Това позволява build без Analytics за локални или тестови среди.
