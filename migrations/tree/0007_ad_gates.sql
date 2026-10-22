-- Ad-gated inventory sales and Toss point exchanges use distinct promotion groups.
CREATE TABLE tree_factory_ad_gates (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES tree_users(id),
 purpose TEXT NOT NULL CHECK(purpose IN ('sell','tree-sale','exchange')),
 item_id TEXT,
 date TEXT NOT NULL,
 ad_group_id TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','completed','cancelled','consumed')),
 expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL,
 completed_at INTEGER
);
CREATE UNIQUE INDEX tree_factory_ad_gate_reserved ON tree_factory_ad_gates(user_id) WHERE state='reserved';
CREATE INDEX tree_factory_ad_gate_owner ON tree_factory_ad_gates(user_id,purpose,state);
