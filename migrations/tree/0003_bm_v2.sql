-- New BM records are isolated from legacy attendance and payouts.
CREATE TABLE tree_bm_slots (
 user_id TEXT NOT NULL REFERENCES tree_users(id), slot INTEGER NOT NULL CHECK(slot BETWEEN 1 AND 5),
 color TEXT NOT NULL CHECK(color IN ('green','white','pink','blue','gold')),
 decorations INTEGER NOT NULL DEFAULT 0 CHECK(decorations BETWEEN 0 AND 30),
 completed_at INTEGER, PRIMARY KEY(user_id,slot), CHECK(slot <> 1 OR color = 'green')
);
CREATE TABLE tree_bm_requests (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES tree_users(id),
 purpose TEXT NOT NULL CHECK(purpose IN ('unlock-slot','earn-decoration','exchange-points')),
 slot INTEGER NOT NULL CHECK(slot BETWEEN 1 AND 5), ad_group_id TEXT NOT NULL,
 date TEXT NOT NULL, expires_at INTEGER NOT NULL,
 state TEXT NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','completed','cancelled')),
 completed_at INTEGER
);
CREATE UNIQUE INDEX tree_bm_one_reservation ON tree_bm_requests(user_id) WHERE state = 'reserved';
CREATE INDEX tree_bm_daily ON tree_bm_requests(user_id,date,purpose,state);
CREATE TABLE tree_bm_credits (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES tree_users(id), slot INTEGER NOT NULL,
 amount INTEGER NOT NULL CHECK(amount = 30), created_at INTEGER NOT NULL, paid_at INTEGER,
 UNIQUE(user_id,slot), FOREIGN KEY(user_id,slot) REFERENCES tree_bm_slots(user_id,slot)
);
CREATE TABLE tree_bm_payments (
 id TEXT PRIMARY KEY REFERENCES tree_bm_requests(id), user_id TEXT NOT NULL REFERENCES tree_users(id),
 credit_id TEXT NOT NULL REFERENCES tree_bm_credits(id),
 mode TEXT NOT NULL CHECK(mode IN ('live','test')), promotion_code TEXT NOT NULL,
 amount INTEGER NOT NULL CHECK(amount = 30), provider_key TEXT UNIQUE, key_issued_at INTEGER,
 state TEXT NOT NULL CHECK(state IN ('creating','ready','submitted','pending','succeeded','failed')),
 error_code TEXT, lease_token TEXT, lease_until INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX tree_bm_one_payment ON tree_bm_payments(credit_id,mode) WHERE state <> 'failed';
