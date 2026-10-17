-- Preserve whether a completed settlement was a test simulation rather than a live transfer.
ALTER TABLE treemoa_settlements ADD COLUMN tested_at TEXT;
