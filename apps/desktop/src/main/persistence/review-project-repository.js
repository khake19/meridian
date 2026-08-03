function mapProject(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastOpenedAt: row.last_opened_at,
  };
}

function mapRecording(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    originalFilename: row.original_filename,
    storedFilename: row.stored_filename,
    mimeType: row.mime_type,
    fileExtension: row.file_extension,
    sizeBytes: row.size_bytes,
    durationMs: row.duration_ms,
    sha256: row.sha256,
    importedAt: row.imported_at,
  };
}

class ReviewProjectRepository {
  constructor(database) {
    this.database = database;
  }

  createWithRecording({ project, recording }) {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      this.database.prepare(`
        INSERT INTO review_projects (
          id, title, status, created_at, updated_at, last_opened_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        project.id,
        project.title,
        project.status,
        project.createdAt,
        project.updatedAt,
        project.lastOpenedAt,
      );

      this.database.prepare(`
        INSERT INTO recordings (
          id, project_id, original_filename, stored_filename, mime_type,
          file_extension, size_bytes, duration_ms, sha256, imported_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        recording.id,
        project.id,
        recording.originalFilename,
        recording.storedFilename,
        recording.mimeType,
        recording.fileExtension,
        recording.sizeBytes,
        recording.durationMs,
        recording.sha256,
        recording.importedAt,
      );

      this.database.prepare(`
        INSERT INTO playback_states (project_id, position_ms, playback_rate, updated_at)
        VALUES (?, 0, 1.0, ?)
      `).run(project.id, project.createdAt);
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }

    return this.getById(project.id);
  }

  getById(projectId) {
    const project = mapProject(this.database.prepare(`
      SELECT * FROM review_projects WHERE id = ? AND deleted_at IS NULL
    `).get(projectId));
    if (!project) return null;

    const recording = mapRecording(this.database.prepare(`
      SELECT * FROM recordings WHERE project_id = ?
    `).get(projectId));
    const playbackRow = this.database.prepare(`
      SELECT * FROM playback_states WHERE project_id = ?
    `).get(projectId);

    return {
      project,
      recording,
      playback: playbackRow ? {
        projectId: playbackRow.project_id,
        positionMs: playbackRow.position_ms,
        playbackRate: playbackRow.playback_rate,
        updatedAt: playbackRow.updated_at,
      } : null,
    };
  }

  listRecent(limit = 20) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new RangeError('Recent project limit must be between 1 and 100.');
    }
    return this.database.prepare(`
      SELECT * FROM review_projects
      WHERE deleted_at IS NULL
      ORDER BY last_opened_at DESC
      LIMIT ?
    `).all(limit).map(mapProject);
  }

  markOpened(projectId, openedAt = new Date().toISOString()) {
    const result = this.database.prepare(`
      UPDATE review_projects
      SET last_opened_at = ?, updated_at = ?
      WHERE id = ? AND deleted_at IS NULL
    `).run(openedAt, openedAt, projectId);
    return result.changes === 1;
  }

  findRecordingByHash(sha256) {
    return mapRecording(this.database.prepare(`
      SELECT recordings.* FROM recordings
      JOIN review_projects ON review_projects.id = recordings.project_id
      WHERE recordings.sha256 = ? AND review_projects.deleted_at IS NULL
      ORDER BY recordings.imported_at DESC LIMIT 1
    `).get(sha256));
  }

  deleteProject(projectId, deletedAt = new Date().toISOString()) {
    const result = this.database.prepare(`
      UPDATE review_projects SET deleted_at = ?, updated_at = ?
      WHERE id = ? AND deleted_at IS NULL
    `).run(deletedAt, deletedAt, projectId);
    return result.changes === 1 ? deletedAt : null;
  }

  restoreProject(projectId, deletionToken, restoredAt = new Date().toISOString()) {
    const result = this.database.prepare(`
      UPDATE review_projects SET deleted_at = NULL, updated_at = ?
      WHERE id = ? AND deleted_at = ?
    `).run(restoredAt, projectId, deletionToken);
    return result.changes === 1;
  }

  savePlaybackState(projectId, positionMs, playbackRate, updatedAt = new Date().toISOString()) {
    const result = this.database.prepare(`
      UPDATE playback_states
      SET position_ms = ?, playback_rate = ?, updated_at = ?
      WHERE project_id = ?
    `).run(positionMs, playbackRate, updatedAt, projectId);
    return result.changes === 1;
  }
}

module.exports = { ReviewProjectRepository };
