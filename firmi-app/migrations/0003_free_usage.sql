CREATE TABLE IF NOT EXISTS free_monthly_usage (
 user_id TEXT NOT NULL REFERENCES auth_users(id),
 month TEXT NOT NULL,
 used INTEGER NOT NULL DEFAULT 0 CHECK(used BETWEEN 0 AND 25),
 PRIMARY KEY(user_id,month)
);
CREATE TABLE IF NOT EXISTS refund_requests (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES auth_users(id),
 message TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'requested'
);
