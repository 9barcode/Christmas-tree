-- Account-wide, once-per-user 30-day mission. No 5/10/15-day mission rows exist.
CREATE TABLE treemoa_missions (
  user_id TEXT NOT NULL REFERENCES treemoa_users(id),
  mission_day INTEGER NOT NULL CHECK (mission_day = 30),
  points INTEGER NOT NULL CHECK (points = 20),
  status TEXT NOT NULL DEFAULT 'earned' CHECK (status IN ('earned','paid')),
  claim_token TEXT,
  reward_key TEXT,
  promotion_code TEXT,
  earned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  tested_at TEXT,
  paid_at TEXT,
  PRIMARY KEY (user_id, mission_day),
  CHECK (status <> 'paid' OR paid_at IS NOT NULL)
);

-- Persist the Toss promotion key before requesting a transfer so an interrupted
-- request can only resume the same payment instead of creating a duplicate.
CREATE TABLE treemoa_promotion_payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES treemoa_users(id),
  kind TEXT NOT NULL CHECK (kind IN ('settlement','mission')),
  reward_ref TEXT NOT NULL,
  promotion_code TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  provider_key TEXT UNIQUE,
  key_issued_at INTEGER,
  state TEXT NOT NULL CHECK (state IN ('creating','ready','submitted','pending','succeeded','failed')),
  error_code TEXT,
  lease_token TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX treemoa_one_current_promotion_payment
  ON treemoa_promotion_payments(user_id, kind, reward_ref) WHERE state <> 'failed';
CREATE INDEX treemoa_promotion_payments_by_user
  ON treemoa_promotion_payments(user_id, updated_at);

CREATE TABLE treemoa_promotion_rate_limits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES treemoa_users(id),
  created_at INTEGER NOT NULL
);
CREATE INDEX treemoa_promotion_rate_limits_by_user
  ON treemoa_promotion_rate_limits(user_id, created_at);
