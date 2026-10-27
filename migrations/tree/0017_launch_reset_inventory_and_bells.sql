-- One-time launch reset authorized for ALL existing TreeMoa accounts.
-- The shared D1 database also hosts other apps: only tree_ tables are touched.
-- Archive test records inside D1 before clearing active inventory and bell balance.
CREATE TABLE tree_launch_20261027_guard(ok INTEGER NOT NULL CHECK(ok=1));
INSERT INTO tree_launch_20261027_guard
SELECT CASE WHEN EXISTS(SELECT 1 FROM tree_factory_payments WHERE state NOT IN('succeeded','failed'))
 OR EXISTS(SELECT 1 FROM tree_bm_payments WHERE state NOT IN('succeeded','failed'))
 THEN 0 ELSE 1 END;
CREATE TABLE tree_launch_20261027_factory_items AS SELECT * FROM tree_factory_items;
CREATE TABLE tree_launch_20261027_factory_collection AS SELECT * FROM tree_factory_collection;
CREATE TABLE tree_launch_20261027_factory_ledger AS SELECT * FROM tree_factory_ledger;
CREATE TABLE tree_launch_20261027_factory_payments AS SELECT * FROM tree_factory_payments;
CREATE TABLE tree_launch_20261027_factory_requests AS SELECT * FROM tree_factory_requests;
CREATE TABLE tree_launch_20261027_factory_ad_gates AS SELECT * FROM tree_factory_ad_gates;
CREATE TABLE tree_launch_20261027_factory_layout AS SELECT * FROM tree_factory_layout;
CREATE TABLE tree_launch_20261027_factory_imports AS SELECT * FROM tree_factory_imports;
CREATE TABLE tree_launch_20261027_bm_slots AS SELECT * FROM tree_bm_slots;
CREATE TABLE tree_launch_20261027_bm_requests AS SELECT * FROM tree_bm_requests;
CREATE TABLE tree_launch_20261027_bm_credits AS SELECT * FROM tree_bm_credits;
CREATE TABLE tree_launch_20261027_bm_payments AS SELECT * FROM tree_bm_payments;

-- Remove terminal payments too: old test exchanges must not refund bells on recovery.
DELETE FROM tree_factory_items;
DELETE FROM tree_factory_collection;
DELETE FROM tree_factory_ledger;
DELETE FROM tree_factory_payments;
DELETE FROM tree_factory_requests;
DELETE FROM tree_factory_ad_gates;
-- Remove pre-v3 test entitlements, preserving accounts and slot identities.
DELETE FROM tree_bm_payments;
DELETE FROM tree_bm_credits;
DELETE FROM tree_bm_requests;
UPDATE tree_bm_slots SET decorations=0,completed_at=NULL,positions_json='{}';
-- Prevent importing pre-release decorations after the reset.
INSERT INTO tree_factory_imports(user_id,token,created_at)
 SELECT id,'launch-reset-20261027',unixepoch()*1000 FROM tree_users WHERE true
 ON CONFLICT(user_id) DO NOTHING;
INSERT INTO tree_factory_layout(user_id,revision,pot_json)
 SELECT id,1,'{"x":50,"y":73.95}' FROM tree_users WHERE true
 ON CONFLICT(user_id) DO UPDATE SET revision=tree_factory_layout.revision+1,pot_json=excluded.pot_json;
CREATE TABLE tree_launch_20261027_audit AS
 SELECT unixepoch()*1000 AS completed_at,(SELECT count(*) FROM tree_users) AS accounts,
 (SELECT count(*) FROM tree_launch_20261027_factory_items) AS archived_items,
 (SELECT COALESCE(sum(amount),0) FROM tree_launch_20261027_factory_ledger) AS archived_bell_balance,
 (SELECT count(*) FROM tree_factory_items) AS remaining_items,
 (SELECT count(*) FROM tree_factory_collection) AS remaining_collection,
 (SELECT COALESCE(sum(amount),0) FROM tree_factory_ledger) AS remaining_bell_balance;
INSERT INTO tree_launch_20261027_guard
 SELECT CASE WHEN remaining_items=0 AND remaining_collection=0 AND remaining_bell_balance=0
 AND NOT EXISTS(SELECT 1 FROM tree_bm_slots WHERE decorations<>0)
 THEN 1 ELSE 0 END FROM tree_launch_20261027_audit;
DROP TABLE tree_launch_20261027_guard;
