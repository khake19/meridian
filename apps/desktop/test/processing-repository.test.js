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

  assert.equal(repository.updateSegmentText('project', transcript[0].id, 'Corrected text.', now), true);
  const corrected = repository.getTranscript('project')[0];
  assert.equal(corrected.originalText, ' Kumusta po.');
  assert.equal(corrected.text, 'Corrected text.');

  const speakerId = repository.createSpeaker('project', 'Interviewer', now);
  assert.equal(repository.assignSegmentSpeaker('project', corrected.id, speakerId, now), true);
  assert.equal(repository.renameSpeaker('project', speakerId, 'Investigator', now), true);
  assert.equal(repository.getTranscript('project')[0].speakerId, speakerId);
  assert.equal(repository.getSpeakers('project').find((speaker) => speaker.id === speakerId).displayName, 'Investigator');
  assert.equal(repository.updateSegmentText('another-project', corrected.id, 'Forbidden', now), false);

  repository.startRun({
    id: 'rerun', projectId: 'project', recordingId: 'recording', model: 'large-v3',
    startedAt: '2026-08-02T02:00:00.000Z',
  });
  repository.applyEvent({
    jobId: 'rerun', type: 'job.completed', backend: 'whisperx', model: 'large-v3',
    language: 'en', elapsedMs: 2000, status: 'completed',
    segments: [{ start: 0, end: 1, text: 'New transcript.' }],
  }, '2026-08-02T02:01:00.000Z');
  const backups = repository.getTranscriptBackups('project');
  assert.equal(backups.length, 1);
  assert.equal(backups[0].payload.segments[0].text, 'Corrected text.');
  assert.equal(backups[0].payload.segments[0].originalText, ' Kumusta po.');
  assert.equal(repository.getTranscript('project')[0].text, 'New transcript.');
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

test('inserts a manual conversation chronologically without changing original transcript text', (context) => {
  const { repository, now } = fixture(context);
  repository.startRun({ id: 'run', projectId: 'project', recordingId: 'recording', model: 'medium', startedAt: now });
  repository.applyEvent({
    jobId: 'run', type: 'job.completed', backend: 'whisperx', model: 'medium', language: 'en',
    elapsedMs: 1000, status: 'completed',
    segments: [
      { start: 0, end: 1, text: 'First.' },
      { start: 4, end: 5, text: 'Last.' },
    ],
  }, now);

  const manualId = repository.createManualSegment('project', 2500, now);
  const transcript = repository.getTranscript('project');
  assert.deepEqual(transcript.map((segment) => segment.sequence), [0, 1, 2]);
  assert.deepEqual(transcript.map((segment) => segment.text), ['First.', '', 'Last.']);
  assert.equal(transcript[1].id, manualId);
  assert.equal(transcript[1].startMs, 2500);
  assert.equal(transcript[1].endMs, 5000);
  assert.equal(transcript[1].originalText, '');

  assert.equal(repository.deleteSegment('project', manualId, now), true);
  assert.deepEqual(repository.getTranscript('project').map((segment) => segment.text), ['First.', 'Last.']);
  const deleted = repository.getTranscript('project', { includeDeleted: true }).find((segment) => segment.id === manualId);
  assert.equal(deleted.deletedAt, now);
  assert.equal(repository.restoreSegment('project', manualId, now), true);
  assert.deepEqual(repository.getTranscript('project').map((segment) => segment.text), ['First.', '', 'Last.']);

  const deletionToken = repository.deleteTranscript('project', '2026-08-02T01:10:00.000Z');
  assert.equal(deletionToken, '2026-08-02T01:10:00.000Z');
  assert.equal(repository.getTranscript('project').length, 0);
  assert.equal(repository.restoreTranscriptDeletion('project', deletionToken, now), 3);
  assert.deepEqual(repository.getTranscript('project').map((segment) => segment.text), ['First.', '', 'Last.']);
});

test('recovers abandoned running jobs without deleting project data', (context) => {
  const { database, repository, now } = fixture(context);
  repository.startRun({
    id: 'interrupted-run', projectId: 'project', recordingId: 'recording', model: 'medium', startedAt: now,
  });
  assert.equal(repository.recoverInterruptedRuns('2026-08-02T01:05:00.000Z'), 1);
  const run = repository.getLatestForProject('project');
  assert.equal(run.status, 'failed');
  assert.equal(run.errorCode, 'PROCESS_INTERRUPTED');
  assert.match(run.errorMessage, /retry/);
  assert.equal(database.prepare('SELECT status FROM review_projects WHERE id = ?').get('project').status, 'error');
  assert.equal(repository.recoverInterruptedRuns(), 0);
});

test('cancels a running job without marking the project as an error', (context) => {
  const { database, repository, now } = fixture(context);
  repository.startRun({
    id: 'cancelled-run', projectId: 'project', recordingId: 'recording', model: 'medium', startedAt: now,
  });
  assert.equal(repository.cancelRun('cancelled-run', '2026-08-02T01:02:00.000Z'), true);
  const run = repository.getLatestForProject('project');
  assert.equal(run.status, 'failed');
  assert.equal(run.errorCode, 'PROCESS_CANCELLED');
  assert.equal(database.prepare('SELECT status FROM review_projects WHERE id = ?').get('project').status, 'ready');
  assert.equal(repository.cancelRun('cancelled-run'), false);
});

test('moves a conversation in time, shifts its words, and preserves its duration', (context) => {
  const { repository, now } = fixture(context);
  repository.startRun({ id: 'timing-run', projectId: 'project', recordingId: 'recording', model: 'medium', startedAt: now });
  repository.applyEvent({
    jobId: 'timing-run', type: 'job.completed', backend: 'whisperx', model: 'medium', language: 'en',
    elapsedMs: 1000, status: 'completed',
    segments: [{
      start: 1, end: 2.5, text: 'Move me.',
      words: [{ word: 'Move', start: 1.1, end: 1.5, score: 0.9 }],
    }],
  }, now);
  const segment = repository.getTranscript('project')[0];
  assert.equal(repository.updateSegmentTime('project', segment.id, 3000, now), true);
  const moved = repository.getTranscript('project')[0];
  assert.equal(moved.startMs, 3000);
  assert.equal(moved.endMs, 4500);
  assert.equal(moved.words[0].startMs, 3100);
  assert.equal(moved.words[0].endMs, 3500);
  assert.equal(repository.updateSegmentTime('project', 'missing', 1000, now), false);
});
