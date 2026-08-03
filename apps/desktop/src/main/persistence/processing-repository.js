const crypto = require('node:crypto');

function milliseconds(seconds) {
  return typeof seconds === 'number' && Number.isFinite(seconds)
    ? Math.max(0, Math.round(seconds * 1000))
    : null;
}

function mapRun(run) {
  if (!run) return null;
  return {
    id: run.id,
    projectId: run.project_id,
    recordingId: run.recording_id,
    engine: run.engine,
    engineVersion: run.engine_version,
    model: run.model,
    language: run.language,
    status: run.status,
    currentStage: run.current_stage,
    transcriptionOutcome: run.transcription_outcome,
    alignmentOutcome: run.alignment_outcome,
    diarizationOutcome: run.diarization_outcome,
    startedAt: run.started_at,
    completedAt: run.completed_at,
    elapsedMs: run.elapsed_ms,
    errorCode: run.error_code,
    errorMessage: run.error_message,
  };
}

class ProcessingRepository {
  constructor(database) {
    this.database = database;
  }

  startRun({ id, projectId, recordingId, model, startedAt }) {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      this.database.prepare(`
        INSERT INTO processing_runs (
          id, project_id, recording_id, engine, model, status, current_stage,
          transcription_outcome, alignment_outcome, diarization_outcome, started_at
        ) VALUES (?, ?, ?, 'whisperx', ?, 'running', 'queued', 'pending', 'pending', 'pending', ?)
      `).run(id, projectId, recordingId, model, startedAt);
      this.database.prepare(`
        UPDATE review_projects SET status = 'processing', updated_at = ? WHERE id = ?
      `).run(startedAt, projectId);
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  applyEvent(event, occurredAt = new Date().toISOString()) {
    if (!event.jobId) return;
    if (event.type === 'stage.started') {
      this.#updateStage(event.jobId, event.stage, 'running', occurredAt);
    } else if (event.type === 'stage.completed') {
      this.#updateStage(event.jobId, event.stage, 'succeeded', occurredAt);
    } else if (event.type === 'stage.failed') {
      this.#updateStage(event.jobId, event.stage, 'failed', occurredAt, event.code, event.message);
    } else if (event.type === 'stage.skipped') {
      this.#updateStage(event.jobId, event.stage, 'skipped', occurredAt);
    } else if (event.type === 'job.completed') {
      this.#saveCompleted(event, occurredAt);
    } else if (event.type === 'job.failed') {
      this.#saveFailed(event, occurredAt);
    }
  }

  #updateStage(runId, stage, outcome, occurredAt, errorCode = null, errorMessage = null) {
    const column = {
      transcription: 'transcription_outcome',
      alignment: 'alignment_outcome',
      diarization: 'diarization_outcome',
    }[stage];
    if (!column) return;
    this.database.prepare(`
      UPDATE processing_runs
      SET current_stage = ?, ${column} = ?,
        error_code = COALESCE(?, error_code),
        error_message = COALESCE(?, error_message)
      WHERE id = ?
    `).run(stage, outcome, errorCode, errorMessage, runId);
  }

  #saveCompleted(event, occurredAt) {
    const run = this.database.prepare('SELECT * FROM processing_runs WHERE id = ?').get(event.jobId);
    if (!run) return;
    const previousTranscript = this.getTranscript(run.project_id);
    const previousSpeakers = this.getSpeakers(run.project_id);
    this.database.exec('BEGIN IMMEDIATE');
    try {
      if (previousTranscript.length > 0) {
        this.database.prepare(`
          INSERT INTO transcript_backups (
            id, project_id, processing_run_id, reason, payload_json, created_at
          ) VALUES (?, ?, ?, 'retranscription', ?, ?)
        `).run(
          crypto.randomUUID(),
          run.project_id,
          run.id,
          JSON.stringify({ segments: previousTranscript, speakers: previousSpeakers }),
          occurredAt,
        );
      }
      this.database.prepare('DELETE FROM transcript_segments WHERE project_id = ?').run(run.project_id);
      const speakers = new Map();
      for (const segment of event.segments) {
        const label = typeof segment.speaker === 'string' ? segment.speaker : null;
        if (label && !speakers.has(label)) {
          const speakerId = crypto.randomUUID();
          speakers.set(label, speakerId);
          this.database.prepare(`
            INSERT INTO speakers (id, project_id, diarization_label, display_name, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(project_id, diarization_label) DO UPDATE SET updated_at = excluded.updated_at
          `).run(speakerId, run.project_id, label, label, occurredAt, occurredAt);
          const stored = this.database.prepare(`
            SELECT id FROM speakers WHERE project_id = ? AND diarization_label = ?
          `).get(run.project_id, label);
          speakers.set(label, stored.id);
        }
      }

      const insertSegment = this.database.prepare(`
        INSERT INTO transcript_segments (
          id, project_id, processing_run_id, sequence, start_ms, end_ms,
          original_text, text, original_speaker_id, speaker_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertWord = this.database.prepare(`
        INSERT INTO transcript_words (
          id, segment_id, sequence, text, start_ms, end_ms, alignment_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      event.segments.forEach((segment, sequence) => {
        const segmentId = crypto.randomUUID();
        const startMs = milliseconds(segment.start) ?? 0;
        const endMs = Math.max(startMs, milliseconds(segment.end) ?? startMs);
        const text = typeof segment.text === 'string' ? segment.text : '';
        const speakerId = speakers.get(segment.speaker) || null;
        insertSegment.run(
          segmentId, run.project_id, run.id, sequence, startMs, endMs,
          text, text, speakerId, speakerId, occurredAt, occurredAt,
        );
        if (Array.isArray(segment.words)) {
          segment.words.forEach((word, wordSequence) => insertWord.run(
            crypto.randomUUID(), segmentId, wordSequence,
            typeof word.word === 'string' ? word.word : '',
            milliseconds(word.start), milliseconds(word.end),
            typeof word.score === 'number' ? word.score : null,
          ));
        }
      });

      this.database.prepare(`
        UPDATE processing_runs SET status = ?, current_stage = 'complete', model = ?,
          language = ?, completed_at = ?, elapsed_ms = ?,
          transcription_outcome = CASE WHEN transcription_outcome = 'pending' THEN 'succeeded' ELSE transcription_outcome END,
          alignment_outcome = CASE WHEN alignment_outcome = 'pending' THEN 'skipped' ELSE alignment_outcome END,
          diarization_outcome = CASE WHEN diarization_outcome = 'pending' THEN 'skipped' ELSE diarization_outcome END
        WHERE id = ?
      `).run(event.status, event.model || run.model, event.language, occurredAt, event.elapsedMs, event.jobId);
      this.database.prepare(`
        UPDATE review_projects SET status = 'review', updated_at = ? WHERE id = ?
      `).run(occurredAt, run.project_id);
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  #saveFailed(event, occurredAt) {
    const run = this.database.prepare('SELECT project_id FROM processing_runs WHERE id = ?').get(event.jobId);
    if (!run) return;
    this.database.exec('BEGIN IMMEDIATE');
    try {
      this.database.prepare(`
        UPDATE processing_runs SET status = 'failed', completed_at = ?, error_code = ?, error_message = ?
        WHERE id = ?
      `).run(occurredAt, event.code, event.message, event.jobId);
      this.database.prepare(`
        UPDATE review_projects SET status = 'error', updated_at = ? WHERE id = ?
      `).run(occurredAt, run.project_id);
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  getLatestForProject(projectId) {
    return mapRun(this.database.prepare(`
      SELECT * FROM processing_runs WHERE project_id = ? ORDER BY started_at DESC LIMIT 1
    `).get(projectId));
  }

  getTranscript(projectId) {
    const segments = this.database.prepare(`
      SELECT * FROM transcript_segments WHERE project_id = ? ORDER BY sequence
    `).all(projectId);
    const wordsStatement = this.database.prepare(`
      SELECT * FROM transcript_words WHERE segment_id = ? ORDER BY sequence
    `);
    return segments.map((segment) => ({
      id: segment.id,
      projectId: segment.project_id,
      processingRunId: segment.processing_run_id,
      sequence: segment.sequence,
      startMs: segment.start_ms,
      endMs: segment.end_ms,
      originalText: segment.original_text,
      text: segment.text,
      originalSpeakerId: segment.original_speaker_id,
      speakerId: segment.speaker_id,
      createdAt: segment.created_at,
      updatedAt: segment.updated_at,
      words: wordsStatement.all(segment.id).map((word) => ({
        id: word.id,
        segmentId: word.segment_id,
        sequence: word.sequence,
        text: word.text,
        startMs: word.start_ms,
        endMs: word.end_ms,
        alignmentScore: word.alignment_score,
      })),
    }));
  }

  getSpeakers(projectId) {
    return this.database.prepare(`
      SELECT * FROM speakers WHERE project_id = ? ORDER BY display_name, diarization_label
    `).all(projectId).map((speaker) => ({
      id: speaker.id,
      projectId: speaker.project_id,
      diarizationLabel: speaker.diarization_label,
      displayName: speaker.display_name,
      createdAt: speaker.created_at,
      updatedAt: speaker.updated_at,
    }));
  }

  recoverInterruptedRuns(recoveredAt = new Date().toISOString()) {
    const running = this.database.prepare(`
      SELECT id, project_id FROM processing_runs WHERE status = 'running'
    `).all();
    if (running.length === 0) return 0;
    this.database.exec('BEGIN IMMEDIATE');
    try {
      this.database.prepare(`
        UPDATE processing_runs
        SET status = 'failed', completed_at = ?, error_code = 'PROCESS_INTERRUPTED',
          error_message = 'Processing stopped before completion. The project remains available for retry.'
        WHERE status = 'running'
      `).run(recoveredAt);
      const updateProject = this.database.prepare(`
        UPDATE review_projects SET status = 'error', updated_at = ? WHERE id = ?
      `);
      for (const run of running) updateProject.run(recoveredAt, run.project_id);
      this.database.exec('COMMIT');
      return running.length;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  getTranscriptBackups(projectId) {
    return this.database.prepare(`
      SELECT id, project_id, processing_run_id, reason, payload_json, created_at
      FROM transcript_backups WHERE project_id = ? ORDER BY created_at DESC
    `).all(projectId).map((backup) => ({
      id: backup.id,
      projectId: backup.project_id,
      processingRunId: backup.processing_run_id,
      reason: backup.reason,
      payload: JSON.parse(backup.payload_json),
      createdAt: backup.created_at,
    }));
  }

  updateSegmentText(projectId, segmentId, text, updatedAt = new Date().toISOString()) {
    const result = this.database.prepare(`
      UPDATE transcript_segments SET text = ?, updated_at = ?
      WHERE id = ? AND project_id = ?
    `).run(text, updatedAt, segmentId, projectId);
    return result.changes === 1;
  }

  createManualSegment(projectId, startMs, createdAt = new Date().toISOString()) {
    const run = this.database.prepare(`
      SELECT id FROM processing_runs WHERE project_id = ? ORDER BY started_at DESC LIMIT 1
    `).get(projectId);
    if (!run) throw new Error('Transcribe the recording before adding a conversation.');
    const recording = this.database.prepare(`
      SELECT duration_ms FROM recordings WHERE project_id = ?
    `).get(projectId);
    const endMs = Math.max(startMs, Math.min(startMs + 3000, recording?.duration_ms ?? startMs + 3000));

    const id = crypto.randomUUID();
    const segments = this.database.prepare(`
      SELECT id, start_ms FROM transcript_segments
      WHERE project_id = ? ORDER BY start_ms, sequence
    `).all(projectId);
    const insertionIndex = segments.findIndex((segment) => segment.start_ms > startMs);
    const sequence = insertionIndex === -1 ? segments.length : insertionIndex;

    this.database.exec('BEGIN IMMEDIATE');
    try {
      this.database.prepare(`
        UPDATE transcript_segments SET sequence = sequence + 1000000 WHERE project_id = ?
      `).run(projectId);
      const reorder = this.database.prepare(`
        UPDATE transcript_segments SET sequence = ? WHERE id = ? AND project_id = ?
      `);
      segments.forEach((segment, index) => reorder.run(index < sequence ? index : index + 1, segment.id, projectId));
      this.database.prepare(`
        INSERT INTO transcript_segments (
          id, project_id, processing_run_id, sequence, start_ms, end_ms,
          original_text, text, original_speaker_id, speaker_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, '', '', NULL, NULL, ?, ?)
      `).run(id, projectId, run.id, sequence, startMs, endMs, createdAt, createdAt);
      this.database.exec('COMMIT');
      return id;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  assignSegmentSpeaker(projectId, segmentId, speakerId, updatedAt = new Date().toISOString()) {
    if (speakerId !== null) {
      const speaker = this.database.prepare(`
        SELECT id FROM speakers WHERE id = ? AND project_id = ?
      `).get(speakerId, projectId);
      if (!speaker) return false;
    }
    const result = this.database.prepare(`
      UPDATE transcript_segments SET speaker_id = ?, updated_at = ?
      WHERE id = ? AND project_id = ?
    `).run(speakerId, updatedAt, segmentId, projectId);
    return result.changes === 1;
  }

  createSpeaker(projectId, displayName, createdAt = new Date().toISOString()) {
    const id = crypto.randomUUID();
    const count = this.database.prepare(`
      SELECT count(*) AS count FROM speakers WHERE project_id = ?
    `).get(projectId).count;
    this.database.prepare(`
      INSERT INTO speakers (id, project_id, diarization_label, display_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, projectId, `MANUAL_${String(count + 1).padStart(2, '0')}`, displayName, createdAt, createdAt);
    return id;
  }

  renameSpeaker(projectId, speakerId, displayName, updatedAt = new Date().toISOString()) {
    const result = this.database.prepare(`
      UPDATE speakers SET display_name = ?, updated_at = ? WHERE id = ? AND project_id = ?
    `).run(displayName, updatedAt, speakerId, projectId);
    return result.changes === 1;
  }
}

module.exports = { ProcessingRepository, milliseconds };
