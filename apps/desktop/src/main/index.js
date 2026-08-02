const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('node:path');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const { TranscriptionSidecar } = require('./sidecar');
const { openMeridianDatabase } = require('./persistence/database');
const { ReviewProjectRepository } = require('./persistence/review-project-repository');
const { RecordingImportService } = require('./import/recording-import-service');
const { ProcessingRepository } = require('./persistence/processing-repository');

let mainWindow;
let sidecar;
let modelDirectory;
let database;
let projectRepository;
let recordingImportService;
let processingRepository;

const modelRepositories = {
  medium: 'models--Systran--faster-whisper-medium',
  'large-v3': 'models--Systran--faster-whisper-large-v3',
};

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
  modelDirectory = app.isPackaged
    ? path.join(app.getPath('userData'), 'models')
    : process.env.MERIDIAN_MODEL_DIR || path.join(os.homedir(), '.cache', 'huggingface', 'hub');
  sidecar = new TranscriptionSidecar({
    app,
    environment: {
      MERIDIAN_MODEL_DIR: modelDirectory,
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
  sidecar.on('message', (message) => {
    if (message.type !== 'media.inspected') {
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
    const reopened = projectRepository.getById(projectId);
    return {
      ...reopened,
      latestProcessingRun: processingRepository.getLatestForProject(projectId),
      transcript: processingRepository.getTranscript(projectId),
    };
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
