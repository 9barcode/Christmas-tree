-- Distinguish fixed tree-sale payouts from the existing bell-exchange promotion.
ALTER TABLE tree_factory_payments ADD COLUMN purpose TEXT NOT NULL DEFAULT 'exchange'
 CHECK(purpose IN ('exchange','tree-sale'));
ALTER TABLE tree_factory_payments ADD COLUMN business_date TEXT;
ALTER TABLE tree_factory_payments ADD COLUMN finalized_at INTEGER;
ALTER TABLE tree_factory_payments ADD COLUMN finalization_token TEXT;
CREATE UNIQUE INDEX tree_factory_tree_sale_daily
 ON tree_factory_payments(user_id,business_date)
 WHERE purpose='tree-sale' AND business_date IS NOT NULL
 AND state IN ('creating','ready','submitted','pending','succeeded');
