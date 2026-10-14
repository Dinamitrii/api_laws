export type Fields = Record<string, string>;

const TOKEN = /\{\{\s*(\w+)\s*\}\}/g;

// Own-property check: `k in obj` would also match prototype keys such as {{constructor}}.
const known = (fields: Fields, key: string) => Object.hasOwn(fields, key);

export function fillTemplate(template: string, fields: Fields, labels: Fields): string {
  return template.replace(TOKEN, (token, key: string) =>
    known(fields, key) ? fields[key] || `[липсва: ${labels[key] ?? key}]` : token);
}

export function unknownTokens(template: string, fields: Fields): string[] {
  return Array.from(template.matchAll(TOKEN), m => m[1]).filter(key => !known(fields, key));
}
