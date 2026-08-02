const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { openMeridianDatabase } = require('../src/main/persistence/database');
const { ReviewProjectRepository } = require('../src/main/persistence/review-project-repository');

function createFixture(context) {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian-repository-'));
  const database = openMeridianDatabase(path.join(temporaryDirectory, 'meridian.db'));
  context.after(() => {
    database.close();
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  });
  return new ReviewProjectRepository(database);
}

function projectInput(id, timestamp) {
  return {
    project: {
      id,
      title: `Interview ${id}`,
      status: 'ready',
      createdAt: timestamp,
      updatedAt: timestamp,
      lastOpenedAt: timestamp,
    },
    recording: {
      id: `recording-${id}`,
      originalFilename: `${id}.wav`,
      storedFilename: 'recordings/original.wav',
      mimeType: 'audio/wav',
      fileExtension: '.wav',
      sizeBytes: 1024,
      durationMs: 5000,
      sha256: id.padEnd(64, 'a').slice(0, 64),
      importedAt: timestamp,
    },
  };
}

test('creates and restores a complete review project atomically', (context) => {
  const repository = createFixture(context);
  const timestamp = '2026-08-02T00:00:00.000Z';
  const created = repository.createWithRecording(projectInput('one', timestamp));

  assert.equal(created.project.title, 'Interview one');
  assert.equal(created.recording.projectId, 'one');
  assert.equal(created.playback.positionMs, 0);
  assert.equal(created.playback.playbackRate, 1);
  assert.deepEqual(repository.findRecordingByHash('one'.padEnd(64, 'a')), created.recording);
});

test('lists recent projects and updates last-opened time', (context) => {
  const repository = createFixture(context);
  repository.createWithRecording(projectInput('older', '2026-08-01T00:00:00.000Z'));
  repository.createWithRecording(projectInput('newer', '2026-08-02T00:00:00.000Z'));

  assert.deepEqual(repository.listRecent().map((project) => project.id), ['newer', 'older']);
  assert.equal(repository.markOpened('older', '2026-08-03T00:00:00.000Z'), true);
  assert.deepEqual(repository.listRecent().map((project) => project.id), ['older', 'newer']);
  assert.throws(() => repository.listRecent(0), /between 1 and 100/);
});

test('saves and restores playback position and speed', (context) => {
  const repository = createFixture(context);
  const timestamp = '2026-08-02T00:00:00.000Z';
  repository.createWithRecording(projectInput('playback', timestamp));

  assert.equal(repository.savePlaybackState(
    'playback', 42500, 1.5, '2026-08-02T00:01:00.000Z',
  ), true);
  assert.deepEqual(repository.getById('playback').playback, {
    projectId: 'playback',
    positionMs: 42500,
    playbackRate: 1.5,
    updatedAt: '2026-08-02T00:01:00.000Z',
  });
});
