const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('meridian', {
  importRecording: () => ipcRenderer.invoke('recordings:import'),
  getModelStatus: (model) => ipcRenderer.invoke('models:status', model),
  startTranscription: (request) => ipcRenderer.invoke('transcription:start', request),
  listRecentProjects: (limit) => ipcRenderer.invoke('projects:list-recent', limit),
  openProject: (projectId) => ipcRenderer.invoke('projects:open', projectId),
  onTranscriptionEvent: (callback) => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on('transcription:event', listener);
    return () => ipcRenderer.removeListener('transcription:event', listener);
  },
});
