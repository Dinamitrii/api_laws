/** Public metadata only; no account data or authenticated API responses. */
export function publicDiscovery(request: Request): Response | null {
  const url = new URL(request.url);
  const paths = ['/llms.txt', '/ai-catalog.json', '/.well-known/ai-catalog.json', '/.well-known/ard.json'];
  if (!paths.includes(url.pathname)) return null;
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, {status:405,headers:{Allow:'GET, HEAD'}});
  const markdown = `# Фирмено досие\n\n> Уеб приложение за фирмени справки и попълване на документи.\n\nСправките изискват потребителски профил и приложимите права за достъп. Данните от външни източници трябва да се проверяват преди употреба.\n\n## Страници\n\n- [Начална страница](${url.origin}/): Работно пространство за фирмени справки и документи; изисква вход.\n- [Вход и регистрация](${url.origin}/auth): Достъп до потребителски профил.\n- [Каталог на публичните ресурси](${url.origin}/.well-known/ard.json): Машинно четим каталог.\n\n## Достъп\n\nНе заобикаляйте удостоверяването и ограниченията за достъп. Не публикувайте данни от потребителски профили или платежни сесии. Този файл описва сайта; не предоставя разрешение за обучение върху защитено съдържание.\n`;
  // No public callable agent or skill is currently offered by this application.
  const catalog = {
    specVersion: '1.0',
    host: { displayName: 'Фирмено досие · Вестерос БГ ЕООД' },
    entries: [],
  };
  const text = url.pathname === '/llms.txt';
  return new Response(request.method === 'HEAD' ? null : text ? markdown : JSON.stringify(catalog,null,2)+'\n', {headers:{
    'Content-Type':text?'text/plain; charset=utf-8':'application/json; charset=utf-8',
    'Cache-Control':'public, max-age=300', 'X-Content-Type-Options':'nosniff',
  }});
}
