import { useEffect, useState } from 'react';
import type { ReviewProjectDetails, TranscriptionEvent, WhisperModel } from '@meridian/contracts';
import type { MeridianPlatform } from '@meridian/platform';
import { PrimaryButton } from '@meridian/ui';
import './meridian-app.css';

export interface MeridianAppProps { platform: MeridianPlatform }

export function MeridianApp({ platform }: MeridianAppProps) {
  const [activeProject, setActiveProject] = useState<ReviewProjectDetails | null>(null);
  const [recentProjects, setRecentProjects] = useState<ReviewProjectDetails['project'][]>([]);
  const [model, setModel] = useState<WhisperModel>('large-v3');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [status, setStatus] = useState('Idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<TranscriptionEvent | null>(null);
  const [running, setRunning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    platform.listRecentProjects()
      .then(setRecentProjects)
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : 'Unable to load recent projects.');
      })
      .finally(() => setLoadingRecent(false));
  }, [platform]);

  useEffect(() => platform.subscribeToTranscription((event) => {
    if (event.jobId && activeJobId && event.jobId !== activeJobId) return;
    if (event.type === 'stage.started') {
      setStatus(event.stage);
    } else if (event.type === 'stage.progress') {
      setStatus(event.stage); setProgress(event.percent);
    } else if (event.type === 'stage.failed') {
      setStatus(`${event.stage} failed`);
    } else if (event.type === 'stage.skipped') {
      setStatus(`${event.stage} skipped`);
    } else if (event.type === 'job.completed') {
      setStatus('Complete'); setProgress(100); setResult(event); setRunning(false);
      if (activeProject) {
        platform.openProject(activeProject.project.id).then(setActiveProject).catch(() => undefined);
      }
    } else if (event.type === 'job.failed') {
      setStatus('Failed'); setResult(event); setRunning(false);
    }
  }), [activeJobId, activeProject, platform]);

  async function importRecording() {
    setImporting(true); setError(null);
    try {
      const imported = await platform.importRecording();
      if (imported) {
        setActiveProject(imported);
        setRecentProjects(await platform.listRecentProjects());
        setStatus('Ready');
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Recording import failed.');
    } finally {
      setImporting(false);
    }
  }

  async function openProject(projectId: string) {
    setError(null);
    try {
      const opened = await platform.openProject(projectId);
      setActiveProject(opened);
      setStatus(opened.latestProcessingRun?.status || 'Ready');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to open the project.');
    }
  }

  async function transcribe() {
    if (!activeProject) return;
    const modelStatus = await platform.getModelStatus(model);
    if (!modelStatus.downloaded && !window.confirm(
      `This model requires approximately ${modelStatus.approximateSizeGb} GB. `
      + 'A language alignment model is downloaded separately. Models stay on this computer. Download now?',
    )) return;

    setRunning(true); setStatus('Starting WhisperX'); setProgress(0); setResult(null);
    const job = await platform.startTranscription({
      projectId: activeProject.project.id,
      backend: 'whisperx',
      model,
    });
    setActiveJobId(job.jobId);
  }

  return <main className="meridian-shell">
    <p className="eyebrow">MERIDIAN · LOCAL TRANSCRIPTION</p>
    <h1>Private interview transcription</h1>
    <p className="intro">Audio and transcript processing stay on this computer.</p>
    <section>
      <label>Review project</label>
      <div className="file-row">
        <output>{activeProject?.recording.originalFilename || 'No recording imported'}</output>
        <button className="secondary" disabled={importing} onClick={importRecording}>
          {importing ? 'Importing…' : 'Import recording'}
        </button>
      </div>
      {activeProject && <p>
        {Math.round(activeProject.recording.durationMs / 1000)} seconds ·{' '}
        {(activeProject.recording.sizeBytes / 1048576).toFixed(1)} MB · preserved locally
      </p>}
      {error && <p role="alert">{error}</p>}
      <div className="action-row">
        <label>Transcription quality<select value={model} onChange={(event) => setModel(event.target.value as WhisperModel)}>
          <option value="large-v3">Best Accuracy · recommended</option>
          <option value="medium">Faster Draft · medium</option>
        </select></label>
        <PrimaryButton disabled={!activeProject || running} onClick={transcribe}>{running ? 'Processing…' : 'Transcribe'}</PrimaryButton>
      </div>
    </section>
    {activeProject?.transcript && activeProject.transcript.length > 0 && <section>
      <div className="status-row"><span>Saved transcript</span><strong>{activeProject.transcript.length} segments</strong></div>
      <div className="saved-transcript">
        {activeProject.transcript.map((segment) => <p key={segment.id}>
          <time>{Math.floor(segment.startMs / 60000)}:{String(Math.floor(segment.startMs / 1000) % 60).padStart(2, '0')}</time>{' '}
          {segment.text}
        </p>)}
      </div>
    </section>}
    <section>
      <div className="status-row"><span>Recent projects</span><strong>{recentProjects.length}</strong></div>
      {loadingRecent && <p>Loading local projects…</p>}
      {!loadingRecent && recentProjects.length === 0 && <p>No imported recordings yet.</p>}
      {recentProjects.map((project) => <button
        className={`secondary recent-project${activeProject?.project.id === project.id ? ' selected' : ''}`}
        key={project.id}
        aria-pressed={activeProject?.project.id === project.id}
        onClick={() => openProject(project.id)}
      ><span>{project.title}</span><small>{new Date(project.lastOpenedAt).toLocaleString()}</small></button>)}
    </section>
    <section>
      <div className="status-row"><span>Status</span><strong>{status}</strong></div>
      <progress max="100" value={progress} />
      <pre>{result ? JSON.stringify(result, null, 2) : 'Results will appear here.'}</pre>
    </section>
  </main>;
}
