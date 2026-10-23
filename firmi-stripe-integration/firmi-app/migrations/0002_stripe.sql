CREATE TABLE IF NOT EXISTS billing_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id),
  price_id TEXT NOT NULL,
  session_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid')),
  created_at INTEGER NOT NULL,
  paid_at INTEGER
);
CREATE INDEX IF NOT EXISTS billing_orders_user ON billing_orders(user_id, status);
