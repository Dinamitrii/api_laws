CREATE TABLE IF NOT EXISTS admin_settings (
 key TEXT PRIMARY KEY,
 value TEXT NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_users (
 user_id TEXT PRIMARY KEY REFERENCES auth_users(id),
 email TEXT NOT NULL,
 added_by TEXT,
 created_at INTEGER NOT NULL
);