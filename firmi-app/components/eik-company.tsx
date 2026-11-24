'use client';
import { useRef, useState } from 'react';

type Company = Record<string, unknown> & { uic: string };
type Props = { uic: string; onCompany: (fields: Record<string, string>, company: Company) => void };
type Row = { name: string; eik: string; legalForm: string; settlement: string; status: string; url: string };
type Profile = { eik: string; name: string; legalForm: string; status: string; address: string; capital: string; capitalPaidIn: string; managers: string; settlement: string; url: string; fields: Record<string, string> };

async function post<T>(body: object): Promise<T> {
  let response: Response;
  try { response = await fetch('/api/eik', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
  catch { throw Error('Приложението не отговаря. Провери връзката и опитай отново.'); }
  let data: unknown;
  try { data = await response.json(); } catch { throw Error('Получен е неочакван отговор. Опитай отново.'); }
  if (!response.ok) throw Error(data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'Неуспешна справка.');
  return data as T;
}

export default function EikCompany({ uic, onCompany }: Props) {
  const revision = useRef(0);
  const [query, setQuery] = useState(uic), [results, setResults] = useState<Row[]>([]);
  const [company, setCompany] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [searched, setSearched] = useState(false);

  async function search(event: React.FormEvent) {
    event.preventDefault(); const current = revision.current; setBusy(true); setError(''); setResults([]); setCompany(null); setSearched(false);
    if (query.trim().length < 2) { setError('Въведи поне 2 символа.'); setBusy(false); return; }
    try {
      const data = await post<{ results: Row[] }>({ action: 'search', query: query.trim() });
      if (current === revision.current) { setResults(Array.isArray(data.results) ? data.results : []); setSearched(true); }
    } catch (e) { if (current === revision.current) setError((e as Error).message); }
    finally { if (current === revision.current) setBusy(false); }
  }
  async function open(row: Row) {
    if (!row.eik) { setError('Резултатът няма ЕИК.'); return; }
    const current = revision.current; setBusy(true); setError(''); setCompany(null);
    try {
      const data = await post<{ company: Profile }>({ action: 'detail', eik: row.eik });
      if (current === revision.current) setCompany(data.company);
    } catch (e) { if (current === revision.current) setError((e as Error).message); }
    finally { if (current === revision.current) setBusy(false); }
  }
  function load() {
    if (!company) return;
    const f = company.fields || {};
    const pickF = (...keys: string[]) => { for (const k of keys) { const v = f[k]; if (v) return v; } return ''; };
    onCompany({
      uic: company.eik || pickF('ЕИК'),
      name: company.name || pickF('Наименование'),
      legalForm: company.legalForm || pickF('Правна форма'),
      address: company.address || pickF('Седалище и адрес на управление'),
      manager: company.managers || pickF('Управител / МОЛ'),
      email: '', phone: '',
      nameLatin: pickF('Изписване на латиница'),
      deedStatus: company.status || pickF('Статус'),
      subjectOfActivity: pickF('Предмет на дейност'),
      nace: pickF('Код на икономическа дейност'),
      capital: company.capital || pickF('Капитал'),
      capitalPaidIn: company.capitalPaidIn || pickF('Внесен капитал'),
      wayOfRepresentation: pickF('Начин на представителство'),
      partners: pickF('Съдружници', 'Съучастие'),
      soleOwner: pickF('Едноличен собственик'),
      actualOwners: pickF('Собственост', 'Действителни собственици'),
      lastChangedAt: pickF('Данни за партидата към', 'Последна промяна'),
    }, { uic: company.eik, name: company.name });
  }

  return <section className="panel">
    <h2>eik.bg · фирмени данни</h2>
    <p className="subtitle">Търговски регистър · търсене и профил</p>
    <form onSubmit={search}>
      <label htmlFor="eik-query">Име или ЕИК</label>
      <input id="eik-query" value={query} disabled={busy} onChange={e => { setQuery(e.target.value); setResults([]); setCompany(null); setError(''); }} placeholder="Име или 9 цифри" />
      <button className="primary full" disabled={busy}>{busy ? 'Зареждане…' : 'Търси в eik.bg →'}</button>
    </form>
    {error && <p className="error" role="alert">{error}</p>}
    {searched && !busy && results.length === 0 && <p className="hint">Няма резултати за „{query.trim()}“. eik.bg търси по кирилица (както е името в регистъра) или по точен 9-цифрен ЕИК.</p>}
    {results.length > 0 && <><p className="hint">{results.length} резултата</p><ul className="data-fields">
      {results.map((row, i) => <li key={row.eik || i}>
        <button type="button" onClick={() => open(row)} disabled={busy}>
          {row.name || 'Без име'} · ЕИК {row.eik}
        </button>
        {(row.legalForm || row.settlement || row.status) && <span> {row.legalForm}{row.settlement ? ` · ${row.settlement}` : ''}{row.status ? ` · ${row.status}` : ''}</span>}
      </li>)}
    </ul></>}
    {company && <div className="integration-result" aria-live="polite">
      <strong>{company.name || 'Няма публикувано наименование'}</strong>
      <p>ЕИК {company.eik}{company.legalForm ? ` · ${company.legalForm}` : ''}{company.status ? ` · ${company.status}` : ''}</p>
      {company.address && <p>{company.address}</p>}
      {company.managers && <p>Управители: {company.managers}</p>}
      {company.capital && <p>Капитал: {company.capital}</p>}
      <button onClick={load}>Зареди във фирмените данни</button>
      <p className="hint">Заменя текущите фирмени данни. Имейлът и телефонът се допълват ръчно.</p>
    </div>}
    <p className="hint">Данните не са от Агенцията по вписванията, но са официални.</p>
  </section>;
}