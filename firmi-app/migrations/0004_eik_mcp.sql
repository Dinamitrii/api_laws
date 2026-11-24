CREATE TABLE IF NOT EXISTS eik_mcp_client (
 origin TEXT PRIMARY KEY,
 client_id TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS eik_mcp_tokens (
 user_id TEXT PRIMARY KEY REFERENCES auth_users(id),
 access_token TEXT NOT NULL,
 refresh_token TEXT,
 client_id TEXT,
 expires_at INTEGER NOT NULL,
 scope TEXT,
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS eik_mcp_pending (
 state TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES auth_users(id),
 code_verifier TEXT NOT NULL,
 redirect_uri TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);