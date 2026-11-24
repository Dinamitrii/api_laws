const encoder = new TextEncoder();
const hex = (bytes: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(bytes instanceof Uint8Array ? bytes.buffer as ArrayBuffer : bytes), b => b.toString(16).padStart(2, '0')).join('');
const random = (length: number) => hex(crypto.getRandomValues(new Uint8Array(length)));

export async function passwordHash(password: string, pepper: string, salt = random(32)) {
  const pepperKey = await crypto.subtle.importKey('raw', encoder.encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const material = await crypto.subtle.sign('HMAC', pepperKey, encoder.encode(password));
  const key = await crypto.subtle.importKey('raw', material, 'PBKDF2', false, ['deriveBits']);
  // Workers supports at most 100,000 PBKDF2 iterations. A separately stored
  // server pepper also protects passwords if only the database is disclosed.
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-512', iterations: 100000, salt: encoder.encode(salt) }, key, 512);
  return `pbkdf2-sha512-v1$${salt}$${hex(bits)}`;
}

export async function passwordMatches(password: string, pepper: string, stored: string) {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'pbkdf2-sha512-v1' || !/^[a-f0-9]{64}$/.test(parts[1]) || !/^[a-f0-9]{128}$/.test(parts[2])) return false;
  const candidate = await passwordHash(password, pepper, parts[1]);
  let difference = candidate.length ^ stored.length;
  for (let i = 0; i < candidate.length; i++) difference |= candidate.charCodeAt(i) ^ stored.charCodeAt(i);
  return difference === 0;
}