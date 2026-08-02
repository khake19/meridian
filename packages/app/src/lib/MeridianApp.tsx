import { useEffect, useRef, useState } from 'react';
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
  const [playbackPositionMs, setPlaybackPositionMs] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastPlaybackSave = useRef(0);
  const textSaveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [newSpeakerName, setNewSpeakerName] = useState('');
  const [hfToken, setHfToken] = useState('');
  const [diarizationSetup, setDiarizationSetup] = useState<'checking' | 'missing' | 'installing' | 'installed' | 'failed'>('checking');

  useEffect(() => {
    platform.listRecentProjects()
      .then(setRecentProjects)
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : 'Unable to load recent projects.');
      })
      .finally(() => setLoadingRecent(false));
  }, [platform]);

  useEffect(() => {
    platform.getDiarizationModelStatus()
      .then((status) => setDiarizationSetup(status.installed ? 'installed' : 'missing'))
      .catch(() => setDiarizationSetup('failed'));
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
      setPlaybackPositionMs(opened.playback.positionMs);
      setPlaybackRate(opened.playback.playbackRate);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to open the project.');
    }
  }

  function persistPlayback(positionMs: number, rate: number, force = false) {
    if (!activeProject) return;
    const now = Date.now();
    if (!force && now - lastPlaybackSave.current < 1000) return;
    lastPlaybackSave.current = now;
    platform.savePlaybackState(activeProject.project.id, positionMs, rate).catch((reason) => {
      setError(reason instanceof Error ? reason.message : 'Unable to save playback position.');
    });
  }

  function handleTimeUpdate() {
    const audio = audioRef.current;
    if (!audio) return;
    const positionMs = Math.round(audio.currentTime * 1000);
    setPlaybackPositionMs(positionMs);
    persistPlayback(positionMs, audio.playbackRate);
  }

  function seekTo(positionMs: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = positionMs / 1000;
    setPlaybackPositionMs(positionMs);
    persistPlayback(positionMs, audio.playbackRate, true);
    audio.play().catch(() => undefined);
  }

  function changePlaybackRate(rate: number) {
    setPlaybackRate(rate);
    if (audioRef.current) audioRef.current.playbackRate = rate;
    persistPlayback(playbackPositionMs, rate, true);
  }

  function updateLocalSegment(segmentId: string, changes: { text?: string; speakerId?: string | null }) {
    setActiveProject((current) => current ? {
      ...current,
      transcript: current.transcript?.map((segment) => segment.id === segmentId
        ? { ...segment, ...changes }
        : segment),
    } : current);
  }

  async function saveText(segmentId: string, text: string) {
    if (!activeProject) return;
    setSaveState('saving');
    try {
      await platform.saveSegmentText(activeProject.project.id, segmentId, text);
      setSaveState('saved');
    } catch (reason) {
      setSaveState('failed');
      setError(reason instanceof Error ? reason.message : 'Unable to save transcript changes.');
    }
  }

  function queueTextSave(segmentId: string, text: string) {
    updateLocalSegment(segmentId, { text });
    setSaveState('saving');
    const existing = textSaveTimers.current.get(segmentId);
    if (existing) clearTimeout(existing);
    textSaveTimers.current.set(segmentId, setTimeout(() => {
      textSaveTimers.current.delete(segmentId);
      saveText(segmentId, text);
    }, 500));
  }

  async function assignSpeaker(segmentId: string, speakerId: string | null) {
    if (!activeProject) return;
    updateLocalSegment(segmentId, { speakerId });
    setSaveState('saving');
    try {
      await platform.assignSegmentSpeaker(activeProject.project.id, segmentId, speakerId);
      setSaveState('saved');
    } catch (reason) {
      setSaveState('failed');
      setError(reason instanceof Error ? reason.message : 'Unable to assign the speaker.');
    }
  }

  async function createSpeaker() {
    if (!activeProject) return;
    const displayName = newSpeakerName.trim();
    if (!displayName) return;
    setSaveState('saving');
    try {
      setActiveProject(await platform.createSpeaker(activeProject.project.id, displayName));
      setNewSpeakerName('');
      setSaveState('saved');
    } catch (reason) {
      setSaveState('failed');
      setError(reason instanceof Error ? reason.message : 'Unable to create the speaker.');
    }
  }

  async function renameSpeaker(speakerId: string, displayName: string) {
    if (!activeProject || !displayName.trim()) return;
    try {
      setActiveProject(await platform.renameSpeaker(activeProject.project.id, speakerId, displayName.trim()));
      setSaveState('saved');
    } catch (reason) {
      setSaveState('failed');
      setError(reason instanceof Error ? reason.message : 'Unable to rename the speaker.');
    }
  }

  async function installDiarizationModel() {
    const token = hfToken.trim();
    if (!token) return;
    setDiarizationSetup('installing'); setError(null);
    const installation = platform.installDiarizationModel(token);
    setHfToken('');
    try {
      const status = await installation;
      setDiarizationSetup(status.installed ? 'installed' : 'failed');
    } catch (reason) {
      setDiarizationSetup('failed');
      setError(reason instanceof Error ? reason.message : 'Unable to install the speaker model.');
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
      <div className="status-row"><span>Speaker detection model</span><strong>{diarizationSetup}</strong></div>
      {diarizationSetup === 'checking' && <p>Checking local model installation…</p>}
      {diarizationSetup === 'installed' && <p>Pyannote Community-1 is installed and available for offline speaker detection.</p>}
      {diarizationSetup !== 'installed' && diarizationSetup !== 'checking' && <div className="model-setup">
        <p>Admin setup: enter a read-only Hugging Face token to download the local speaker model once.</p>
        <input
          type="password"
          aria-label="Hugging Face token"
          autoComplete="off"
          placeholder="hf_…"
          value={hfToken}
          disabled={diarizationSetup === 'installing'}
          onChange={(event) => setHfToken(event.target.value)}
        />
        <button
          disabled={!hfToken.trim() || diarizationSetup === 'installing'}
          onClick={installDiarizationModel}
        >{diarizationSetup === 'installing' ? 'Downloading speaker model…' : 'Download speaker model'}</button>
        <small>The token is used for this download only and is not saved by Meridian.</small>
      </div>}
    </section>
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
      {activeProject && <div className="player">
        <audio
          key={activeProject.project.id}
          ref={audioRef}
          controls
          preload="metadata"
          src={platform.recordingSource(activeProject.project.id)}
          onLoadedMetadata={(event) => {
            event.currentTarget.currentTime = activeProject.playback.positionMs / 1000;
            event.currentTarget.playbackRate = activeProject.playback.playbackRate;
          }}
          onTimeUpdate={handleTimeUpdate}
          onPause={() => persistPlayback(playbackPositionMs, playbackRate, true)}
        />
        <label>Playback speed<select value={playbackRate} onChange={(event) => changePlaybackRate(Number(event.target.value))}>
          <option value="0.75">0.75×</option>
          <option value="1">1×</option>
          <option value="1.25">1.25×</option>
          <option value="1.5">1.5×</option>
          <option value="2">2×</option>
        </select></label>
      </div>}
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
      <div className="status-row"><span>Transcript review</span><strong>{saveState === 'idle' ? `${activeProject.transcript.length} segments` : saveState}</strong></div>
      <div className="speaker-editor">
        <span>Speakers</span>
        {activeProject.speakers?.map((speaker) => <input
          key={speaker.id}
          aria-label={`Rename ${speaker.displayName}`}
          defaultValue={speaker.displayName}
          onBlur={(event) => renameSpeaker(speaker.id, event.target.value)}
        />)}
        <input
          aria-label="New speaker name"
          placeholder="New speaker name"
          value={newSpeakerName}
          maxLength={100}
          onChange={(event) => setNewSpeakerName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') createSpeaker();
          }}
        />
        <button className="secondary" disabled={!newSpeakerName.trim()} onClick={createSpeaker}>Add speaker</button>
      </div>
      <div className="saved-transcript">
        {activeProject.transcript.map((segment) => <div
          className={`transcript-segment${playbackPositionMs >= segment.startMs && playbackPositionMs < segment.endMs ? ' active' : ''}`}
          key={segment.id}
        >
          <button className="timestamp" onClick={() => seekTo(segment.startMs)}>
            <time>{Math.floor(segment.startMs / 60000)}:{String(Math.floor(segment.startMs / 1000) % 60).padStart(2, '0')}</time>
          </button>
          <select
            aria-label="Segment speaker"
            value={segment.speakerId || ''}
            onChange={(event) => assignSpeaker(segment.id, event.target.value || null)}
          >
            <option value="">Unassigned</option>
            {activeProject.speakers?.map((speaker) => <option key={speaker.id} value={speaker.id}>{speaker.displayName}</option>)}
          </select>
          <textarea
            aria-label={`Transcript segment ${segment.sequence + 1}`}
            value={segment.text}
            onChange={(event) => queueTextSave(segment.id, event.target.value)}
            onBlur={(event) => {
              const timer = textSaveTimers.current.get(segment.id);
              if (timer) clearTimeout(timer);
              textSaveTimers.current.delete(segment.id);
              saveText(segment.id, event.target.value);
            }}
          />
        </div>)}
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
