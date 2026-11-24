DROP TABLE IF EXISTS eik_mcp_tokens;
CREATE TABLE eik_mcp_config (
 id INTEGER PRIMARY KEY CHECK(id=1),
 access_token TEXT NOT NULL,
 refresh_token TEXT,
 client_id TEXT,
 expires_at INTEGER NOT NULL,
 scope TEXT,
 updated_at INTEGER NOT NULL
);
CREATE TABLE free_monthly_usage_new (
 user_id TEXT NOT NULL REFERENCES auth_users(id),
 month TEXT NOT NULL,
 used INTEGER NOT NULL DEFAULT 0 CHECK(used BETWEEN 0 AND 35),
 PRIMARY KEY(user_id,month)
);
INSERT INTO free_monthly_usage_new(user_id,month,used) SELECT user_id,month,used FROM free_monthly_usage;
DROP TABLE free_monthly_usage;
ALTER TABLE free_monthly_usage_new RENAME TO free_monthly_usage;