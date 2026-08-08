ALTER TABLE processing_runs
ADD COLUMN speaker_count INTEGER
CHECK (speaker_count IS NULL OR speaker_count IN (2, 3, 4));
