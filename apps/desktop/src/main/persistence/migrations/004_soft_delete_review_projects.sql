ALTER TABLE review_projects ADD COLUMN deleted_at TEXT;

CREATE INDEX review_projects_visible_recent_idx
ON review_projects(last_opened_at DESC)
WHERE deleted_at IS NULL;
