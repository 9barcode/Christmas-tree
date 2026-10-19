-- Mission eligibility comes only from authenticated server-recorded attendance.
CREATE TABLE tree_mission_progress (
  user_id TEXT NOT NULL REFERENCES tree_users(id),
  slot INTEGER NOT NULL CHECK(slot BETWEEN 1 AND 5),
  completed INTEGER NOT NULL DEFAULT 0 CHECK(completed BETWEEN 0 AND 30),
  last_date TEXT,
  request_id TEXT,
  PRIMARY KEY(user_id,slot)
);
CREATE TABLE tree_promotion_missions (
  user_id TEXT NOT NULL REFERENCES tree_users(id),
  day INTEGER NOT NULL CHECK(day IN (15,30)),
  amount INTEGER NOT NULL CHECK(amount > 0),
  earned_at INTEGER NOT NULL,
  paid_at INTEGER,
  tested_at INTEGER,
  PRIMARY KEY(user_id,day)
);
CREATE TABLE tree_mission_payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES tree_users(id),
  day INTEGER NOT NULL CHECK(day IN (15,30)),
  mode TEXT NOT NULL CHECK(mode IN ('live','test')),
  promotion_code TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount > 0),
  provider_key TEXT UNIQUE,
  key_issued_at INTEGER,
  state TEXT NOT NULL CHECK(state IN ('creating','ready','submitted','pending','succeeded','failed')),
  error_code TEXT,
  lease_token TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(user_id,day) REFERENCES tree_promotion_missions(user_id,day)
);
CREATE UNIQUE INDEX tree_mission_one_active_payment
  ON tree_mission_payments(user_id,day,mode) WHERE state <> 'failed';
CREATE TABLE tree_mission_api_calls (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES tree_users(id),
  created_at INTEGER NOT NULL
);
CREATE INDEX tree_mission_calls_user_time ON tree_mission_api_calls(user_id,created_at);
