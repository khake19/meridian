import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
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
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [completedStages, setCompletedStages] = useState<string[]>([]);

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
      if (projectId) service.openProject(projectId).then(setProject).catch(() => undefined);
    } else if (event.type === 'job.failed') {
      setStatus(event.code === 'PROCESS_CANCELLED' ? 'Cancelled' : 'Failed'); setResult(event); setRunning(false);
    }
  }), [activeJobId, projectId, service, setProject]);

  function begin() {
    setRunning(true);
    setStatus('Starting WhisperX');
    setProgress(0);
    setResult(null);
    setStartedAt(Date.now());
    setCompletedStages([]);
  }

  async function cancel() {
    if (!activeJobId) return;
    await service.cancelTranscription(activeJobId);
  }

  return { status, setStatus, progress, result, running, startedAt, completedStages, begin, cancel, track: setActiveJobId };
}
