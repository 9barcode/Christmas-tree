-- One-time, user-authorized grant. Fail closed on a tie, an empty population, or an active payout.
CREATE TABLE IF NOT EXISTS tree_admin_decoration_grants (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES tree_users(id),
 owned_before INTEGER NOT NULL,
 inserted_count INTEGER,
 completed_at INTEGER
);
WITH counts AS (
 SELECT u.id AS user_id,count(i.id) AS n FROM tree_users u
 LEFT JOIN tree_factory_items i ON i.user_id=u.id AND i.sold_at IS NULL
 WHERE u.toss_user_key LIKE 'anon:%' GROUP BY u.id
), leaders AS (
 SELECT * FROM counts WHERE n=(SELECT n FROM counts ORDER BY n DESC LIMIT 1 OFFSET 1) AND n>0
)
INSERT INTO tree_admin_decoration_grants(id,user_id,owned_before)
SELECT 'owner-second-fill-20261027',
 (SELECT user_id FROM leaders WHERE (SELECT count(*) FROM leaders)=1
 AND NOT EXISTS(SELECT 1 FROM tree_factory_payments p WHERE p.user_id=leaders.user_id
 AND (p.state NOT IN ('succeeded','failed') OR (p.purpose='tree-sale' AND p.mode='live' AND p.state='succeeded' AND p.finalized_at IS NULL)))),
 COALESCE((SELECT max(n) FROM leaders),0)
WHERE EXISTS(SELECT 1 FROM leaders)
 AND NOT EXISTS(SELECT 1 FROM tree_admin_decoration_grants WHERE id='owner-second-fill-20261027');
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
SELECT 'admin:'||g.id||':'||g.user_id||':'||c.asset_id,g.user_id,c.asset_id,c.value,0,
 'admin:'||g.id||':'||g.user_id||':'||c.asset_id,unixepoch()*1000
FROM tree_admin_decoration_grants g CROSS JOIN catalog c
WHERE g.id='owner-second-fill-20261027' AND g.completed_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM tree_factory_items i WHERE i.user_id=g.user_id AND i.asset_id=c.asset_id AND i.sold_at IS NULL);
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
SELECT g.user_id,c.asset_id,unixepoch()*1000
FROM tree_admin_decoration_grants g CROSS JOIN catalog c
WHERE g.id='owner-second-fill-20261027' AND g.completed_at IS NULL
ON CONFLICT(user_id,asset_id) DO NOTHING;
UPDATE tree_admin_decoration_grants SET
 inserted_count=(SELECT count(*) FROM tree_factory_items i WHERE i.user_id=tree_admin_decoration_grants.user_id AND i.source LIKE 'admin:owner-second-fill-20261027:%'),
 completed_at=unixepoch()*1000
WHERE id='owner-second-fill-20261027' AND completed_at IS NULL;
