-- Existing exchange payments keep their wallet behavior.
ALTER TABLE tree_factory_payments ADD COLUMN purpose TEXT NOT NULL DEFAULT 'exchange' CHECK(purpose IN ('exchange','tree-sale'));
ALTER TABLE tree_factory_items ADD COLUMN tree_sale_payment_id TEXT;
CREATE UNIQUE INDEX tree_factory_one_tree_sale ON tree_factory_payments(user_id) WHERE purpose='tree-sale' AND state<>'failed';
CREATE INDEX tree_factory_sale_items ON tree_factory_items(tree_sale_payment_id);
