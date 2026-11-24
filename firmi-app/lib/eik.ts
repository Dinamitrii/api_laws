type Company = {
  eik: string; name: string; legalForm: string; status: string; address: string;
  capital: string; capitalPaidIn: string; managers: string; settlement: string; url: string;
  fields: Record<string, string>;
};
type Suggestion = { name?: unknown; eik?: unknown; legal_form?: unknown; settlement?: unknown; status?: unknown; url?: unknown };

const scalar = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const decode = (value: string) => value
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ');
const strip = (value: string) => decode(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const clean = (value: string) => strip(value)
  .replace(/\s*Към\s+\d{2}\.\d{2}\.\d{4}.*$/, '')
  .replace(/\s*Има\s+\d+\s+фирми.*$/, '')
  .trim();
const timeout = () => AbortSignal.timeout(15000);

export async function searchCompanies(query: string): Promise<Record<string, unknown>[]> {
  const url = `https://eik.bg/search/suggestions?q=${encodeURIComponent(query)}&scope=companies`;
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: timeout(), redirect: 'manual' });
  if (!response.ok) throw Error('eik.bg временно не отговаря.');
  const data = await response.json().catch(() => null) as { suggestions?: unknown } | null;
  const list = Array.isArray(data?.suggestions) ? data!.suggestions as Suggestion[] : [];
  return list.filter(s => s && typeof s === 'object').map(s => ({
    name: scalar(s.name), eik: scalar(s.eik), legalForm: scalar(s.legal_form),
    settlement: scalar(s.settlement), status: scalar(s.status), url: scalar(s.url),
  }));
}

export async function getCompany(eik: string): Promise<Company> {
  const response = await fetch(`https://eik.bg/eik/${encodeURIComponent(eik)}`, { headers: { Accept: 'text/html' }, signal: timeout(), redirect: 'manual' });
  if (!response.ok) throw Error(response.status === 404 ? 'Фирмата не е намерена в eik.bg.' : 'eik.bg временно не отговаря.');
  const html = await response.text();
  const name = strip((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '');
  const fields: Record<string, string> = {};
  const row = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g;
  let match: RegExpExecArray | null;
  while ((match = row.exec(html))) {
    const key = strip(match[1]), value = clean(match[2]);
    if (key && value && !fields[key]) fields[key] = value;
  }
  return {
    eik, name,
    legalForm: fields['Правна форма'] || '',
    status: fields['Статус'] || '',
    address: fields['Седалище и адрес на управление'] || fields['Адрес'] || fields['Седалище'] || '',
    capital: fields['Капитал'] || '',
    capitalPaidIn: fields['Внесен капитал'] || '',
    managers: fields['Управител / МОЛ'] || fields['Управители'] || fields['Представляващ'] || '',
    settlement: fields['Населено място'] || '',
    url: `https://eik.bg/eik/${encodeURIComponent(eik)}`,
    fields,
  };
}