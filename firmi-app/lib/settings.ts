type Db = D1DatabaseSession;

/** D1 override first, then the environment secret. Missing table falls back to env. */
export async function getSetting(env: object, db: Db | undefined, key: string): Promise<string | undefined> {
  if (db) {
    try {
      const row = await db.prepare('SELECT value FROM admin_settings WHERE key=?').bind(key).first<{ value: string }>();
      if (row && row.value) return row.value;
    } catch { /* table not present yet */ }
  }
  const value = (env as Record<string, unknown>)[key];
  return typeof value === 'string' && value ? value : undefined;
}

export async function setSetting(db: Db, key: string, value: string): Promise<void> {
  await db.prepare(`INSERT INTO admin_settings(key,value,updated_at) VALUES(?,?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`)
    .bind(key, value, Math.floor(Date.now() / 1000)).run();
}

export const SECRET_KEYS = ['COMPANYBOOK_API_KEY', 'MAGISTRAT_API_KEY'] as const;