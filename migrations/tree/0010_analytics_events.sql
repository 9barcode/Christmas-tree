CREATE TABLE IF NOT EXISTS tree_analytics_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES tree_users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL CHECK(method IN ('GET','POST')),
  status INTEGER NOT NULL CHECK(status BETWEEN 0 AND 599),
  duration_ms INTEGER NOT NULL CHECK(duration_ms BETWEEN 0 AND 60000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS tree_analytics_events_created_at_idx
  ON tree_analytics_events(created_at);
CREATE INDEX IF NOT EXISTS tree_analytics_events_user_created_at_idx
  ON tree_analytics_events(user_id,created_at DESC);
