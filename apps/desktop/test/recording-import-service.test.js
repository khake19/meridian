const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { RecordingImportService, sha256 } = require('../src/main/import/recording-import-service');
const { openMeridianDatabase } = require('../src/main/persistence/database');
const { ReviewProjectRepository } = require('../src/main/persistence/review-project-repository');

test('imports, verifies, and persists an immutable recording copy', async (context) => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian-import-'));
  const sourcePath = path.join(temporaryDirectory, 'Interview.WAV');
  const sourceContents = Buffer.from('representative audio bytes');
  fs.writeFileSync(sourcePath, sourceContents);

  const database = openMeridianDatabase(path.join(temporaryDirectory, 'meridian.db'));
  context.after(() => {
    database.close();
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  });
  const repository = new ReviewProjectRepository(database);
  const service = new RecordingImportService({
    projectsDirectory: path.join(temporaryDirectory, 'projects'),
    repository,
    inspectMedia: async () => ({ durationMs: 12345 }),
  });

  const imported = await service.import(sourcePath);
  const copiedPath = service.resolveStoredRecording(imported);

  assert.equal(imported.project.title, 'Interview');
  assert.equal(imported.recording.originalFilename, 'Interview.WAV');
  assert.equal(imported.recording.durationMs, 12345);
  assert.deepEqual(fs.readFileSync(sourcePath), sourceContents);
  assert.deepEqual(fs.readFileSync(copiedPath), sourceContents);
  assert.equal(await sha256(sourcePath), await sha256(copiedPath));
  assert.deepEqual(repository.getById(imported.project.id), imported);
});

test('rejects unsupported and empty recordings before creating a project', async (context) => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian-import-'));
  const database = openMeridianDatabase(path.join(temporaryDirectory, 'meridian.db'));
  context.after(() => {
    database.close();
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  });
  const service = new RecordingImportService({
    projectsDirectory: path.join(temporaryDirectory, 'projects'),
    repository: new ReviewProjectRepository(database),
    inspectMedia: async () => ({ durationMs: 1000 }),
  });
  const unsupported = path.join(temporaryDirectory, 'notes.txt');
  const empty = path.join(temporaryDirectory, 'empty.wav');
  fs.writeFileSync(unsupported, 'not audio');
  fs.writeFileSync(empty, '');

  await assert.rejects(service.import(unsupported), /Unsupported recording/);
  await assert.rejects(service.import(empty), /empty/);
  assert.equal(database.prepare('SELECT count(*) AS count FROM review_projects').get().count, 0);
});
