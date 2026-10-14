const json = (data: object, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const countries = new Set('AT BE BG CY CZ DE DK EE EL ES FI FR HR HU IE IT LT LU LV MT NL PL PT RO SE SI SK XI'.split(' '));
export async function POST(request: Request) {
  try {
    const body = await request.json() as { vat?: unknown } | null;
    const vat = typeof body?.vat === 'string' ? body.vat.toUpperCase().replace(/\s/g, '') : '';
    const match = /^([A-Z]{2})([A-Z0-9]{2,14})$/.exec(vat);
    if (!match) return json({ error: 'Въведи ДДС номер с код на държава, например BG123456789.' }, 400);
    const countryCode = match[1] === 'GR' ? 'EL' : match[1];
    if (!countries.has(countryCode)) return json({ error: 'VIES поддържа държавите от ЕС и Северна Ирландия (XI).' }, 400);
    const response = await fetch('https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ countryCode, vatNumber: match[2] }),
      signal: AbortSignal.timeout(20000), redirect: 'manual',
    });
    if (!response.ok) return json({ error: 'VIES временно не отговаря. Опитай по-късно.' }, 502);
    const data = await response.json() as Record<string, unknown>;
    // The official service currently returns `valid`; some versions use `isValid`.
    // A service fault must never be presented as a negative validation.
    const valid = typeof data?.valid === 'boolean' ? data.valid : data?.isValid;
    const serviceError = typeof data?.userError === 'string' && !['VALID', 'INVALID'].includes(data.userError);
    if (!data || typeof valid !== 'boolean' || serviceError || data.actionSucceed === false ||
        (Array.isArray(data.errorWrappers) && data.errorWrappers.length > 0) || typeof data.requestDate !== 'string') {
      return json({ error: data?.userError === 'INVALID_INPUT' ? 'VIES не приема формата на този ДДС номер.' : 'VIES или националният регистър временно не може да извърши проверката. Опитай по-късно.' }, data?.userError === 'INVALID_INPUT' ? 400 : 503);
    }
    if (typeof data.userError === 'string' && valid !== (data.userError === 'VALID')) return json({ error: 'VIES върна противоречив резултат. Опитай отново.' }, 502);
    const text = (v: unknown) => typeof v === 'string' && v !== '---' ? v : '';
    return json({ vat: countryCode + match[2], valid, name: text(data.name), address: text(data.address), requestDate: text(data.requestDate), requestIdentifier: text(data.requestIdentifier) });
  } catch (error) {
    const name = (error as Error).name;
    if (name === 'SyntaxError') return json({ error: 'Невалиден JSON в заявката или отговора на VIES.' }, 400);
    return json({ error: name === 'TimeoutError' || name === 'AbortError' ? 'VIES не отговори в рамките на 20 секунди. Опитай по-късно.' : 'Неуспешна връзка с VIES. Опитай по-късно.' }, 502);
  }
}
