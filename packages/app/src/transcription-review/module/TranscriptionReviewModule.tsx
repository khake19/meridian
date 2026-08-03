import { useEffect, useMemo, useState } from 'react';
import type { ReviewProjectDetails, WhisperModel } from '@meridian/contracts';
import { PrimaryButton, Toaster, toast } from '@meridian/ui';
import { ProjectSidebar } from '../components/ProjectSidebar';
import { ProcessingStatus } from '../components/ProcessingStatus';
import { RecordingPlayer } from '../components/RecordingPlayer';
import { SpeakerInspector } from '../components/SpeakerInspector';
import { TranscriptEditor } from '../components/TranscriptEditor';
import { TranscriptionSetup } from '../components/TranscriptionSetup';
import { createTranscriptionReviewService } from '../data-access/transcription-review.service';
import { usePlayback } from '../hooks/use-playback';
import { useTranscriptEditing } from '../hooks/use-transcript-editing';
import { useTranscriptionJob } from '../hooks/use-transcription-job';
import { useTheme } from '../hooks/use-theme';
import { useConfirmation } from '../hooks/use-confirmation';
import type { DiarizationSetupState, TranscriptionReviewModuleProps } from '../types/transcription-review.types';
import { formatRecordingTitle } from '../utils/format-recording-title';
import '../transcription-review.css';

export function TranscriptionReviewModule({ platform: platformAdapter }: TranscriptionReviewModuleProps) {
  const platform = useMemo(() => createTranscriptionReviewService(platformAdapter), [platformAdapter]);
  const [activeProject, setActiveProject] = useState<ReviewProjectDetails | null>(null);
  const [recentProjects, setRecentProjects] = useState<ReviewProjectDetails['project'][]>([]);
  const [model, setModel] = useState<WhisperModel>('large-v3');
  const [importing, setImporting] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hfToken, setHfToken] = useState('');
  const [diarizationSetup, setDiarizationSetup] = useState<DiarizationSetupState>('checking');
  const reportError = (message: string) => setError(message);
  const confirmation = useConfirmation();
  const playback = usePlayback({ project: activeProject, service: platform, onError: reportError });
  const editing = useTranscriptEditing({ project: activeProject, setProject: setActiveProject, service: platform, onError: reportError, confirm: confirmation.confirm });
  const job = useTranscriptionJob({ projectId: activeProject?.project.id, service: platform, setProject: setActiveProject });
  const { theme, toggleTheme } = useTheme();

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

  async function importRecording() {
    if (!(await editing.flushPendingTextSaves())) return;
    setImporting(true); setError(null);
    try {
      const imported = await platform.importRecording();
      if (imported) {
        setActiveProject(imported);
        setRecentProjects(await platform.listRecentProjects());
        if (!job.running) job.setStatus('Ready');
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Recording import failed.');
    } finally {
      setImporting(false);
    }
  }

  async function openProject(projectId: string) {
    if (!(await editing.flushPendingTextSaves())) return;
    setError(null);
    try {
      const opened = await platform.openProject(projectId);
      setActiveProject(opened);
      if (!job.running) job.setStatus(opened.latestProcessingRun?.errorCode === 'PROCESS_INTERRUPTED'
        ? 'interrupted'
        : opened.latestProcessingRun?.status || 'Ready');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to open the project.');
    }
  }

  async function deleteProject(projectId: string) {
    const project = recentProjects.find((candidate) => candidate.id === projectId);
    if (!project || !(await confirmation.confirm({
      title: `Remove “${project.title}”?`,
      description: 'The project will disappear from the sidebar. Its local audio and transcript will remain recoverable through Undo.',
      actionLabel: 'Remove project',
      destructive: true,
    }))) return;
    if (!(await editing.flushPendingTextSaves())) return;
    const wasActive = activeProject?.project.id === projectId;
    try {
      const { deletionToken } = await platform.deleteProject(projectId);
      setRecentProjects((current) => current.filter((candidate) => candidate.id !== projectId));
      if (wasActive) setActiveProject(null);
      toast('Project removed', {
        duration: 10000,
        action: {
          label: 'Undo',
          onClick: () => restoreDeletedProject(projectId, deletionToken, wasActive),
        },
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to remove the project.');
    }
  }

  async function restoreDeletedProject(projectId: string, deletionToken: string, reopen: boolean) {
    try {
      const restored = await platform.restoreProject(projectId, deletionToken);
      setRecentProjects(await platform.listRecentProjects());
      if (reopen) setActiveProject(restored);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to restore the project.');
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
    if (!(await editing.flushPendingTextSaves())) return;
    if (activeProject.transcript && activeProject.transcript.length > 0 && !(await confirmation.confirm({
      title: 'Run transcription again?',
      description: 'The current working transcript will be replaced only after the new run succeeds. Meridian will preserve a local backup of your corrections.',
      actionLabel: 'Transcribe again',
    }))) return;
    const modelStatus = await platform.getModelStatus(model);
    if (!modelStatus.downloaded && !(await confirmation.confirm({
      title: `Download the ${model} model?`,
      description: `This model requires approximately ${modelStatus.approximateSizeGb} GB. A language alignment model is downloaded separately, and all models stay on this computer.`,
      actionLabel: 'Download and transcribe',
    }))) return;

    job.begin(activeProject.project.id);
    const startedJob = await platform.startTranscription({
      projectId: activeProject.project.id,
      backend: 'whisperx',
      model,
    });
    job.track(startedJob.jobId);
  }

  const hasTranscript = Boolean(activeProject?.transcript?.length);
  const processingActiveProject = Boolean(job.running && activeProject && job.processingProjectId === activeProject.project.id);
  return <main className="app-shell">
    <ProjectSidebar activeProjectId={activeProject?.project.id} recentProjects={recentProjects} loadingRecent={loadingRecent} importing={importing} processingProjectId={job.running ? job.processingProjectId : null} diarizationSetup={diarizationSetup} hfToken={hfToken} onHfTokenChange={setHfToken} onImport={importRecording} onOpenProject={openProject} onDeleteProject={deleteProject} onInstallDiarization={installDiarizationModel} />

    <div className={`workspace${processingActiveProject ? ' processing-workspace' : ''}`}>
      <header className="topbar">
        <div className="recording-heading"><h1>{activeProject ? processingActiveProject ? 'Processing recording' : 'Review transcript' : 'Transcription workspace'}</h1>{activeProject && <div className="recording-identity"><strong>{formatRecordingTitle(activeProject.project.title, activeProject.recording.importedAt, activeProject.recording.originalFilename)}</strong><span>{activeProject.recording.originalFilename}</span></div>}</div>
        <div className="topbar-actions"><button className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>{theme === 'dark' ? '☀ Light' : '◐ Dark'}</button>{activeProject?.transcript?.length ? <span className="saved-state">✓&nbsp; {editing.saveState === 'saving' ? 'Saving' : 'Saved'}</span> : null}<button className="more-button" aria-label="More options">•••</button>{!activeProject && <button className="secondary compact" disabled={importing} onClick={importRecording}>↥&nbsp; Import</button>}</div>
      </header>

      {error && <div className="error-banner" role="alert"><strong>Something needs attention</strong><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError(null)}>×</button></div>}

      {!activeProject && <section className="welcome-state">
        <div className="welcome-icon">◉</div>
        <p className="eyebrow">START A LOCAL REVIEW</p>
        <h2>Turn a recording into a review-ready transcript.</h2>
        <p>Import an interview, hearing, or case recording. Meridian transcribes, aligns words, and identifies speakers without uploading the audio.</p>
        <PrimaryButton onClick={importRecording} disabled={importing}>{importing ? 'Importing recording…' : 'Choose a recording'}</PrimaryButton>
        <small>WAV, MP3, M4A, or MP4 · stored privately on this device</small>
      </section>}

      {activeProject && <>
        <RecordingPlayer project={activeProject} source={platform.recordingSource(activeProject.project.id)} audioRef={playback.audioRef} positionMs={playback.positionMs} rate={playback.rate} onTimeUpdate={playback.handleTimeUpdate} onRateChange={playback.changeRate} onSeek={playback.seek} onPersist={playback.persist} />

        {processingActiveProject && <ProcessingStatus status={job.status} progress={job.progress} durationMs={activeProject.recording.durationMs} startedAt={job.startedAt} completedStages={job.completedStages} onCancel={() => job.cancel().catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to cancel processing.'))} />}

        {!hasTranscript && !processingActiveProject && <TranscriptionSetup model={model} running={job.running} onModelChange={setModel} onTranscribe={transcribe} />}

        {hasTranscript && <div className="review-layout">
          <TranscriptEditor project={activeProject} positionMs={playback.positionMs} saveState={editing.saveState} onSeek={playback.seek} onTextChange={editing.queueTextSave} onTextCommit={editing.commitText} onSpeakerChange={editing.assignSpeaker} onAddConversation={() => editing.addConversation(playback.positionMs)} onDeleteConversation={editing.deleteConversation} />
          <SpeakerInspector project={activeProject} model={model} running={job.running} onRenameSpeaker={editing.renameSpeaker} onModelChange={setModel} onTranscribe={transcribe} onDeleteTranscript={editing.deleteEntireTranscript} />
        </div>}

      </>}
    </div>
    <Toaster theme={theme} />
    {confirmation.confirmationDialog}
  </main>;
}
