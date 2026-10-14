'use client';
export const magistratLabels: Record<string, string> = {
 registry: 'Регистър', id: 'Идентификатор', url: 'Източник', uic: 'ЕИК', name: 'Наименование', nameLatin: 'Име на латиница', legalForm: 'Правна форма', deedStatus: 'Статус на вписването', seat: 'Седалище', address: 'Адрес', structured: 'Структуриран адрес', subjectOfActivity: 'Предмет на дейност', nace: 'Код на икономическа дейност', capital: 'Капитал', capitalPaidIn: 'Внесен капитал', managers: 'Управители', partners: 'Съдружници', soleOwner: 'Едноличен собственик', actualOwners: 'Действителни собственици', wayOfRepresentation: 'Начин на представляване', lastChangedAt: 'Последна промяна', field: 'Поле', operation: 'Операция', oldValue: 'Стара стойност', newValue: 'Нова стойност', changedAt: 'Дата на промяна', description: 'Описание', actYear: 'Година', actDate: 'Дата на акта', incomingNumber: 'Входящ номер', hasDocument: 'Наличен документ', documentUrl: 'Документ', title: 'Заглавие', text: 'Пълен текст', content: 'Съдържание', date: 'Дата', meta: 'Допълнителни данни', snippet: 'Откъс', court: 'Съд', caseNumber: 'Номер на дело', caseYear: 'Година на делото', parties: 'Страни', hearings: 'Заседания', acts: 'Актове', total: 'Общо', hasMore: 'Има още резултати', page: 'Страница', pageSize: 'Брой на страница', totalEstimated: 'Приблизителен общ брой', restricted: 'Ограничен достъп', items: 'Записи', cases: 'Дела', hits: 'Резултати', query: 'Търсене'
};
export function DataValue({ value }: { value: unknown }) {
 if (value === null || value === undefined || value === '') return <span className="hint">Няма публикувани данни</span>;
 if (typeof value === 'boolean') return <span>{value ? 'Да' : 'Не'}</span>;
 if (typeof value === 'string' || typeof value === 'number') {
   const text = String(value);
   return /^https?:\/\//i.test(text) ? <a href={text} target="_blank" rel="noreferrer">Отвори източника ↗</a> : <span className="data-text">{text}</span>;
 }
 if (Array.isArray(value)) return value.length ? <div className="data-list">{value.map((item, index) => <div className="data-item" key={index}><DataValue value={item} /></div>)}</div> : <span className="hint">Няма публикувани записи</span>;
 if (typeof value === 'object') return <dl className="data-fields">{Object.entries(value).map(([key, item]) => <div key={key}><dt>{magistratLabels[key] || key}</dt><dd><DataValue value={item} /></dd></div>)}</dl>;
 return null;
}
export function JsonDetails({ value }: { value: unknown }) {
 function download() {
   const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' }));
   const link = document.createElement('a'); link.href = url; link.download = 'magistrat-spravka.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
 }
 return <details><summary>Оригинален JSON отговор</summary><button onClick={download}>Изтегли JSON</button><pre>{JSON.stringify(value, null, 2)}</pre></details>;
}
export async function magistratPost<T>(body: object): Promise<T> {
 const response = await fetch('/api/magistrat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
 const data = await response.json();
 if (!response.ok) throw Error(data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'Неуспешна справка в Магистрат.');
 return data as T;
}
