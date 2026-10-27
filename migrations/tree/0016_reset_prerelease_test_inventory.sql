-- One-time pre-release reset of accounts existing at migration time.
-- Payment/inventory snapshots stay in D1; no external promotion is executed here.
CREATE TABLE tree_test_reset_20261027_users AS SELECT id AS user_id FROM tree_users WHERE toss_user_key LIKE 'anon:%';
CREATE TABLE tree_test_reset_20261027_guard(ok INTEGER CHECK(ok=1));
-- Never erase a transfer that might still settle.
INSERT INTO tree_test_reset_20261027_guard SELECT CASE WHEN EXISTS(
 SELECT 1 FROM tree_factory_payments WHERE user_id IN(SELECT user_id FROM tree_test_reset_20261027_users)
 AND state NOT IN('succeeded','failed')
) THEN 0 ELSE 1 END;
CREATE TABLE tree_test_reset_20261027_items AS SELECT * FROM tree_factory_items WHERE user_id IN(SELECT user_id FROM tree_test_reset_20261027_users);
CREATE TABLE tree_test_reset_20261027_collection AS SELECT * FROM tree_factory_collection WHERE user_id IN(SELECT user_id FROM tree_test_reset_20261027_users);
CREATE TABLE tree_test_reset_20261027_layout AS SELECT * FROM tree_factory_layout WHERE user_id IN(SELECT user_id FROM tree_test_reset_20261027_users);
CREATE TABLE tree_test_reset_20261027_ad_gates AS SELECT * FROM tree_factory_ad_gates WHERE user_id IN(SELECT user_id FROM tree_test_reset_20261027_users);
CREATE TABLE tree_test_reset_20261027_imports AS SELECT * FROM tree_factory_imports WHERE user_id IN(SELECT user_id FROM tree_test_reset_20261027_users);
CREATE TABLE tree_test_reset_20261027_payments AS SELECT * FROM tree_factory_payments WHERE purpose='tree-sale' AND user_id IN(SELECT user_id FROM tree_test_reset_20261027_users);
CREATE TABLE tree_test_reset_20261027_ledger AS SELECT * FROM tree_factory_ledger WHERE id='tree-sale:'||user_id AND user_id IN(SELECT user_id FROM tree_test_reset_20261027_users);
DELETE FROM tree_factory_items WHERE user_id IN(SELECT user_id FROM tree_test_reset_20261027_users);
DELETE FROM tree_factory_payments WHERE purpose='tree-sale' AND user_id IN(SELECT user_id FROM tree_test_reset_20261027_users);
DELETE FROM tree_factory_ledger WHERE id='tree-sale:'||user_id AND user_id IN(SELECT user_id FROM tree_test_reset_20261027_users);
DELETE FROM tree_factory_ad_gates WHERE purpose IN('sell','tree-sale') AND user_id IN(SELECT user_id FROM tree_test_reset_20261027_users);
-- Mark legacy import complete so old decorations cannot reappear.
INSERT INTO tree_factory_imports(user_id,token,created_at)
 SELECT user_id,'test-reset-20261027',unixepoch()*1000 FROM tree_test_reset_20261027_users WHERE true
 ON CONFLICT(user_id) DO NOTHING;
INSERT INTO tree_factory_layout(user_id,revision,pot_json)
 SELECT user_id,1,'{"x":50,"y":73.95}' FROM tree_test_reset_20261027_users WHERE true
 ON CONFLICT(user_id) DO UPDATE SET revision=tree_factory_layout.revision+1,pot_json=excluded.pot_json;
WITH catalog(asset_id,value,x,y) AS(VALUES
 ('gift-burgundy',1,23,69),
 ('gift-green-large',2,30,72),
 ('gift-cream',1,70,70),
 ('gift-green-small',1,81,72),
 ('bauble-burgundy-diamond',1,45.6,40.25),
 ('bauble-gold-stripe',1,54.4,40.25),
 ('bauble-green-snowflake',1,36.8,46.85),
 ('bauble-ivory-smile',3,45.6,46.85),
 ('bauble-red-smile',1,54.4,46.85),
 ('bell-brass',1,63.2,46.85),
 ('bow-red',1,32.4,53.45),
 ('candy-cane',1,41.2,53.45),
 ('cottage-snow',3,50,53.45),
 ('dove-ivory',1,58.8,53.45),
 ('drum-red',1,67.6,53.45),
 ('fairy-lights',2,50,49.05),
 ('gingerbread-house',2,28,60.05),
 ('gingerbread-man',1,36.8,60.05),
 ('heart-burgundy',1,45.6,60.05),
 ('mittens-green',1,54.4,60.05),
 ('pinecone',1,63.2,60.05),
 ('reindeer',2,72,60.05),
 ('rocking-horse',2,23.599999999999998,66.65),
 ('santa-hat',2,32.4,66.65),
 ('snowflake-ivory',1,41.2,66.65),
 ('snowman',2,50,66.65),
 ('stocking-red',1,58.8,66.65),
 ('teddy-bear',3,18,72),
 ('toy-car',3,76,69),
 ('star-gold',3,50,25.8365))
INSERT INTO tree_factory_items(id,user_id,asset_id,value,placed,x,y,source,created_at)
 SELECT 'test-reset-20261027:'||u.user_id||':'||c.asset_id,u.user_id,c.asset_id,c.value,1,c.x,c.y,
 'test-reset-20261027:'||u.user_id||':'||c.asset_id,unixepoch()*1000
 FROM tree_test_reset_20261027_users u CROSS JOIN catalog c;
INSERT INTO tree_factory_collection(user_id,asset_id,created_at)
 SELECT user_id,asset_id,created_at FROM tree_factory_items WHERE source LIKE 'test-reset-20261027:%'
 ON CONFLICT(user_id,asset_id) DO NOTHING;
-- Assert exactly one complete, placed tree per reset account.
INSERT INTO tree_test_reset_20261027_guard
 SELECT CASE WHEN EXISTS(SELECT 1 FROM tree_test_reset_20261027_users u WHERE
 (SELECT count(*) FROM tree_factory_items i WHERE i.user_id=u.user_id AND i.sold_at IS NULL)<>30 OR
 (SELECT count(DISTINCT asset_id) FROM tree_factory_items i WHERE i.user_id=u.user_id AND i.sold_at IS NULL AND placed=1)<>30
 ) THEN 0 ELSE 1 END;
DROP TABLE tree_test_reset_20261027_guard;
