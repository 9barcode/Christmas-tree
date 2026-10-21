-- Keep layouts on the authenticated account, independent of local storage.
ALTER TABLE tree_bm_slots ADD COLUMN positions_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(positions_json));
ALTER TABLE tree_bm_slots ADD COLUMN positions_revision INTEGER NOT NULL DEFAULT 0;
