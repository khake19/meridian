import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline';

const [, , audioPathArgument, ...modelArguments] = process.argv;

if (!audioPathArgument) {
  console.error('Usage: pnpm benchmark:models <audio-file> [small medium large-v3]');
  process.exit(1);
}

const audioPath = path.resolve(audioPathArgument);
const models = modelArguments.length ? modelArguments : ['small', 'medium', 'large-v3'];
const allowedModels = new Set(['small', 'medium', 'large-v3']);

if (models.some((model) => !allowedModels.has(model))) {
  console.error('Models must be one of: small, medium, large-v3');
  process.exit(1);
}

const outputDirectory = path.resolve('.benchmarks');
await mkdir(outputDirectory, { recursive: true });

function runModel(model) {
  return new Promise((resolve, reject) => {
    const child = spawn(path.resolve('.venv/bin/python'), [
      '-u', path.resolve('services/transcription/src/main.py'),
    ], {
      env: {
        ...process.env,
        MERIDIAN_MODEL_DIR: path.resolve('.model-cache'),
      },
      stdio: ['pipe', 'pipe', 'inherit'],
    });
    const lines = readline.createInterface({ input: child.stdout });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code && code !== 0) reject(new Error(`${model} exited with code ${code}`));
    });
    lines.on('line', async (line) => {
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        console.log(`[${model}] ${line}`);
        return;
      }
      if (message.type === 'progress') {
        console.log(`[${model}] ${message.percent}% ${message.stage}`);
      } else if (message.type === 'error') {
        child.kill();
        reject(new Error(`[${model}] ${message.message}`));
      } else if (message.type === 'complete') {
        const outputPath = path.join(outputDirectory, `${model}.json`);
        await writeFile(outputPath, `${JSON.stringify(message, null, 2)}\n`);
        console.log(`[${model}] complete in ${message.elapsedSeconds}s → ${outputPath}`);
        child.stdin.end();
        resolve(message);
      }
    });

    child.stdin.write(`${JSON.stringify({
      type: 'transcribe',
      jobId: `benchmark-${model}`,
      audioPath,
      backend: 'whisperx',
      model,
    })}\n`);
  });
}

for (const model of models) {
  await runModel(model);
}
