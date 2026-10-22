-- BM v3 is isolated. Never delete or automatically monetize old slot contents.
CREATE TABLE tree_factory_items (
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES tree_users(id),asset_id TEXT NOT NULL,
 value INTEGER NOT NULL CHECK(value BETWEEN 0 AND 3),placed INTEGER NOT NULL DEFAULT 0 CHECK(placed IN (0,1)),
 x REAL,y REAL,sold_at INTEGER,source TEXT NOT NULL UNIQUE,created_at INTEGER NOT NULL
);
CREATE INDEX tree_factory_owned ON tree_factory_items(user_id,sold_at);
CREATE TABLE tree_factory_collection(user_id TEXT NOT NULL REFERENCES tree_users(id),asset_id TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(user_id,asset_id));
CREATE TABLE tree_factory_requests(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES tree_users(id),purpose TEXT NOT NULL CHECK(purpose IN ('produce','overtime')),date TEXT NOT NULL,ad_group_id TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','completed','cancelled')),expires_at INTEGER NOT NULL,result_id TEXT,completed_at INTEGER);
CREATE UNIQUE INDEX tree_factory_reservation ON tree_factory_requests(user_id) WHERE state='reserved';
CREATE UNIQUE INDEX tree_factory_overtime ON tree_factory_requests(user_id,date) WHERE purpose='overtime' AND state='completed';
CREATE TABLE tree_factory_ledger(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES tree_users(id),amount INTEGER NOT NULL,kind TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE tree_factory_layout(user_id TEXT PRIMARY KEY REFERENCES tree_users(id),revision INTEGER NOT NULL DEFAULT 0,pot_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE tree_factory_payments(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES tree_users(id),mode TEXT NOT NULL CHECK(mode IN ('live','test')),promotion_code TEXT NOT NULL,amount INTEGER NOT NULL CHECK(amount>0),provider_key TEXT UNIQUE,key_issued_at INTEGER,state TEXT NOT NULL CHECK(state IN ('creating','ready','submitted','pending','succeeded','failed')),error_code TEXT,lease_token TEXT,lease_until INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
CREATE UNIQUE INDEX tree_factory_payment_active ON tree_factory_payments(user_id) WHERE state NOT IN ('succeeded','failed');

CREATE TABLE tree_factory_imports(user_id TEXT PRIMARY KEY REFERENCES tree_users(id),token TEXT NOT NULL,created_at INTEGER NOT NULL);
