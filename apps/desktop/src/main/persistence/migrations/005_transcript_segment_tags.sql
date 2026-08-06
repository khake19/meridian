CREATE TABLE transcript_segment_tags (
  segment_id TEXT NOT NULL REFERENCES transcript_segments(id) ON DELETE CASCADE,
  tag_code TEXT NOT NULL CHECK (tag_code IN (
    'admission', 'denial', 'key_statement', 'timeline',
    'witness_mentioned', 'policy_referenced', 'inconsistency', 'action_item'
  )),
  created_at TEXT NOT NULL,
  PRIMARY KEY (segment_id, tag_code)
) STRICT;

CREATE INDEX transcript_segment_tags_code_idx
  ON transcript_segment_tags(tag_code, segment_id);
