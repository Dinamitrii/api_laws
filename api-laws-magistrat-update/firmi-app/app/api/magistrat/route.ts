import { env } from 'cloudflare:workers';
import { magistratPath } from '../../../lib/magistrat-request';
const json = (data: unknown, status = 200, extra: Record<string, string> = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...extra } });
export async function GET() { return json({ configured: Boolean(env.MAGISTRAT_API_KEY?.trim()) }); }
export async function POST(request: Request) {
  let body: Record<string, unknown>, path: string;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return json({ error: 'Невалидна заявка.' }, 400);
    body = parsed as Record<string, unknown>;
    path = magistratPath(body);
  } catch (error) { return json({ error: error instanceof SyntaxError ? 'Невалиден JSON в заявката.' : (error as Error).message }, 400); }
  const key = env.MAGISTRAT_API_KEY?.trim();
  if (!key) return json({ error: 'Липсва настроен ключ за Магистрат. Добави MAGISTRAT_API_KEY на сървъра.' }, 400);
  try {
    const response = await fetch('https://magistrat.bg' + path, { headers: { 'X-Api-Key': key, Accept: 'application/json' }, signal: AbortSignal.timeout(15000), redirect: 'manual' });
    const headers: Record<string, string> = {};
    for (const name of ['Retry-After', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']) { const value = response.headers.get(name); if (value) headers[name] = value; }
    if (!response.ok) {
      const messages: Record<number, string> = { 400: 'Невалидни параметри на справката.', 401: 'Ключът за Магистрат е невалиден.', 403: 'Ключът няма достъп до справката.', 404: 'Записът или регистърът не е намерен.', 429: 'Достигнат е лимитът на Магистрат. Опитай по-късно.' };
      const problem = await response.json().catch(() => null) as { code?: unknown } | null;
      return json({ error: messages[response.status] || 'Магистрат временно не отговаря.', code: typeof problem?.code === 'string' ? problem.code : undefined }, response.status >= 400 && response.status < 500 ? response.status : 502, headers);
    }
    const data: unknown = await response.json();
    if ((body.action ?? 'company') === 'company') {
      const uic = String(body.uic).trim().replace(/^BG/i, '');
      if (!data || typeof data !== 'object' || !('uic' in data) || data.uic !== uic) return json({ error: 'Магистрат върна неочаквана фирмена справка.' }, 502);
      return json({ company: data }, 200, headers);
    }
    if (!data || typeof data !== 'object') return json({ error: 'Магистрат върна неочакван отговор.' }, 502);
    return json(data, 200, headers);
  } catch (error) {
    const name = (error as Error).name;
    return json({ error: name === 'TimeoutError' || name === 'AbortError' ? 'Магистрат не отговори в рамките на 15 секунди.' : 'Неуспешна връзка или невалиден отговор от Магистрат.' }, 502);
  }
}
