-- The application enforces the daily limit atomically when reserving a payment.
-- The existing active-payment index still prevents concurrent pending payouts.
DROP INDEX IF EXISTS tree_factory_tree_sale_daily;
CREATE INDEX IF NOT EXISTS tree_factory_tree_sale_daily_lookup ON tree_factory_payments(user_id,business_date,state) WHERE purpose='tree-sale';
