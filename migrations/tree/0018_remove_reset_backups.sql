-- Remove one-time pre-release and launch reset snapshots and their audit metadata.
-- Historical migrations remain intact; active application tables are untouched.
DROP TABLE IF EXISTS tree_test_reset_20261027_users;
DROP TABLE IF EXISTS tree_test_reset_20261027_items;
DROP TABLE IF EXISTS tree_test_reset_20261027_collection;
DROP TABLE IF EXISTS tree_test_reset_20261027_layout;
DROP TABLE IF EXISTS tree_test_reset_20261027_ad_gates;
DROP TABLE IF EXISTS tree_test_reset_20261027_imports;
DROP TABLE IF EXISTS tree_test_reset_20261027_payments;
DROP TABLE IF EXISTS tree_test_reset_20261027_ledger;
DROP TABLE IF EXISTS tree_launch_20261027_factory_items;
DROP TABLE IF EXISTS tree_launch_20261027_factory_collection;
DROP TABLE IF EXISTS tree_launch_20261027_factory_ledger;
DROP TABLE IF EXISTS tree_launch_20261027_factory_payments;
DROP TABLE IF EXISTS tree_launch_20261027_factory_requests;
DROP TABLE IF EXISTS tree_launch_20261027_factory_ad_gates;
DROP TABLE IF EXISTS tree_launch_20261027_factory_layout;
DROP TABLE IF EXISTS tree_launch_20261027_factory_imports;
DROP TABLE IF EXISTS tree_launch_20261027_bm_slots;
DROP TABLE IF EXISTS tree_launch_20261027_bm_requests;
DROP TABLE IF EXISTS tree_launch_20261027_bm_credits;
DROP TABLE IF EXISTS tree_launch_20261027_bm_payments;
DROP TABLE IF EXISTS tree_launch_20261027_audit;
