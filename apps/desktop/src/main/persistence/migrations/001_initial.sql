CREATE TABLE review_projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ready', 'processing', 'review', 'error')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_opened_at TEXT NOT NULL
) STRICT;

CREATE TABLE recordings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE REFERENCES review_projects(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  stored_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_extension TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  imported_at TEXT NOT NULL
) STRICT;

CREATE INDEX recordings_sha256_idx ON recordings(sha256);

CREATE TABLE processing_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES review_projects(id) ON DELETE CASCADE,
  recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  engine TEXT NOT NULL CHECK (engine = 'whisperx'),
  engine_version TEXT,
  model TEXT NOT NULL CHECK (model IN ('medium', 'large-v3')),
  language TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'partial', 'completed', 'failed')),
  current_stage TEXT NOT NULL CHECK (current_stage IN ('queued', 'transcription', 'alignment', 'diarization', 'complete')),
  transcription_outcome TEXT NOT NULL CHECK (transcription_outcome IN ('pending', 'running', 'succeeded', 'failed', 'skipped')),
  alignment_outcome TEXT NOT NULL CHECK (alignment_outcome IN ('pending', 'running', 'succeeded', 'failed', 'skipped')),
  diarization_outcome TEXT NOT NULL CHECK (diarization_outcome IN ('pending', 'running', 'succeeded', 'failed', 'skipped')),
  started_at TEXT,
  completed_at TEXT,
  elapsed_ms INTEGER CHECK (elapsed_ms IS NULL OR elapsed_ms >= 0),
  error_code TEXT,
  error_message TEXT
) STRICT;

CREATE INDEX processing_runs_project_idx ON processing_runs(project_id, started_at);

CREATE TABLE speakers (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES review_projects(id) ON DELETE CASCADE,
  diarization_label TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (project_id, diarization_label)
) STRICT;

CREATE TABLE transcript_segments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES review_projects(id) ON DELETE CASCADE,
  processing_run_id TEXT NOT NULL REFERENCES processing_runs(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK (sequence >= 0),
  start_ms INTEGER NOT NULL CHECK (start_ms >= 0),
  end_ms INTEGER NOT NULL CHECK (end_ms >= start_ms),
  original_text TEXT NOT NULL,
  text TEXT NOT NULL,
  original_speaker_id TEXT REFERENCES speakers(id) ON DELETE SET NULL,
  speaker_id TEXT REFERENCES speakers(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (project_id, sequence)
) STRICT;

CREATE INDEX transcript_segments_time_idx ON transcript_segments(project_id, start_ms, end_ms);

CREATE TABLE transcript_words (
  id TEXT PRIMARY KEY,
  segment_id TEXT NOT NULL REFERENCES transcript_segments(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK (sequence >= 0),
  text TEXT NOT NULL,
  start_ms INTEGER CHECK (start_ms IS NULL OR start_ms >= 0),
  end_ms INTEGER CHECK (end_ms IS NULL OR end_ms >= start_ms),
  alignment_score REAL CHECK (alignment_score IS NULL OR (alignment_score >= 0 AND alignment_score <= 1)),
  UNIQUE (segment_id, sequence)
) STRICT;

CREATE TABLE playback_states (
  project_id TEXT PRIMARY KEY REFERENCES review_projects(id) ON DELETE CASCADE,
  position_ms INTEGER NOT NULL DEFAULT 0 CHECK (position_ms >= 0),
  playback_rate REAL NOT NULL DEFAULT 1.0 CHECK (playback_rate >= 0.5 AND playback_rate <= 3.0),
  updated_at TEXT NOT NULL
) STRICT;
