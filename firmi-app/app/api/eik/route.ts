import { env } from 'cloudflare:workers';
import { sessionUserId } from '../../../lib/account-auth';
import { getCompany, searchCompanies } from '../../../lib/eik';

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(request: Request) {
  const db = env.AUTH_DB?.withSession('first-primary');
  if (!db) return json({ error: 'Базата данни временно не е достъпна.' }, 503);
  try {
    const userId = await sessionUserId(request, db);
    if (!userId) return json({ available: false });
    return json({ available: true });
  } catch {
    return json({ error: 'Неуспешна проверка на състоянието.' }, 503);
  }
}

export async function POST(request: Request) {
  const db = env.AUTH_DB?.withSession('first-primary');
  if (!db) return json({ error: 'Базата данни временно не е достъпна.' }, 503);
  let body: Record<string, unknown>;
  try {
    const parsed = await request.json() as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return json({ error: 'Невалидна заявка.' }, 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: 'Невалиден JSON в заявката.' }, 400);
  }
  try {
    const userId = await sessionUserId(request, db);
    if (!userId) return json({ error: 'Влез в профила си, за да използваш eik.bg.' }, 401);
    if (body.action === 'search') {
      const query = typeof body.query === 'string' ? body.query.trim() : '';
      if (query.length < 2 || query.length > 160) return json({ error: 'Въведи между 2 и 160 символа.' }, 400);
      return json({ results: await searchCompanies(query) });
    }
    if (body.action === 'detail') {
      const eik = typeof body.eik === 'string' ? body.eik.trim().replace(/^BG/i, '') : '';
      if (!/^\d{9}$/.test(eik)) return json({ error: 'ЕИК трябва да е от точно 9 цифри.' }, 400);
      return json({ company: await getCompany(eik) });
    }
    return json({ error: 'Непозната справка.' }, 400);
  } catch (error) {
    return json({ error: (error as Error).message || 'Неуспешна справка в eik.bg.' }, 502);
  }
}