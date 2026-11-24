'use client';
import { useEffect, useState } from 'react';

type Session = { admin: boolean; owner: boolean };
type Settings = Record<string, { configured: boolean; source: string }>;
type Admin = { user_id: string; email: string; added_by: string | null; created_at: number };
type User = { id: string; email: string; created_at: number; is_admin: number };

const LABELS: Record<string, string> = {
  COMPANYBOOK_API_KEY: 'TheCompanyBook API ключ',
  MAGISTRAT_API_KEY: 'Магистрат API ключ',
};

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw Error(data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'Неуспешна заявка.');
  return data as T;
}

export default function AdminApi() {
  const [session, setSession] = useState<Session | null>(null);
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>({});
  const [eik, setEik] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [resets, setResets] = useState<Record<string, string>>({});
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false);

  useEffect(() => { req<Session>('/api/admin/session').then(setSession).catch(() => setSession(null)); }, []);
  useEffect(() => {
    if (!open) return;
    req<{ settings: Settings; eikConfigured: boolean }>('/api/admin/settings').then(d => { setSettings(d.settings); setEik(d.eikConfigured); }).catch(e => setError((e as Error).message));
    if (session?.owner) {
      req<{ admins: Admin[] }>('/api/admin/admins').then(d => setAdmins(d.admins)).catch(() => {});
      req<{ users: User[] }>('/api/admin/users').then(d => setUsers(d.users)).catch(() => {});
    }
  }, [open, session]);

  if (!session?.admin) return null;

  async function save() {
    setBusy(true); setError(''); setSaved(false);
    try { await req('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) }); setSaved(true); setValues({}); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function addAdmin(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await req('/api/admin/admins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }); setEmail(''); const d = await req<{ admins: Admin[] }>('/api/admin/admins'); setAdmins(d.admins); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function delAdmin(userId: string) {
    setBusy(true); setError('');
    try { await req('/api/admin/admins', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) }); setAdmins(a => a.filter(x => x.user_id !== userId)); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function resetPassword(userId: string) {
    setBusy(true); setError('');
    try {
      await req('/api/admin/users/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, password: resets[userId] || '' }) });
      setResets(r => ({ ...r, [userId]: '' }));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return <div style={{ position: 'relative' }}>
    <button onClick={() => setOpen(!open)}>⚿ &nbsp; API ключове</button>
    {open && <>
      <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 55 }} />
      <section className="panel" style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 'min(460px, 92vw)', maxHeight: '80vh', overflow: 'auto', zIndex: 60, marginTop: 0, boxShadow: '0 14px 44px #1a384426' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0 }}>API ключове и настройки</h2>
          <button type="button" onClick={() => setOpen(false)}>✕</button>
        </div>
        <p className="subtitle">Само за администратори. Стойностите се пазят на сървъра и имат предимство пред env.</p>
        {Object.keys(LABELS).map(key => <div key={key} style={{ marginBottom: 12 }}>
          <label htmlFor={`k-${key}`}>{LABELS[key]}</label>
          <input id={`k-${key}`} type="password" autoComplete="off" value={values[key] || ''} placeholder={settings[key]?.configured ? `Конфигуриран (${settings[key].source}) — остави празно за запазване` : 'Липсва — постави ключ'} onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))} />
        </div>)}
        <p className="hint">eik.bg: {eik ? 'конфигуриран' : 'не се изисква ключ (публични данни)'}</p>
        <button className="primary" disabled={busy} onClick={save}>{busy ? 'Зареждане…' : 'Запази ключовете'}</button>
        {saved && <p className="hint">Запазено.</p>}
        {error && <p className="error" role="alert">{error}</p>}
        {session.owner && <>
          <h2 style={{ marginTop: 24 }}>Администратори</h2>
          <p className="hint">Ти си собственик. Добави администратор по имейл (трябва да е регистриран).</p>
          <form onSubmit={addAdmin}>
            <input type="email" value={email} required placeholder="admin@example.com" onChange={e => setEmail(e.target.value)} />
            <button className="primary" disabled={busy}>Добави админ</button>
          </form>
          <ul className="data-fields">
            {admins.map(a => <li key={a.user_id}>{a.email} <button type="button" disabled={busy} onClick={() => delAdmin(a.user_id)}>Премахни</button></li>)}
          </ul>
          <h2 style={{ marginTop: 24 }}>Потребители и пароли</h2>
          <p className="hint">Само ти (собственикът) можеш да задаваш нова парола на регистриран потребител. Смяната изкарва потребителя от всички сесии.</p>
          <ul className="data-fields">
            {users.map(u => <li key={u.id} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span>{u.email}{u.is_admin ? ' · админ' : ''}</span>
              <input type="text" autoComplete="new-password" placeholder="нова парола (мин. 8)" value={resets[u.id] || ''} onChange={e => setResets(r => ({ ...r, [u.id]: e.target.value }))} />
              <button type="button" disabled={busy} onClick={() => resetPassword(u.id)}>Reset парола</button>
            </li>)}
          </ul>
        </>}
      </section>
    </>}
  </div>;
}