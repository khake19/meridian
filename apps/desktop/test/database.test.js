const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { openMeridianDatabase } = require('../src/main/persistence/database');

test('initial migration creates the Meridian persistence schema', (context) => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian-db-'));
  context.after(() => fs.rmSync(temporaryDirectory, { recursive: true, force: true }));

  const database = openMeridianDatabase(path.join(temporaryDirectory, 'meridian.db'));
  context.after(() => database.close());

  const tables = database.prepare(`
    SELECT name FROM sqlite_schema
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all().map((row) => row.name);

  assert.deepEqual(tables, [
    'playback_states',
    'processing_runs',
    'recordings',
    'review_projects',
    'schema_migrations',
    'speakers',
    'transcript_segments',
    'transcript_words',
  ]);
  assert.equal(database.prepare('SELECT count(*) AS count FROM schema_migrations').get().count, 1);
  assert.equal(database.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
  assert.equal(database.prepare('PRAGMA journal_mode').get().journal_mode, 'wal');
});

test('recording constraints preserve one immutable source per review project', (context) => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian-db-'));
  context.after(() => fs.rmSync(temporaryDirectory, { recursive: true, force: true }));
  const database = openMeridianDatabase(path.join(temporaryDirectory, 'meridian.db'));
  context.after(() => database.close());

  const now = new Date().toISOString();
  database.prepare(`
    INSERT INTO review_projects (id, title, status, created_at, updated_at, last_opened_at)
    VALUES (?, ?, 'ready', ?, ?, ?)
  `).run('project-1', 'Interview', now, now, now);
  database.prepare(`
    INSERT INTO recordings (
      id, project_id, original_filename, stored_filename, mime_type,
      file_extension, size_bytes, duration_ms, sha256, imported_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'recording-1', 'project-1', 'interview.wav', 'recordings/original.wav',
    'audio/wav', '.wav', 42, 1000, 'a'.repeat(64), now,
  );

  assert.throws(() => database.prepare(`
    INSERT INTO recordings (
      id, project_id, original_filename, stored_filename, mime_type,
      file_extension, size_bytes, duration_ms, sha256, imported_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'recording-2', 'project-1', 'second.wav', 'recordings/second.wav',
    'audio/wav', '.wav', 42, 1000, 'b'.repeat(64), now,
  ), /UNIQUE constraint failed/);
});
