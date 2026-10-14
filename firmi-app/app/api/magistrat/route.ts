import { env } from 'cloudflare:workers';

const json = (data: object, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET() {
  return json({ configured: Boolean(env.MAGISTRAT_API_KEY?.trim()) });
}
export async function POST(request: Request) {
  try {
    const body = await request.json() as { uic?: unknown } | null;
    const uic = typeof body?.uic === 'string' ? body.uic.trim().replace(/^BG/i, '') : '';
    if (!/^\d{9}$/.test(uic)) return json({ error: 'Магистрат изисква ЕИК от точно 9 цифри.' }, 400);
    const key = env.MAGISTRAT_API_KEY?.trim();
    if (!key) return json({ error: 'Липсва настроен ключ за Магистрат. Добави го в API настройките на сървъра.' }, 400);
    const response = await fetch(`https://magistrat.bg/api/tr/companies/${uic}`, {
      headers: { 'X-Api-Key': key, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000), redirect: 'manual',
    });
    if (!response.ok) {
      const messages: Record<number, string> = {
        401: 'Ключът за Магистрат е невалиден.', 403: 'Ключът за Магистрат няма достъп до тази справка.',
        404: 'Фирмата не е намерена в Магистрат.', 429: 'Достигнат е лимитът на Магистрат. Опитай по-късно.',
      };
      return json({ error: messages[response.status] || 'Магистрат временно не отговаря.' }, response.status >= 400 && response.status < 500 ? response.status : 502);
    }
    const company = await response.json() as Record<string, unknown>;
    if (!company || company.uic !== uic) return json({ error: 'Магистрат върна неочаквана фирмена справка.' }, 502);
    return json({ company });
  } catch (error) {
    const name = (error as Error).name;
    if (name === 'SyntaxError') return json({ error: 'Невалиден JSON в заявката или отговора на Магистрат.' }, 400);
    return json({ error: name === 'TimeoutError' || name === 'AbortError' ? 'Магистрат не отговори в рамките на 15 секунди.' : 'Неуспешна връзка с Магистрат.' }, 502);
  }
}
