-- One-time grant to existing TreeMoa users; preserves user records and payment history.
-- Abort while a payout could still settle, rather than altering the tree during finalization.
CREATE TABLE tree_grant_20261027_guard (ok INTEGER NOT NULL CHECK(ok=1));
INSERT INTO tree_grant_20261027_guard(ok)
SELECT CASE WHEN EXISTS (
 SELECT 1 FROM tree_factory_payments
 WHERE state IN ('creating','ready','submitted','pending')
    OR (purpose='tree-sale' AND mode='live' AND state='succeeded' AND finalized_at IS NULL)
) THEN 0 ELSE 1 END;
DROP TABLE tree_grant_20261027_guard;

WITH catalog(asset_id,value) AS (VALUES
 ('gift-burgundy',1),
 ('gift-green-large',2),
 ('gift-cream',1),
 ('gift-green-small',1),
 ('bauble-burgundy-diamond',1),
 ('bauble-gold-stripe',1),
 ('bauble-green-snowflake',1),
 ('bauble-ivory-smile',3),
 ('bauble-red-smile',1),
 ('bell-brass',1),
 ('bow-red',1),
 ('candy-cane',1),
 ('cottage-snow',3),
 ('dove-ivory',1),
 ('drum-red',1),
 ('fairy-lights',2),
 ('gingerbread-house',2),
 ('gingerbread-man',1),
 ('heart-burgundy',1),
 ('mittens-green',1),
 ('pinecone',1),
 ('reindeer',2),
 ('rocking-horse',2),
 ('santa-hat',2),
 ('snowflake-ivory',1),
 ('snowman',2),
 ('stocking-red',1),
 ('teddy-bear',3),
 ('toy-car',3),
 ('star-gold',3)
)
INSERT INTO tree_factory_items(id,user_id,asset_id,value,placed,source,created_at)
SELECT 'grant-20261027-v2:'||u.id||':'||c.asset_id||':'||n.slot,u.id,c.asset_id,c.value,0,
 'grant-20261027-v2:'||u.id||':'||c.asset_id||':'||n.slot,unixepoch()*1000
FROM tree_users u CROSS JOIN catalog c CROSS JOIN (SELECT 1 AS slot UNION ALL SELECT 2) n
WHERE u.toss_user_key LIKE 'anon:%'
 AND n.slot > (SELECT count(*) FROM tree_factory_items i WHERE i.user_id=u.id AND i.asset_id=c.asset_id AND i.sold_at IS NULL)
ON CONFLICT DO NOTHING;

WITH catalog(asset_id,value) AS (VALUES
 ('gift-burgundy',1),
 ('gift-green-large',2),
 ('gift-cream',1),
 ('gift-green-small',1),
 ('bauble-burgundy-diamond',1),
 ('bauble-gold-stripe',1),
 ('bauble-green-snowflake',1),
 ('bauble-ivory-smile',3),
 ('bauble-red-smile',1),
 ('bell-brass',1),
 ('bow-red',1),
 ('candy-cane',1),
 ('cottage-snow',3),
 ('dove-ivory',1),
 ('drum-red',1),
 ('fairy-lights',2),
 ('gingerbread-house',2),
 ('gingerbread-man',1),
 ('heart-burgundy',1),
 ('mittens-green',1),
 ('pinecone',1),
 ('reindeer',2),
 ('rocking-horse',2),
 ('santa-hat',2),
 ('snowflake-ivory',1),
 ('snowman',2),
 ('stocking-red',1),
 ('teddy-bear',3),
 ('toy-car',3),
 ('star-gold',3)
)
INSERT INTO tree_factory_collection(user_id,asset_id,created_at)
SELECT u.id,c.asset_id,unixepoch()*1000 FROM tree_users u CROSS JOIN catalog c
WHERE u.toss_user_key LIKE 'anon:%'
ON CONFLICT(user_id,asset_id) DO NOTHING;
