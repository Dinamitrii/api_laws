export interface AdminEnv { ADMIN_USER_IDS?: string; OWNER_USER_IDS?: string; AUTH_PEPPER?: string }
const list = (value?: string) => (value ?? '').split(',').map(s => s.trim()).filter(Boolean);

export function isOwner(env: AdminEnv, userId: string): boolean {
  return list(env.OWNER_USER_IDS).includes(userId);
}

/** Admin if owner, listed in env, or added at runtime (D1). Missing table is tolerated. */
export async function isAdmin(env: AdminEnv, db: D1DatabaseSession, userId: string): Promise<boolean> {
  if (isOwner(env, userId) || list(env.ADMIN_USER_IDS).includes(userId)) return true;
  try {
    return Boolean(await db.prepare('SELECT 1 FROM admin_users WHERE user_id=?').bind(userId).first());
  } catch {
    return false;
  }
}

export async function listAdmins(db: D1DatabaseSession): Promise<{ user_id: string; email: string; added_by: string | null; created_at: number }[]> {
  const result = await db.prepare('SELECT user_id,email,added_by,created_at FROM admin_users ORDER BY created_at').all();
  return (result.results ?? []) as { user_id: string; email: string; added_by: string | null; created_at: number }[];
}

export async function addAdmin(db: D1DatabaseSession, email: string, addedBy: string): Promise<boolean> {
  const user = await db.prepare('SELECT id FROM auth_users WHERE email=?').bind(email).first<{ id: string }>();
  if (!user) return false;
  await db.prepare('INSERT INTO admin_users(user_id,email,added_by,created_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO NOTHING')
    .bind(user.id, email, addedBy, Math.floor(Date.now() / 1000)).run();
  return true;
}

export async function removeAdmin(db: D1DatabaseSession, userId: string): Promise<void> {
  await db.prepare('DELETE FROM admin_users WHERE user_id=?').bind(userId).run();
}