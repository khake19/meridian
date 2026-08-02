const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { openMeridianDatabase } = require('../src/main/persistence/database');
const { ProcessingRepository } = require('../src/main/persistence/processing-repository');
const { ReviewProjectRepository } = require('../src/main/persistence/review-project-repository');

function fixture(context) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian-processing-'));
  const database = openMeridianDatabase(path.join(directory, 'meridian.db'));
  context.after(() => {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const now = '2026-08-02T01:00:00.000Z';
  new ReviewProjectRepository(database).createWithRecording({
    project: { id: 'project', title: 'Interview', status: 'ready', createdAt: now, updatedAt: now, lastOpenedAt: now },
    recording: {
      id: 'recording', originalFilename: 'interview.wav', storedFilename: 'recordings/original.wav',
      mimeType: 'audio/wav', fileExtension: '.wav', sizeBytes: 100, durationMs: 5000,
      sha256: 'a'.repeat(64), importedAt: now,
    },
  });
  return { database, repository: new ProcessingRepository(database), now };
}

test('persists processing stages and aligned transcript data', (context) => {
  const { database, repository, now } = fixture(context);
  repository.startRun({ id: 'run', projectId: 'project', recordingId: 'recording', model: 'medium', startedAt: now });
  repository.applyEvent({ jobId: 'run', type: 'stage.started', stage: 'transcription' }, now);
  repository.applyEvent({ jobId: 'run', type: 'stage.completed', stage: 'transcription' }, now);
  repository.applyEvent({
    jobId: 'run', type: 'stage.failed', stage: 'alignment', code: 'ALIGNMENT_FAILED',
    message: 'Raw transcript preserved.', recoverable: true,
  }, now);
  repository.applyEvent({ jobId: 'run', type: 'stage.skipped', stage: 'diarization', reason: 'Not configured.' }, now);
  repository.applyEvent({
    jobId: 'run', type: 'job.completed', backend: 'whisperx', model: 'medium', language: 'tl',
    elapsedMs: 4200, status: 'partial',
    segments: [{
      start: 1.234, end: 2.5, text: ' Kumusta po.', speaker: 'SPEAKER_00',
      words: [{ word: 'Kumusta', start: 1.234, end: 1.8, score: 0.72 }],
    }],
  }, now);

  const run = repository.getLatestForProject('project');
  const transcript = repository.getTranscript('project');
  assert.equal(run.status, 'partial');
  assert.equal(run.transcriptionOutcome, 'succeeded');
  assert.equal(run.alignmentOutcome, 'failed');
  assert.equal(run.diarizationOutcome, 'skipped');
  assert.equal(run.errorCode, 'ALIGNMENT_FAILED');
  assert.equal(transcript[0].startMs, 1234);
  assert.equal(transcript[0].originalText, ' Kumusta po.');
  assert.equal(transcript[0].text, ' Kumusta po.');
  assert.equal(transcript[0].words[0].alignmentScore, 0.72);
  assert.equal(database.prepare('SELECT status FROM review_projects WHERE id = ?').get('project').status, 'review');
});

test('persists terminal processing failures without deleting prior data', (context) => {
  const { database, repository, now } = fixture(context);
  repository.startRun({ id: 'failed-run', projectId: 'project', recordingId: 'recording', model: 'large-v3', startedAt: now });
  repository.applyEvent({
    jobId: 'failed-run', type: 'job.failed', code: 'OUT_OF_MEMORY', message: 'Not enough memory.',
  }, '2026-08-02T01:01:00.000Z');

  const run = repository.getLatestForProject('project');
  assert.equal(run.status, 'failed');
  assert.equal(run.errorCode, 'OUT_OF_MEMORY');
  assert.equal(database.prepare('SELECT status FROM review_projects WHERE id = ?').get('project').status, 'error');
});
