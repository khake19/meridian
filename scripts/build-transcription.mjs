import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const pyinstaller = process.platform === 'win32'
  ? path.join(workspaceRoot, '.venv', 'Scripts', 'pyinstaller.exe')
  : path.join(workspaceRoot, '.venv', 'bin', 'pyinstaller');

if (!existsSync(pyinstaller)) {
  throw new Error(`PyInstaller was not found at ${pyinstaller}. Create .venv and install the transcription requirements first.`);
}

const result = spawnSync(pyinstaller, [
  '--noconfirm',
  '--distpath', path.join(workspaceRoot, 'build', 'transcription-dist'),
  '--workpath', path.join(workspaceRoot, 'build', 'transcription-work'),
  path.join(workspaceRoot, 'services', 'transcription', 'transcription.spec'),
], {
  cwd: workspaceRoot,
  env: {
    ...process.env,
    PYINSTALLER_CONFIG_DIR: path.join(workspaceRoot, 'build', 'pyinstaller-cache'),
  },
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
