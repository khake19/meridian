ALTER TABLE transcript_segments ADD COLUMN deleted_at TEXT;

CREATE INDEX transcript_segments_visible_idx
ON transcript_segments(project_id, sequence)
WHERE deleted_at IS NULL;
