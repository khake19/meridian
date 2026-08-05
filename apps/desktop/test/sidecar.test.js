const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');
const test = require('node:test');
const { resolvePackagedSidecar } = require('../src/main/sidecar');

const pythonExecutable = process.env.MERIDIAN_PYTHON
  || path.resolve(__dirname, '../../../.venv/bin/python');

test('packaged sidecar uses the native executable name', () => {
  assert.equal(
    resolvePackagedSidecar('C:\\Meridian\\resources', 'win32'),
    path.win32.join('C:\\Meridian\\resources', 'transcription', 'meridian-transcription.exe'),
  );
  assert.equal(
    resolvePackagedSidecar('/Applications/Meridian.app/Contents/Resources', 'darwin'),
    '/Applications/Meridian.app/Contents/Resources/transcription/meridian-transcription',
  );
});

function oneSecondSilentWav() {
  const sampleRate = 8000;
  const dataSize = sampleRate * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + dataSize, 4); buffer.write('WAVE', 8);
  buffer.write('fmt ', 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

test('sidecar inspects audio duration through PyAV', async (context) => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian-media-'));
  context.after(() => fs.rmSync(temporaryDirectory, { recursive: true, force: true }));
  const audioPath = path.join(temporaryDirectory, 'silence.wav');
  fs.writeFileSync(audioPath, oneSecondSilentWav());
  const script = path.resolve(__dirname, '../../../services/transcription/src/main.py');
  const child = spawn(pythonExecutable, ['-u', script]);
  context.after(() => child.kill());
  const lines = readline.createInterface({ input: child.stdout });
  const response = new Promise((resolve, reject) => {
    child.on('error', reject);
    lines.once('line', (line) => resolve(JSON.parse(line)));
  });
  child.stdin.write(`${JSON.stringify({
    protocolVersion: 1, type: 'media.inspect', jobId: 'inspect-job', mediaPath: audioPath,
  })}\n`);

  const result = await response;
  assert.equal(result.type, 'media.inspected');
  assert.equal(result.durationMs, 1000);
});

test('sidecar detects a locally installed diarization model without a token', async (context) => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian-model-'));
  context.after(() => fs.rmSync(temporaryDirectory, { recursive: true, force: true }));
  const snapshot = path.join(
    temporaryDirectory,
    'models--pyannote--speaker-diarization-community-1',
    'snapshots',
    'test-revision',
  );
  fs.mkdirSync(snapshot, { recursive: true });
  fs.writeFileSync(path.join(snapshot, 'config.yaml'), 'version: test');
  const script = path.resolve(__dirname, '../../../services/transcription/src/main.py');
  const child = spawn(pythonExecutable, ['-u', script], {
    env: { ...process.env, MERIDIAN_MODEL_DIR: temporaryDirectory },
  });
  context.after(() => child.kill());
  const lines = readline.createInterface({ input: child.stdout });
  const response = new Promise((resolve, reject) => {
    child.on('error', reject);
    lines.once('line', (line) => resolve(JSON.parse(line)));
  });
  child.stdin.write(`${JSON.stringify({
    protocolVersion: 1, type: 'diarization.status', jobId: 'status-job',
  })}\n`);

  const result = await response;
  assert.equal(result.type, 'diarization.status');
  assert.equal(result.installed, true);
});

test('mock sidecar returns progress and a completed transcript', async () => {
  const script = path.resolve(__dirname, '../../../services/transcription/src/main.py');
  const child = spawn(pythonExecutable, ['-u', script]);
  const messages = [];
  const lines = readline.createInterface({ input: child.stdout });

  const completed = new Promise((resolve, reject) => {
    child.on('error', reject);
    lines.on('line', (line) => {
      const message = JSON.parse(line);
      messages.push(message);
      if (message.type === 'job.completed') resolve(message);
    });
  });

  child.stdin.write(`${JSON.stringify({
    protocolVersion: 1, type: 'transcribe', jobId: 'test-job', audioPath: '/tmp/hearing.wav', backend: 'mock',
  })}\n`);

  const result = await completed;
  child.kill();

  assert.equal(result.jobId, 'test-job');
  assert.equal(result.backend, 'mock');
  assert.match(result.segments[0].text, /hearing\.wav/);
  assert.ok(messages.some((message) => message.type === 'stage.progress'));
});

test('sidecar preserves a raw transcript when alignment fails', async () => {
  const script = path.resolve(__dirname, '../../../services/transcription/src/main.py');
  const child = spawn(pythonExecutable, ['-u', script]);
  const messages = [];
  const lines = readline.createInterface({ input: child.stdout });
  const completed = new Promise((resolve, reject) => {
    child.on('error', reject);
    lines.on('line', (line) => {
      const message = JSON.parse(line);
      messages.push(message);
      if (message.type === 'job.completed') resolve(message);
    });
  });
  child.stdin.write(`${JSON.stringify({
    protocolVersion: 1,
    type: 'transcribe',
    jobId: 'partial-job',
    audioPath: '/tmp/hearing.wav',
    backend: 'mock',
    simulateAlignmentFailure: true,
  })}\n`);

  const result = await completed;
  child.kill();
  assert.equal(result.status, 'partial');
  assert.equal(result.segments.length, 1);
  assert.ok(messages.some((message) => message.type === 'stage.failed' && message.stage === 'alignment'));
  assert.ok(messages.some((message) => message.type === 'stage.skipped' && message.stage === 'diarization'));
});

test('sidecar reports completed diarization and grouped speakers', async () => {
  const script = path.resolve(__dirname, '../../../services/transcription/src/main.py');
  const child = spawn(pythonExecutable, ['-u', script]);
  const messages = [];
  const lines = readline.createInterface({ input: child.stdout });
  const completed = new Promise((resolve, reject) => {
    child.on('error', reject);
    lines.on('line', (line) => {
      const message = JSON.parse(line);
      messages.push(message);
      if (message.type === 'job.completed') resolve(message);
    });
  });
  child.stdin.write(`${JSON.stringify({
    protocolVersion: 1,
    type: 'transcribe',
    jobId: 'diarized-job',
    audioPath: '/tmp/hearing.wav',
    backend: 'mock',
    simulateDiarization: true,
  })}\n`);

  const result = await completed;
  child.kill();
  assert.equal(result.status, 'completed');
  assert.equal(result.segments[0].speaker, 'SPEAKER_00');
  assert.ok(messages.some((message) => message.type === 'stage.completed' && message.stage === 'diarization'));
});

test('sidecar rejects an unknown backend', async () => {
  const script = path.resolve(__dirname, '../../../services/transcription/src/main.py');
  const child = spawn(pythonExecutable, ['-u', script]);
  const lines = readline.createInterface({ input: child.stdout });

  const response = new Promise((resolve, reject) => {
    child.on('error', reject);
    lines.once('line', (line) => resolve(JSON.parse(line)));
  });

  child.stdin.write(`${JSON.stringify({
    protocolVersion: 1, type: 'transcribe', jobId: 'bad-job', audioPath: '/tmp/hearing.wav', backend: 'unknown',
  })}\n`);

  const result = await response;
  child.kill();
  assert.equal(result.type, 'job.failed');
  assert.match(result.message, /Unsupported backend/);
});
