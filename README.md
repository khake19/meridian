# Meridian

A local-first case transcription application. The current desktop client runs
WhisperX through a packaged Python sidecar; the shared React application and
contracts are structured for a future web client backed by a hosted worker.

## Workspace

- `apps/desktop` — Electron main process and secure preload bridge
- `apps/desktop-renderer` — Vite entry point for the shared React application
- `packages/features` — platform-neutral product features, UI, and orchestration
- `packages/contracts` — runtime-validated cross-process messages
- `packages/platform` — desktop/web capability boundary
- `packages/ui` — reusable presentation components
- `services/transcription` — Python/WhisperX worker

Nx owns the project graph and task cache; pnpm owns dependencies and workspace
linking.

## Prerequisites

- Node.js and pnpm
- Python 3.10–3.13 for the WhisperX backend

## Run in development

```sh
pnpm install
pnpm dev
```

Choose an audio file, select `medium` or `large-v3`, and transcribe. Electron
starts the Python sidecar and exchanges newline-delimited JSON over stdin/stdout.

## Exercise the mock sidecar directly

```sh
printf '%s\n' '{"type":"transcribe","jobId":"demo","audioPath":"/tmp/example.wav","backend":"mock"}' \
  | python3 services/transcription/src/main.py
```

## WhisperX development environment

Create the project environment and install WhisperX:

```sh
brew install uv
uv python install 3.12
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python \
  -r services/transcription/requirements-whisperx.txt
pnpm dev
```

Choose a WhisperX model in the application. The model and alignment
model are downloaded on first use. Models are stored outside the application so
they can be managed independently from app updates.

## Compare models

Run the same recording through one or more models. Full results are written to
`.benchmarks/<model>.json`.

```sh
pnpm benchmark:models /path/to/audio.wav small medium large-v3
```

## Build a self-contained macOS app

Models are intentionally excluded. The packaged sidecar downloads the selected
model into Meridian's Application Support directory on first use.

```sh
pnpm package:desktop
```

This builds the renderer and Python sidecar before producing the unpacked app in
`release/`. Useful Nx commands are `pnpm graph`, `pnpm test`, and
`pnpm nx show projects`.

## Build the Windows installer

The Windows sidecar must be built on Windows. The `Build Windows installer`
GitHub Actions workflow provisions Python 3.12, packages WhisperX with
PyInstaller, builds the renderer, and creates an unsigned x64 NSIS installer.

Run it from **GitHub → Actions → Build Windows installer → Run workflow**, or
push a tag such as `v0.1.0`. Download `Meridian-windows-x64` from the completed
workflow's Artifacts section. Models are not included and download on first use.
