'use client';
import { useEffect, useRef, useState } from 'react';
import { DataValue, JsonDetails, magistratPost } from './magistrat-data';
export type MagistratCompany = Record<string, unknown> & { uic: string; name?: string; legalForm?: string; seat?: { address?: string }; managers?: unknown };
const sections = [
 ['Основни данни', ['uic', 'name', 'nameLatin', 'legalForm', 'deedStatus', 'seat']],
 ['Дейност и капитал', ['subjectOfActivity', 'nace', 'capital', 'capitalPaidIn']],
 ['Управление и собственост', ['managers', 'wayOfRepresentation', 'partners', 'soleOwner', 'actualOwners']],
 ['Източник и актуалност', ['registry', 'id', 'url', 'lastChangedAt']],
] as const;
export default function MagistratCompanyCard({ company }: { company: MagistratCompany }) {
 const [selected, setSelected] = useState(''), [data, setData] = useState<unknown>(null), [act, setAct] = useState<unknown>(null), [courtCase, setCourtCase] = useState<Record<string, unknown> | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
 const revision = useRef(0);
 useEffect(() => () => { revision.current++; }, []);
 async function load(action: string, id?: string, page = 1) {
   const current = ++revision.current; setBusy(true); setError('');
   const detail = ['act', 'case', 'courtAct'].includes(action);
   if (detail) { setAct(null); if (action === 'case') setCourtCase(null); } else { setSelected(action); setData(null); setAct(null); setCourtCase(null); }
   try { const result = await magistratPost({ action, uic: company.uic, id, page, caseId: courtCase?.id }); if (current === revision.current) { if (action === 'case') setCourtCase(result as Record<string, unknown>); else if (detail) setAct(result); else setData(result); } }
   catch (e) { if (current === revision.current) setError((e as Error).message); } finally { if (current === revision.current) setBusy(false); }
 }
 const records = data && typeof data === 'object' && 'items' in data && Array.isArray(data.items) ? data.items as Record<string, unknown>[] : [];
 const hits = data && typeof data === 'object' && 'hits' in data && Array.isArray(data.hits) ? data.hits as Record<string, unknown>[] : [];
 const page = data && typeof data === 'object' && 'page' in data && typeof data.page === 'number' ? data.page : 1;
 const more = data && typeof data === 'object' && 'hasMore' in data && data.hasMore === true;
 return <div className="company-dossier">
   {sections.map(([title, keys]) => <details key={title} open><summary>{title}</summary><DataValue value={Object.fromEntries(keys.map(key => [key, company[key]]))} /></details>)}
   <JsonDetails value={company} />
   <div className="actions">{[['history', 'История на промените'], ['acts', 'Обявени актове'], ['cases', 'Съдебни дела']].map(([action, label]) => <button key={action} disabled={busy} aria-pressed={selected === action} onClick={() => load(action)}>{label}</button>)}</div>
   {busy && <p role="status">Зареждане…</p>}{error && <p className="error" role="alert">{error}</p>}
   {data != null && <div aria-live="polite"><DataValue value={data} />
   {selected === 'acts' && records.filter(r => typeof r.id === 'string').map(r => <button key={String(r.id)} disabled={busy} onClick={() => load('act', String(r.id))}>Отвори акт: {String(r.description || r.id)}</button>)}
   {selected === 'history' && data && typeof data === 'object' && 'hasMore' in data && data.hasMore === true && <p className="hint">Показани са до 100 промени. API посочва, че има и по-стари записи.</p>}
   {selected === 'cases' && <><div className="actions"><button disabled={busy || page <= 1} onClick={() => load('cases', undefined, page - 1)}>← Предишна страница</button><button disabled={busy || !more || page >= 500} onClick={() => load('cases', undefined, page + 1)}>Следваща страница →</button></div>{page >= 500 && more && <p>Достигната е максималната дълбочина от 500 страници.</p>}{hits.filter(r => typeof r.id === 'string').map(r => <button key={String(r.id)} disabled={busy} onClick={() => load('case', String(r.id))}>Отвори дело: {String(r.title || r.id)}</button>)}</>}
   <JsonDetails value={data} /></div>}
   {courtCase && <div><h3>Дело · страни, заседания и актове</h3><DataValue value={courtCase} /><JsonDetails value={courtCase} />{Array.isArray(courtCase.acts) && courtCase.acts.filter((r: Record<string, unknown>) => typeof r.id === 'string').map((r: Record<string, unknown>) => <button key={String(r.id)} disabled={busy} onClick={() => load('courtAct', String(r.id))}>Отвори съдебен акт: {String(r.kind || r.id)}</button>)}</div>}
   {act != null && <div><h3>Подробности за акта</h3><DataValue value={act} /><JsonDetails value={act} /></div>}
 </div>;
}
