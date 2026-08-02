CREATE TABLE transcript_backups (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES review_projects(id) ON DELETE CASCADE,
  processing_run_id TEXT NOT NULL REFERENCES processing_runs(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('retranscription')),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX transcript_backups_project_idx ON transcript_backups(project_id, created_at);
