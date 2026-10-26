-- Upgrade the already-deployed 0009 without rewriting migration history.
ALTER TABLE tree_factory_payments ADD COLUMN business_date TEXT;
ALTER TABLE tree_factory_payments ADD COLUMN finalized_at INTEGER;
ALTER TABLE tree_factory_payments ADD COLUMN finalization_token TEXT;
UPDATE tree_factory_payments
 SET business_date=date(created_at/1000,'unixepoch','+9 hours')
 WHERE purpose='tree-sale';
-- Old successful sales have already consumed their reserved items. Never consume a new tree on recovery.
UPDATE tree_factory_payments SET finalized_at=updated_at
 WHERE purpose='tree-sale' AND state='succeeded';
DROP INDEX tree_factory_one_tree_sale;
CREATE UNIQUE INDEX tree_factory_tree_sale_daily
 ON tree_factory_payments(user_id,business_date)
 WHERE purpose='tree-sale' AND business_date IS NOT NULL
 AND state IN ('creating','ready','submitted','pending','succeeded');
