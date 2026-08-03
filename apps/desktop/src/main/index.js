const { app, BrowserWindow, dialog, ipcMain, net, protocol } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const { TranscriptionSidecar } = require('./sidecar');
const { openMeridianDatabase } = require('./persistence/database');
const { ReviewProjectRepository } = require('./persistence/review-project-repository');
const { RecordingImportService } = require('./import/recording-import-service');
const { ProcessingRepository } = require('./persistence/processing-repository');

protocol.registerSchemesAsPrivileged([{
  scheme: 'meridian-media',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
}]);

let mainWindow;
let sidecar;
let modelDirectory;
let database;
let projectRepository;
let recordingImportService;
let processingRepository;
let diarizationInstallPromise = null;

const modelRepositories = {
  medium: 'models--Systran--faster-whisper-medium',
  'large-v3': 'models--Systran--faster-whisper-large-v3',
};

function hydrateProject(projectId) {
  const project = projectRepository.getById(projectId);
  if (!project) throw new Error('Review project not found.');
  return {
    ...project,
    latestProcessingRun: processingRepository.getLatestForProject(projectId),
    transcript: processingRepository.getTranscript(projectId),
    speakers: processingRepository.getSpeakers(projectId),
  };
}

function requireText(value, label, maximumLength) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maximumLength) {
    throw new Error(`${label} is required and must be at most ${maximumLength} characters.`);
  }
  return value;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 920,
    height: 680,
    minWidth: 720,
    minHeight: 520,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.env.MERIDIAN_RENDERER_URL) {
    mainWindow.loadURL(process.env.MERIDIAN_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(process.resourcesPath, 'renderer', 'index.html'));
  }
}

app.whenReady().then(() => {
  database = openMeridianDatabase(path.join(app.getPath('userData'), 'meridian.db'));
  projectRepository = new ReviewProjectRepository(database);
  processingRepository = new ProcessingRepository(database);
  const recoveredJobs = processingRepository.recoverInterruptedRuns();
  if (recoveredJobs > 0) console.error(`[recovery] Marked ${recoveredJobs} interrupted processing job(s).`);
  modelDirectory = app.isPackaged
    ? path.join(app.getPath('userData'), 'models')
    : process.env.MERIDIAN_MODEL_DIR || path.join(os.homedir(), '.cache', 'huggingface', 'hub');
  sidecar = new TranscriptionSidecar({
    app,
    environment: {
      MERIDIAN_MODEL_DIR: modelDirectory,
      PYANNOTE_METRICS_ENABLED: '0',
    },
  });
  recordingImportService = new RecordingImportService({
    projectsDirectory: path.join(app.getPath('userData'), 'projects'),
    repository: projectRepository,
    inspectMedia: async (mediaPath) => sidecar.request({
      protocolVersion: 1,
      type: 'media.inspect',
      jobId: crypto.randomUUID(),
      mediaPath,
    }, ['media.inspected']),
  });
  protocol.handle('meridian-media', (request) => {
    const mediaUrl = new URL(request.url);
    if (mediaUrl.host !== 'recording') return new Response('Not found', { status: 404 });
    const projectId = decodeURIComponent(mediaUrl.pathname.slice(1));
    if (!projectId || projectId.includes('/')) return new Response('Bad request', { status: 400 });
    const project = projectRepository.getById(projectId);
    if (!project) return new Response('Not found', { status: 404 });
    try {
      const recordingPath = recordingImportService.resolveStoredRecording(project);
      if (!fs.existsSync(recordingPath)) return new Response('Not found', { status: 404 });
      return net.fetch(pathToFileURL(recordingPath).toString(), { headers: request.headers });
    } catch {
      return new Response('Bad request', { status: 400 });
    }
  });
  sidecar.on('message', (message) => {
    if (!['media.inspected', 'diarization.status', 'diarization.installing', 'diarization.installed'].includes(message.type)) {
      try {
        processingRepository.applyEvent(message);
      } catch (error) {
        console.error(`[persistence] ${error.message}`);
      }
      mainWindow?.webContents.send('transcription:event', message);
    }
  });
  sidecar.on('diagnostic', (message) => console.error(`[sidecar] ${message.trim()}`));
  sidecar.on('error', (error) => {
    mainWindow?.webContents.send('transcription:event', {
      protocolVersion: 1,
      type: 'job.failed',
      jobId: null,
      code: 'SIDECAR_PROCESS_ERROR',
      message: error.message,
    });
  });

  ipcMain.handle('recordings:import', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Recording', extensions: ['wav', 'mp3', 'm4a', 'mp4'] }],
    });
    return result.canceled ? null : recordingImportService.import(result.filePaths[0]);
  });

  ipcMain.handle('models:status', (_event, model) => {
    const repository = modelRepositories[model];
    if (!repository) throw new Error('Unsupported Whisper model.');
    return {
      model,
      downloaded: fs.existsSync(path.join(modelDirectory, repository)),
      approximateSizeGb: model === 'large-v3' ? 2.9 : 1.4,
    };
  });

  ipcMain.handle('models:diarization-status', async () => {
    const response = await sidecar.request({
      protocolVersion: 1,
      type: 'diarization.status',
      jobId: crypto.randomUUID(),
    }, ['diarization.status']);
    return { installed: response.installed, model: response.model };
  });

  ipcMain.handle('models:install-diarization', async (_event, token) => {
    if (typeof token !== 'string' || !/^hf_[A-Za-z0-9]{10,500}$/.test(token)) {
      throw new Error('Enter a valid Hugging Face access token.');
    }
    if (diarizationInstallPromise) return diarizationInstallPromise;
    diarizationInstallPromise = sidecar.request({
      protocolVersion: 1,
      type: 'diarization.install',
      jobId: crypto.randomUUID(),
      token,
    }, ['diarization.installed'], 15 * 60 * 1000).then((response) => ({
      installed: response.installed,
      model: response.model,
    })).finally(() => {
      token = null;
      diarizationInstallPromise = null;
    });
    return diarizationInstallPromise;
  });

  ipcMain.handle('projects:list-recent', (_event, limit = 20) => {
    return projectRepository.listRecent(limit);
  });

  ipcMain.handle('projects:open', (_event, projectId) => {
    if (typeof projectId !== 'string' || projectId.length === 0) {
      throw new Error('A project ID is required.');
    }
    const project = projectRepository.getById(projectId);
    if (!project) throw new Error('Review project not found.');
    projectRepository.markOpened(projectId);
    return hydrateProject(projectId);
  });

  ipcMain.handle('projects:delete', (_event, projectId) => {
    requireText(projectId, 'Project ID', 100);
    const deletionToken = projectRepository.deleteProject(projectId);
    if (!deletionToken) throw new Error('Review project not found.');
    return { deletionToken };
  });

  ipcMain.handle('projects:restore', (_event, projectId, deletionToken) => {
    requireText(projectId, 'Project ID', 100);
    requireText(deletionToken, 'Deletion token', 100);
    if (!projectRepository.restoreProject(projectId, deletionToken)) {
      throw new Error('Deleted review project not found.');
    }
    return hydrateProject(projectId);
  });

  ipcMain.handle('playback:update', (_event, projectId, positionMs, playbackRate) => {
    if (typeof projectId !== 'string' || !projectRepository.getById(projectId)) {
      throw new Error('Review project not found.');
    }
    if (!Number.isInteger(positionMs) || positionMs < 0) {
      throw new Error('Invalid playback position.');
    }
    if (typeof playbackRate !== 'number' || playbackRate < 0.5 || playbackRate > 3) {
      throw new Error('Invalid playback speed.');
    }
    projectRepository.savePlaybackState(projectId, positionMs, playbackRate);
  });

  ipcMain.handle('transcript:update-text', (_event, projectId, segmentId, text) => {
    requireText(projectId, 'Project ID', 100);
    requireText(segmentId, 'Segment ID', 100);
    if (typeof text !== 'string' || text.length > 100000) throw new Error('Invalid transcript text.');
    if (!processingRepository.updateSegmentText(projectId, segmentId, text)) {
      throw new Error('Transcript segment not found.');
    }
  });

  ipcMain.handle('transcript:create-segment', (_event, projectId, startMs) => {
    requireText(projectId, 'Project ID', 100);
    if (!projectRepository.getById(projectId)) throw new Error('Review project not found.');
    if (!Number.isInteger(startMs) || startMs < 0) throw new Error('Invalid conversation start time.');
    processingRepository.createManualSegment(projectId, startMs);
    return hydrateProject(projectId);
  });

  ipcMain.handle('transcript:delete-segment', (_event, projectId, segmentId) => {
    requireText(projectId, 'Project ID', 100);
    requireText(segmentId, 'Segment ID', 100);
    if (!processingRepository.deleteSegment(projectId, segmentId)) {
      throw new Error('Transcript conversation not found.');
    }
    return hydrateProject(projectId);
  });

  ipcMain.handle('transcript:restore-segment', (_event, projectId, segmentId) => {
    requireText(projectId, 'Project ID', 100);
    requireText(segmentId, 'Segment ID', 100);
    if (!processingRepository.restoreSegment(projectId, segmentId)) {
      throw new Error('Deleted transcript conversation not found.');
    }
    return hydrateProject(projectId);
  });

  ipcMain.handle('transcript:delete-all', (_event, projectId) => {
    requireText(projectId, 'Project ID', 100);
    if (!projectRepository.getById(projectId)) throw new Error('Review project not found.');
    const deletionToken = processingRepository.deleteTranscript(projectId);
    if (!deletionToken) throw new Error('This project has no transcript to delete.');
    return { project: hydrateProject(projectId), deletionToken };
  });

  ipcMain.handle('transcript:restore-all', (_event, projectId, deletionToken) => {
    requireText(projectId, 'Project ID', 100);
    requireText(deletionToken, 'Deletion token', 100);
    if (processingRepository.restoreTranscriptDeletion(projectId, deletionToken) === 0) {
      throw new Error('Deleted transcript not found.');
    }
    return hydrateProject(projectId);
  });

  ipcMain.handle('transcript:assign-speaker', (_event, projectId, segmentId, speakerId) => {
    requireText(projectId, 'Project ID', 100);
    requireText(segmentId, 'Segment ID', 100);
    if (speakerId !== null) requireText(speakerId, 'Speaker ID', 100);
    if (!processingRepository.assignSegmentSpeaker(projectId, segmentId, speakerId)) {
      throw new Error('Transcript segment or speaker not found in this project.');
    }
  });

  ipcMain.handle('speakers:create', (_event, projectId, displayName) => {
    requireText(projectId, 'Project ID', 100);
    const name = requireText(displayName, 'Speaker name', 100).trim();
    if (!projectRepository.getById(projectId)) throw new Error('Review project not found.');
    processingRepository.createSpeaker(projectId, name);
    return hydrateProject(projectId);
  });

  ipcMain.handle('speakers:rename', (_event, projectId, speakerId, displayName) => {
    requireText(projectId, 'Project ID', 100);
    requireText(speakerId, 'Speaker ID', 100);
    const name = requireText(displayName, 'Speaker name', 100).trim();
    if (!processingRepository.renameSpeaker(projectId, speakerId, name)) {
      throw new Error('Speaker not found in this project.');
    }
    return hydrateProject(projectId);
  });

  ipcMain.handle('transcription:start', (_event, request) => {
    const { projectId, backend, model } = request || {};
    if (typeof projectId !== 'string' || projectId.length === 0) {
      throw new Error('A review project is required.');
    }
    if (backend !== 'whisperx') {
      throw new Error('Unsupported transcription backend.');
    }
    if (!['medium', 'large-v3'].includes(model)) {
      throw new Error('Unsupported Whisper model.');
    }
    const project = projectRepository.getById(projectId);
    if (!project) throw new Error('Review project not found.');
    const audioPath = recordingImportService.resolveStoredRecording(project);
    if (!fs.existsSync(audioPath)) throw new Error('The preserved recording is missing.');

    const jobId = crypto.randomUUID();
    processingRepository.startRun({
      id: jobId,
      projectId,
      recordingId: project.recording.id,
      model,
      startedAt: new Date().toISOString(),
    });
    sidecar.send({
      protocolVersion: 1,
      type: 'transcribe',
      jobId,
      audioPath,
      backend,
      model,
    });
    return { jobId };
  });

  ipcMain.handle('transcription:cancel', (_event, jobId) => {
    requireText(jobId, 'Processing job ID', 100);
    if (!processingRepository.cancelRun(jobId)) return;
    sidecar.stop();
    mainWindow?.webContents.send('transcription:event', {
      protocolVersion: 1,
      type: 'job.failed',
      jobId,
      code: 'PROCESS_CANCELLED',
      message: 'Processing was cancelled.',
    });
  });

  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  sidecar?.stop();
  database?.close();
  database = null;
});
