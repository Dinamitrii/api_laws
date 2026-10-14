'use client';
import { useEffect, useRef, useState } from 'react';
import MagistratCompanyCard, {type MagistratCompany} from './magistrat-company';

type Company = MagistratCompany;
const scalar = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const printable = (value: unknown) => value == null ? '' : typeof value === 'object' ? JSON.stringify(value, null, 2) : scalar(value);
type VatResult = { vat: string; valid: boolean; name: string; address: string; requestDate: string; requestIdentifier: string };
async function post<T>(path: string, body: object): Promise<T> {
  let response: Response;
  try { response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
  catch { throw Error('Приложението не отговаря. Провери връзката и опитай отново.'); }
  let data: unknown;
  try { data = await response.json(); } catch { throw Error('Получен е неочакван отговор. Опитай отново.'); }
  if (!response.ok) throw Error(data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'Неуспешна справка.');
  return data as T;
}
export function managerNames(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(managerNames).filter(Boolean).join(', ');
  if (!value || typeof value !== 'object') return '';
  const entry = value as Record<string, unknown>;
  for (const key of ['name', 'Name', 'personName', 'PersonName']) {
    if (typeof entry[key] === 'string') return entry[key];
  }
  // Register JSON may wrap the person record; ignore unrelated scalar identifiers.
  return Object.values(entry).filter(v => v && typeof v === 'object').map(managerNames).filter(Boolean).join(', ');
}
export default function CompanyIntegrations({ uic, onCompany }: { uic: string; onCompany: (fields: Record<string, string>, company: Company) => void }) {
  const revision = useRef(0);
  const [query, setQuery] = useState(uic), [vat, setVat] = useState(uic ? `BG${uic}` : '');
  const [company, setCompany] = useState<Company | null>(null), [result, setResult] = useState<VatResult | null>(null);
  const [companyBusy, setCompanyBusy] = useState(false), [vatBusy, setVatBusy] = useState(false);
  const [companyError, setCompanyError] = useState(''), [vatError, setVatError] = useState('');
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => () => { revision.current++; }, []);
  useEffect(() => { let active = true; fetch('/api/magistrat', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (active) setConfigured(Boolean(d && typeof d === 'object' && 'configured' in d && d.configured)); }).catch(() => {}); return () => { active = false; }; }, []);
  async function lookup(event: React.FormEvent) {
    event.preventDefault(); const current = revision.current; setCompanyBusy(true); setCompany(null); setCompanyError('');
    try { const data = await post<{ company: Company }>('/api/magistrat', { uic: query }); if (current === revision.current) setCompany(data.company); }
    catch (error) { if (current === revision.current) setCompanyError((error as Error).message); } finally { if (current === revision.current) setCompanyBusy(false); }
  }
  async function validate(event: React.FormEvent) {
    event.preventDefault(); const current = revision.current; setVatBusy(true); setResult(null); setVatError('');
    try { const data = await post<VatResult>('/api/vies', { vat }); if (current === revision.current) setResult(data); }
    catch (error) { if (current === revision.current) setVatError((error as Error).message); } finally { if (current === revision.current) setVatBusy(false); }
  }
  return <div className="grid integrations">
    <section className="panel">
      <h2>Магистрат · фирмена справка</h2>
      <p className="subtitle">По ЕИК · управление и собственост</p>
      <form onSubmit={lookup}>
        <label htmlFor="magistrat-uic">ЕИК на фирмата</label>
        <input id="magistrat-uic" value={query} disabled={companyBusy} onChange={e => { setQuery(e.target.value); setCompany(null); setCompanyError(''); }} placeholder="9 цифри" />
        <button className="primary full" disabled={companyBusy}>{companyBusy ? 'Зареждане…' : 'Справка в Магистрат →'}</button>
      </form>
      {configured !== null && <p className="hint">{configured ? 'Ключът за Магистрат е настроен.' : 'Добави ключ за Магистрат в настройките на сървъра.'}</p>}
      {companyError && <p className="error" role="alert">{companyError}</p>}
      {company && <div className="integration-result" aria-live="polite">
        <strong>{company.name || 'Няма публикувано наименование'}</strong>
        <p>ЕИК {company.uic} · {company.legalForm || 'Няма посочена правна форма'}</p>
        <p>{company.seat?.address || 'Няма публикуван адрес'}</p>
        {managerNames(company.managers) && <p>Управители: {managerNames(company.managers)}</p>}
        <button onClick={() => onCompany({ uic: company.uic, name: company.name || '', legalForm: company.legalForm || '', address: company.seat?.address || '', manager: managerNames(company.managers), email: '', phone: '', nameLatin: scalar(company.nameLatin), deedStatus: scalar(company.deedStatus), subjectOfActivity: scalar(company.subjectOfActivity), nace: scalar(company.nace), capital: scalar(company.capital), capitalPaidIn: scalar(company.capitalPaidIn), wayOfRepresentation: scalar(company.wayOfRepresentation), partners: printable(company.partners), soleOwner: printable(company.soleOwner), actualOwners: printable(company.actualOwners), lastChangedAt: scalar(company.lastChangedAt) }, company)}>Зареди във фирмените данни</button>
        <p className="hint">Заменя текущите фирмени данни. Имейлът и телефонът се допълват ръчно.</p>
        <MagistratCompanyCard key={company.uic} company={company} />
      </div>}
      <p className="hint"><a href="https://magistrat.bg/developers" target="_blank" rel="noreferrer">Магистрат ↗</a> · Безплатното API ниво е за оценка и нетърговска употреба.</p>
    </section>
    <section className="panel">
      <h2>VIES · проверка на ДДС номер</h2>
      <p className="subtitle">Европейска комисия · без API ключ</p>
      <form onSubmit={validate}>
        <label htmlFor="vies-vat">ДДС номер с код на държава</label>
        <input id="vies-vat" value={vat} disabled={vatBusy} onChange={e => { setVat(e.target.value); setResult(null); setVatError(''); }} placeholder="BG123456789" />
        <button className="primary full" disabled={vatBusy}>{vatBusy ? 'Проверка…' : 'Провери във VIES →'}</button>
      </form>
      {vatError && <p className="error" role="alert">{vatError}</p>}
      {result && <div className={`integration-result ${result.valid ? 'vat-valid' : 'vat-invalid'}`} role="status">
        <strong>{result.vat}: {result.valid ? 'Валиден ДДС номер' : 'Невалиден ДДС номер според VIES'}</strong>
        {result.name && <p>{result.name}</p>}{result.address && <p>{result.address}</p>}
        <p>Дата на проверката: {result.requestDate}</p>
        {result.requestIdentifier && <p>Идентификатор на проверката: {result.requestIdentifier}</p>}
        {!result.valid && <p>Този резултат не означава, че фирмата не съществува.</p>}
      </div>}
      <p className="hint">Предложеният BG + ЕИК трябва да се провери. VIES проверява валидността за сделки в ЕС. Наличието на име и адрес зависи от националния регистър.</p>
      <p className="hint"><a href="https://ec.europa.eu/taxation_customs/vies/" target="_blank" rel="noreferrer">Официален VIES ↗</a></p>
    </section>
  </div>;
}
