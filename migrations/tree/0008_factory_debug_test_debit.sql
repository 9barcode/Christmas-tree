-- Distinguish test-only debug exchanges so successful test-code payments keep the wallet debit.
ALTER TABLE tree_factory_payments ADD COLUMN debug_test INTEGER NOT NULL DEFAULT 0 CHECK(debug_test IN (0,1));
