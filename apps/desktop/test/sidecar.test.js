const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');
const test = require('node:test');

const pythonExecutable = process.env.MERIDIAN_PYTHON
  || path.resolve(__dirname, '../../../.venv/bin/python');

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
