const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const supportedFormats = new Map([
  ['.wav', 'audio/wav'],
  ['.mp3', 'audio/mpeg'],
  ['.m4a', 'audio/mp4'],
  ['.mp4', 'video/mp4'],
]);

async function sha256(filePath) {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
}

class RecordingImportService {
  constructor({ projectsDirectory, repository, inspectMedia }) {
    this.projectsDirectory = projectsDirectory;
    this.repository = repository;
    this.inspectMedia = inspectMedia;
  }

  async import(sourcePath) {
    const source = path.resolve(sourcePath);
    const extension = path.extname(source).toLowerCase();
    const mimeType = supportedFormats.get(extension);
    if (!mimeType) throw new Error('Unsupported recording. Choose a WAV, MP3, M4A, or MP4 file.');

    const sourceStat = await fs.promises.stat(source).catch(() => null);
    if (!sourceStat?.isFile()) throw new Error('The selected recording is unavailable or unreadable.');
    if (sourceStat.size === 0) throw new Error('The selected recording is empty.');
    await fs.promises.access(source, fs.constants.R_OK);

    const inspected = await this.inspectMedia(source);
    if (!Number.isInteger(inspected.durationMs) || inspected.durationMs <= 0) {
      throw new Error('The selected file does not contain readable audio.');
    }

    const projectId = crypto.randomUUID();
    const recordingId = crypto.randomUUID();
    const stagingDirectory = path.join(this.projectsDirectory, `.${projectId}.importing`);
    const projectDirectory = path.join(this.projectsDirectory, projectId);
    const storedFilename = `recordings/original${extension}`;
    const copiedPath = path.join(stagingDirectory, storedFilename);
    const now = new Date().toISOString();

    await fs.promises.mkdir(path.dirname(copiedPath), { recursive: true });
    try {
      const sourceHash = await sha256(source);
      await fs.promises.copyFile(source, copiedPath, fs.constants.COPYFILE_EXCL);
      const copiedHash = await sha256(copiedPath);
      if (sourceHash !== copiedHash) throw new Error('Recording integrity verification failed after copying.');

      await fs.promises.mkdir(this.projectsDirectory, { recursive: true });
      await fs.promises.rename(stagingDirectory, projectDirectory);
      try {
        return this.repository.createWithRecording({
          project: {
            id: projectId,
            title: path.parse(source).name,
            status: 'ready',
            createdAt: now,
            updatedAt: now,
            lastOpenedAt: now,
          },
          recording: {
            id: recordingId,
            originalFilename: path.basename(source),
            storedFilename,
            mimeType,
            fileExtension: extension,
            sizeBytes: sourceStat.size,
            durationMs: inspected.durationMs,
            sha256: sourceHash,
            importedAt: now,
          },
        });
      } catch (error) {
        await fs.promises.rm(projectDirectory, { recursive: true, force: true });
        throw error;
      }
    } catch (error) {
      await fs.promises.rm(stagingDirectory, { recursive: true, force: true });
      throw error;
    }
  }

  resolveStoredRecording(projectDetails) {
    const projectDirectory = path.resolve(this.projectsDirectory, projectDetails.project.id);
    const recordingPath = path.resolve(projectDirectory, projectDetails.recording.storedFilename);
    if (!recordingPath.startsWith(`${projectDirectory}${path.sep}`)) {
      throw new Error('Invalid stored recording path.');
    }
    return recordingPath;
  }
}

module.exports = { RecordingImportService, sha256, supportedFormats };
