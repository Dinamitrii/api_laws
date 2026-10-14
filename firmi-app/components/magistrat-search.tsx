'use client';
import { useEffect, useRef, useState } from 'react';
import { DataValue, JsonDetails, magistratPost } from './magistrat-data';
type Facet = { key: string; label: string; options: { value: string; label: string }[] };
type Registry = { slug: string; name: string; title: string; description: string; docCount: number; updatedAt: string | null; filters: Facet[] };
type Hit = { id: string; title: string | null; snippet: string | null; date: string | null; meta: unknown; restricted: boolean | null };
type SearchResult = { registry: string; query: string; page: number; pageSize: number; total: number; hits: Hit[]; hasMore: boolean; totalEstimated: boolean };
export default function MagistratSearch() {
 const [registries, setRegistries] = useState<Registry[]>([]), [slug, setSlug] = useState(''), [query, setQuery] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState(''), [size, setSize] = useState(20), [filters, setFilters] = useState<Record<string, string>>({});
 const [result, setResult] = useState<SearchResult | null>(null), [document, setDocument] = useState<unknown>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
 const revision = useRef(0);
 useEffect(() => () => { revision.current++; }, []);
 const registry = registries.find(r => r.slug === slug);
 function reset() { revision.current++; setResult(null); setDocument(null); setError(''); setBusy(false); }
 async function loadRegistries() {
   const current = ++revision.current; setBusy(true); setError('');
   try { const data = await magistratPost<Registry[]>({ action: 'registries' }); if (!Array.isArray(data) || data.some(r => !r || typeof r.slug !== 'string')) throw Error('Неочакван списък с регистри.'); if (current === revision.current) { setRegistries(data); setSlug(data.find(r => r.slug === 'tr')?.slug || data[0]?.slug || ''); setFilters({}); setResult(null); setDocument(null); } }
   catch (e) { if (current === revision.current) setError((e as Error).message); } finally { if (current === revision.current) setBusy(false); }
 }
 async function search(page = 1) {
   if (!slug) return;
   const current = ++revision.current; setBusy(true); setError(''); setDocument(null);
   try { const data = await magistratPost<SearchResult>({ action: 'search', slug, query, from, to, page, pageSize: size, filters }); if (!Array.isArray(data.hits)) throw Error('Неочакван отговор от търсенето.'); if (current === revision.current) setResult(data); }
   catch (e) { if (current === revision.current) { setResult(null); setError((e as Error).message); } } finally { if (current === revision.current) setBusy(false); }
 }
 async function open(id: string) {
   const current = ++revision.current; setBusy(true); setError(''); setDocument(null);
   try { const data = await magistratPost({ action: 'document', slug, id }); if (current === revision.current) setDocument(data); }
   catch (e) { if (current === revision.current) setError((e as Error).message); } finally { if (current === revision.current) setBusy(false); }
 }
 return <section className="panel registry-search">
   <h2>Магистрат · търсене по регистри</h2><p className="subtitle">Избери източник, период и филтри. Празното търсене показва последните записи.</p>
   <button onClick={loadRegistries} disabled={busy}>{busy ? 'Зареждане…' : registries.length ? 'Обнови списъка с регистри' : 'Зареди наличните регистри'}</button>
   {registries.length > 0 && <form onSubmit={e => { e.preventDefault(); void search(); }}>
     <div className="fields"><div className="wide"><label htmlFor="registry">Регистър / база данни</label><select id="registry" value={slug} onChange={e => { reset(); setSlug(e.target.value); setFilters({}); }}>{registries.map(r => <option key={r.slug} value={r.slug}>{r.title || r.name} ({r.docCount ?? '—'} записа)</option>)}</select></div>
     <div className="wide"><p>{registry?.description}</p>{registry?.updatedAt && <p className="hint">Обновен: {registry.updatedAt}</p>}<label htmlFor="registry-query">Текст за търсене</label><input id="registry-query" maxLength={500} value={query} onChange={e => { reset(); setQuery(e.target.value); }} placeholder="Име, дума или израз" /></div>
     <div><label htmlFor="registry-from">От дата</label><input id="registry-from" type="date" value={from} onChange={e => { reset(); setFrom(e.target.value); }} /></div>
     <div><label htmlFor="registry-to">До дата</label><input id="registry-to" type="date" value={to} onChange={e => { reset(); setTo(e.target.value); }} /></div>
     <div><label htmlFor="registry-size">Резултати на страница</label><select id="registry-size" value={size} onChange={e => { reset(); setSize(Number(e.target.value)); }}>{[20, 50, 100].map(n => <option key={n}>{n}</option>)}</select></div>
     {(registry?.filters || []).map(f => <div key={f.key}><label htmlFor={`facet-${f.key}`}>{f.label}</label><select id={`facet-${f.key}`} value={filters[f.key] || ''} onChange={e => { reset(); setFilters({ ...filters, [f.key]: e.target.value }); }}><option value="">Всички</option>{f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>)}</div>
     <button className="primary" disabled={busy || !slug}>{busy ? 'Зареждане…' : 'Търси в избрания регистър'}</button>
   </form>}
   {error && <p className="error" role="alert">{error}</p>}
   {result && <div aria-live="polite"><p>{result.totalEstimated ? 'Приблизително' : 'Намерени'}: {result.total} · страница {result.page}</p>
   {result.hits.length === 0 && <p>Няма намерени записи.</p>}
   {result.hits.map(hit => <article className="data-item" key={hit.id}><h3>{hit.title || hit.id}</h3>{hit.date && <p>{hit.date}</p>}<p className="data-text">{hit.snippet}</p>{hit.restricted && <p className="hint">Записът е с ограничен достъп.</p>}<button disabled={busy} onClick={() => open(hit.id)}>Пълен документ →</button>{hit.meta != null && <details><summary>Допълнителни данни</summary><DataValue value={hit.meta} /></details>}</article>)}
   <div className="actions"><button disabled={busy || result.page <= 1} onClick={() => search(result.page - 1)}>← Предишна</button><button disabled={busy || !result.hasMore} onClick={() => search(result.page + 1)}>Следваща →</button></div><JsonDetails value={result} /></div>}
   {document != null && <div className="data-item" aria-live="polite"><h3>Пълен документ</h3><DataValue value={document} /><JsonDetails value={document} /></div>}
 </section>;
}
