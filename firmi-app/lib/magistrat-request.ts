type Body = Record<string, unknown>;
const segment = (value: unknown, label: string) => {
  if (typeof value !== 'string' || !value || value.length > 200 || value === '.' || value === '..' || /[\x00-\x1f/\\]/.test(value)) throw Error(`Невалиден ${label}.`);
  return encodeURIComponent(value);
};
export function magistratPath(body: Body): string {
  const action = body.action ?? 'company';
  if (action === 'case') return `/api/court/cases/${segment(body.id, 'идентификатор на дело')}`;
  if (action === 'courtAct') return `/api/court/cases/${segment(body.caseId, 'идентификатор на дело')}/acts/${segment(body.id, 'идентификатор на акт')}`;
  if (action === 'registries') return '/api/registries';
  if (action === 'search' || action === 'document') {
    if (typeof body.slug !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(body.slug)) throw Error('Невалиден регистър.');
    const base = `/api/${body.slug}/documents`;
    if (action === 'document') return `${base}/${segment(body.id, 'идентификатор')}`;
    const query = typeof body.query === 'string' ? body.query.trim() : '';
    if (query.length > 500) throw Error('Търсенето трябва да е до 500 символа.');
    const page = body.page ?? 1, pageSize = body.pageSize ?? 20;
    if (!Number.isInteger(page) || Number(page) < 1 || Number(page) > 2147483647 || !Number.isInteger(pageSize) || Number(pageSize) < 1 || Number(pageSize) > 100) throw Error('Невалидна страница или брой резултати.');
    const params = new URLSearchParams({ q: query, page: String(page), pageSize: String(pageSize) });
    for (const key of ['from', 'to']) {
      const value = body[key];
      if (value === undefined || value === '') continue;
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw Error('Невалидна дата.');
      params.set(key, value);
    }
    if (params.get('from') && params.get('to') && params.get('from')! > params.get('to')!) throw Error('Началната дата трябва да е преди крайната.');
    if (body.filters !== undefined) {
      if (!body.filters || typeof body.filters !== 'object' || Array.isArray(body.filters)) throw Error('Невалидни филтри.');
      const entries = Object.entries(body.filters);
      if (entries.length > 20) throw Error('Твърде много филтри.');
      for (const [key, value] of entries) {
        if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key) || ['q', 'page', 'pageSize', 'from', 'to'].includes(key) || typeof value !== 'string' || value.length > 200) throw Error('Невалиден филтър.');
        if (value) params.set(key, value);
      }
    }
    return `${base}?${params}`;
  }
  if (!['company', 'history', 'acts', 'act', 'cases'].includes(String(action))) throw Error('Непозната справка.');
  const uic = typeof body.uic === 'string' ? body.uic.trim().replace(/^BG/i, '') : '';
  if (!/^\d{9}$/.test(uic)) throw Error('Магистрат изисква ЕИК от точно 9 цифри.');
  if (action === 'cases') {
    const page = body.page ?? 1;
    if (!Number.isInteger(page) || Number(page) < 1 || Number(page) > 500) throw Error('Страницата за дела трябва да е между 1 и 500.');
    return `/api/court/companies/${uic}/cases?page=${page}`;
  }
  const base = `/api/tr/companies/${uic}`;
  if (action === 'act') return `${base}/acts/${segment(body.id, 'идентификатор на акт')}`;
  return action === 'company' ? base : `${base}/${action}`;
}
