const { EventEmitter } = require('node:events');
const { spawn } = require('node:child_process');
const path = require('node:path');
const readline = require('node:readline');

function resolveSidecar() {
  return path.resolve(__dirname, '../../../../services/transcription/src/main.py');
}

function resolvePython(app) {
  if (process.env.MERIDIAN_PYTHON) return process.env.MERIDIAN_PYTHON;
  if (!app.isPackaged) {
    return path.resolve(__dirname, '../../../../.venv/bin/python');
  }
  return 'python3';
}

class TranscriptionSidecar extends EventEmitter {
  constructor({ app, pythonExecutable = resolvePython(app), environment = {} }) {
    super();
    this.app = app;
    this.pythonExecutable = pythonExecutable;
    this.environment = environment;
    this.process = null;
    this.pendingRequests = new Map();
  }

  start() {
    if (this.process) return;

    const executable = this.app.isPackaged
      ? path.join(process.resourcesPath, 'transcription', 'meridian-transcription')
      : this.pythonExecutable;
    const args = this.app.isPackaged ? [] : ['-u', resolveSidecar()];

    const child = spawn(executable, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...this.environment },
    });
    this.process = child;

    const output = readline.createInterface({ input: child.stdout });
    output.on('line', (line) => {
      try {
        const message = JSON.parse(line);
        const pending = message.jobId && this.pendingRequests.get(message.jobId);
        if (pending && pending.resolveTypes.has(message.type)) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(message.jobId);
          pending.resolve(message);
        } else if (pending && message.type === 'job.failed') {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(message.jobId);
          pending.reject(new Error(message.message));
        }
        this.emit('message', message);
      } catch {
        this.emit('diagnostic', line);
      }
    });

    child.stderr.on('data', (chunk) => this.emit('diagnostic', chunk.toString()));
    child.on('error', (error) => this.emit('error', error));
    child.on('exit', (code, signal) => {
      if (this.process === child) this.process = null;
      this.emit('exit', { code, signal });
    });
  }

  send(message) {
    this.start();
    this.process.stdin.write(`${JSON.stringify(message)}\n`);
  }

  request(message, resolveTypes, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(message.jobId);
        reject(new Error('The local media inspection timed out.'));
      }, timeoutMs);
      this.pendingRequests.set(message.jobId, {
        resolve,
        reject,
        resolveTypes: new Set(resolveTypes),
        timeout,
      });
      try {
        this.send(message);
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(message.jobId);
        reject(error);
      }
    });
  }

  stop() {
    if (!this.process) return;
    this.process.stdin.end();
    this.process.kill();
    this.process = null;
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('The transcription service stopped.'));
    }
    this.pendingRequests.clear();
  }
}

module.exports = { TranscriptionSidecar, resolvePython, resolveSidecar };
