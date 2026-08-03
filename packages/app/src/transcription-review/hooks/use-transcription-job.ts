import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { ReviewProjectDetails, TranscriptionEvent } from '@meridian/contracts';
import type { TranscriptionReviewService } from '../data-access/transcription-review.service';

interface UseTranscriptionJobOptions {
  projectId?: string;
  service: TranscriptionReviewService;
  setProject: Dispatch<SetStateAction<ReviewProjectDetails | null>>;
}

export function useTranscriptionJob({ projectId, service, setProject }: UseTranscriptionJobOptions) {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [status, setStatus] = useState('Idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<TranscriptionEvent | null>(null);
  const [running, setRunning] = useState(false);
  const [processingProjectId, setProcessingProjectId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [completedStages, setCompletedStages] = useState<string[]>([]);
  const viewedProjectId = useRef(projectId);

  useEffect(() => { viewedProjectId.current = projectId; }, [projectId]);

  useEffect(() => service.subscribeToTranscription((event) => {
    if (event.jobId && activeJobId && event.jobId !== activeJobId) return;
    if (event.type === 'stage.started') setStatus(event.stage);
    else if (event.type === 'stage.progress') { setStatus(event.stage); setProgress(event.percent); }
    else if (event.type === 'stage.completed') {
      setStatus(event.stage === 'diarization' ? 'complete' : event.stage);
      setCompletedStages((current) => current.includes(event.stage) ? current : [...current, event.stage]);
    }
    else if (event.type === 'stage.failed') setStatus(`${event.stage} failed`);
    else if (event.type === 'stage.skipped') {
      setStatus(event.stage === 'diarization' ? 'complete' : event.stage);
      setCompletedStages((current) => current.includes(event.stage) ? current : [...current, event.stage]);
    }
    else if (event.type === 'job.completed') {
      setStatus('Complete'); setProgress(100); setResult(event); setRunning(false);
      setCompletedStages(['transcription', 'alignment', 'diarization', 'complete']);
      if (processingProjectId) service.openProject(processingProjectId)
        .then((completedProject) => {
          if (viewedProjectId.current === processingProjectId) setProject(completedProject);
        })
        .catch(() => undefined);
    } else if (event.type === 'job.failed') {
      setStatus(event.code === 'PROCESS_CANCELLED' ? 'Cancelled' : 'Failed'); setResult(event); setRunning(false);
    }
  }), [activeJobId, processingProjectId, service, setProject]);

  function begin(nextProjectId: string) {
    setRunning(true);
    setProcessingProjectId(nextProjectId);
    setStatus('Starting WhisperX');
    setProgress(0);
    setResult(null);
    setStartedAt(Date.now());
    setCompletedStages([]);
  }

  function resume(run: NonNullable<ReviewProjectDetails['latestProcessingRun']>) {
    if (run.status !== 'running') return;
    const stageProgress = { queued: 0, transcription: 35, alignment: 70, diarization: 85, complete: 95 };
    const completed = [
      run.transcriptionOutcome !== 'pending' && run.transcriptionOutcome !== 'running' ? 'transcription' : null,
      run.alignmentOutcome !== 'pending' && run.alignmentOutcome !== 'running' ? 'alignment' : null,
      run.diarizationOutcome !== 'pending' && run.diarizationOutcome !== 'running' ? 'diarization' : null,
    ].filter((stage): stage is string => Boolean(stage));
    setActiveJobId(run.id);
    setProcessingProjectId(run.projectId);
    setRunning(true);
    setStatus(run.currentStage === 'queued' ? 'Starting WhisperX' : run.currentStage);
    setProgress(stageProgress[run.currentStage]);
    setStartedAt(run.startedAt ? new Date(run.startedAt).getTime() : Date.now());
    setCompletedStages(completed);
    setResult(null);
  }

  async function cancel() {
    if (!activeJobId) return;
    await service.cancelTranscription(activeJobId);
  }

  return { status, setStatus, progress, result, running, processingProjectId, startedAt, completedStages, begin, resume, cancel, track: setActiveJobId };
}
