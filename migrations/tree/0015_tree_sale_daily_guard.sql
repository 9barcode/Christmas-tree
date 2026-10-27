-- Keep deployed migrations immutable. Completed payments and balances are preserved.
CREATE UNIQUE INDEX tree_factory_tree_sale_pending ON tree_factory_payments(user_id)
 WHERE purpose='tree-sale' AND (state IN ('creating','ready','submitted','pending')
 OR (state='succeeded' AND finalized_at IS NULL));
-- Atomic daily budget, including payments already reserved and legacy bell payouts.
CREATE TRIGGER tree_factory_tree_sale_daily_cap BEFORE INSERT ON tree_factory_payments
WHEN NEW.purpose='tree-sale' AND NEW.state IN ('creating','ready','submitted','pending','succeeded')
BEGIN
 SELECT RAISE(IGNORE) WHERE NEW.business_date IS NULL OR
 (SELECT count(*) FROM tree_factory_payments WHERE user_id=NEW.user_id
  AND purpose='tree-sale' AND business_date=NEW.business_date
  AND state IN ('creating','ready','submitted','pending','succeeded'))
 + (SELECT count(*) FROM tree_factory_ledger WHERE id='tree-sale:'||NEW.user_id
  AND date(created_at/1000,'unixepoch','+9 hours')=NEW.business_date) >= 5;
END;
