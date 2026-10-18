-- Shared D1 database: only tree_ tables belong to this application.
CREATE TABLE tree_users (
  id TEXT PRIMARY KEY,
  toss_user_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE tree_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES tree_users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX tree_sessions_user_idx ON tree_sessions(user_id);
CREATE TABLE tree_trees (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES tree_users(id),
  slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 5),
  color TEXT NOT NULL CHECK (color IN ('green','white','pink','blue','gold')),
  current_cycle INTEGER NOT NULL DEFAULT 0 CHECK (current_cycle >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (user_id,slot),
  CHECK (slot <> 1 OR color = 'green')
);
CREATE TABLE tree_cycles (
  tree_id TEXT NOT NULL REFERENCES tree_trees(id),
  cycle INTEGER NOT NULL CHECK (cycle >= 0),
  attendance_count INTEGER NOT NULL DEFAULT 0 CHECK (attendance_count BETWEEN 0 AND 30),
  last_attendance_date TEXT,
  positions_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(positions_json)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (tree_id,cycle),
  CHECK ((attendance_count = 0 AND last_attendance_date IS NULL) OR
         (attendance_count > 0 AND last_attendance_date IS NOT NULL))
);
CREATE TABLE tree_ad_completions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES tree_users(id),
  tree_id TEXT NOT NULL,
  cycle INTEGER NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('attendance','settlement')),
  provider_receipt_hash TEXT NOT NULL UNIQUE,
  verified_at TEXT NOT NULL,
  consumed_at TEXT,
  FOREIGN KEY (tree_id,cycle) REFERENCES tree_cycles(tree_id,cycle)
);
CREATE INDEX tree_ads_user_idx ON tree_ad_completions(user_id);
CREATE TABLE tree_attendance (
  tree_id TEXT NOT NULL,
  cycle INTEGER NOT NULL,
  attendance_date TEXT NOT NULL,
  day_number INTEGER NOT NULL CHECK (day_number BETWEEN 1 AND 30),
  ad_completion_id TEXT NOT NULL UNIQUE REFERENCES tree_ad_completions(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (tree_id,cycle,attendance_date),
  UNIQUE (tree_id,cycle,day_number),
  FOREIGN KEY (tree_id,cycle) REFERENCES tree_cycles(tree_id,cycle)
);
CREATE TABLE tree_settlements (
  reward_ref TEXT PRIMARY KEY,
  tree_id TEXT NOT NULL,
  cycle INTEGER NOT NULL,
  attendance_count INTEGER NOT NULL CHECK (attendance_count BETWEEN 1 AND 30),
  amount INTEGER NOT NULL CHECK (amount = attendance_count * (attendance_count + 1) / 2),
  reason TEXT NOT NULL CHECK (reason IN ('complete','settled')),
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','pending','paid')),
  ad_completion_id TEXT UNIQUE REFERENCES tree_ad_completions(id),
  provider_payment_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  paid_at TEXT,
  UNIQUE (tree_id,cycle),
  FOREIGN KEY (tree_id,cycle) REFERENCES tree_cycles(tree_id,cycle),
  CHECK (status <> 'paid' OR paid_at IS NOT NULL)
);
CREATE INDEX tree_settlements_status_idx ON tree_settlements(status,updated_at);
CREATE TABLE tree_promotion_api_calls (
  id TEXT PRIMARY KEY,
  reward_ref TEXT NOT NULL REFERENCES tree_settlements(reward_ref),
  operation TEXT NOT NULL CHECK (operation IN ('claim','status')),
  result TEXT NOT NULL CHECK (result IN ('pending','paid','retryable','unknown')),
  provider_request_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX tree_promotion_calls_reward_idx ON tree_promotion_api_calls(reward_ref,created_at);
