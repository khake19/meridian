const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('meridian', {
  importRecording: () => ipcRenderer.invoke('recordings:import'),
  getModelStatus: (model) => ipcRenderer.invoke('models:status', model),
  startTranscription: (request) => ipcRenderer.invoke('transcription:start', request),
  cancelTranscription: (jobId) => ipcRenderer.invoke('transcription:cancel', jobId),
  listRecentProjects: (limit) => ipcRenderer.invoke('projects:list-recent', limit),
  openProject: (projectId) => ipcRenderer.invoke('projects:open', projectId),
  deleteProject: (projectId) => ipcRenderer.invoke('projects:delete', projectId),
  restoreProject: (projectId, deletionToken) => ipcRenderer.invoke(
    'projects:restore', projectId, deletionToken,
  ),
  savePlaybackState: (projectId, positionMs, playbackRate) => ipcRenderer.invoke(
    'playback:update', projectId, positionMs, playbackRate,
  ),
  saveSegmentText: (projectId, segmentId, text) => ipcRenderer.invoke(
    'transcript:update-text', projectId, segmentId, text,
  ),
  createTranscriptSegment: (projectId, startMs) => ipcRenderer.invoke(
    'transcript:create-segment', projectId, startMs,
  ),
  deleteTranscriptSegment: (projectId, segmentId) => ipcRenderer.invoke(
    'transcript:delete-segment', projectId, segmentId,
  ),
  restoreTranscriptSegment: (projectId, segmentId) => ipcRenderer.invoke(
    'transcript:restore-segment', projectId, segmentId,
  ),
  deleteTranscript: (projectId) => ipcRenderer.invoke('transcript:delete-all', projectId),
  restoreTranscript: (projectId, deletionToken) => ipcRenderer.invoke(
    'transcript:restore-all', projectId, deletionToken,
  ),
  assignSegmentSpeaker: (projectId, segmentId, speakerId) => ipcRenderer.invoke(
    'transcript:assign-speaker', projectId, segmentId, speakerId,
  ),
  createSpeaker: (projectId, displayName) => ipcRenderer.invoke('speakers:create', projectId, displayName),
  renameSpeaker: (projectId, speakerId, displayName) => ipcRenderer.invoke(
    'speakers:rename', projectId, speakerId, displayName,
  ),
  getDiarizationModelStatus: () => ipcRenderer.invoke('models:diarization-status'),
  installDiarizationModel: (token) => ipcRenderer.invoke('models:install-diarization', token),
  onTranscriptionEvent: (callback) => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on('transcription:event', listener);
    return () => ipcRenderer.removeListener('transcription:event', listener);
  },
});
