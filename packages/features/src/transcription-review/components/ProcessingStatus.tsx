import { useEffect, useState } from 'react';
import { Button } from '@meridian/ui';
import { formatDuration } from '../utils/format-duration';

const stages = [
  { id: 'prepared', label: 'Audio prepared' },
  { id: 'transcription', label: 'Creating transcript' },
  { id: 'alignment', label: 'Aligning timestamps' },
  { id: 'diarization', label: 'Identifying speakers' },
  { id: 'complete', label: 'Preparing transcript' },
] as const;

interface ProcessingStatusProps {
  status: string;
  progress: number;
  durationMs: number;
  startedAt: number | null;
  completedStages: string[];
  compact?: boolean;
  onCancel(): void;
}

export function ProcessingStatus({ status, progress, durationMs, startedAt, completedStages, compact = false, onCancel }: ProcessingStatusProps) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const roundedProgress = Math.round(progress);
  const elapsedMs = startedAt ? Math.max(0, now - startedAt) : 0;
  const estimatedRemainingMs = progress >= 10 ? Math.max(0, (elapsedMs / progress) * (100 - progress)) : null;
  const processedMs = Math.round(durationMs * progress / 100);
  const currentStage = status === 'Starting WhisperX' ? 'prepared' : status;

  if (compact) return <section className="processing-banner" aria-label="New transcript processing progress">
    <div className="processing-banner-copy"><span className="spinner" /><span><strong>Creating a new transcript</strong><small>Your current transcript remains available until processing succeeds.</small></span></div>
    <div className="processing-banner-progress"><progress max="100" value={progress} aria-label={`${roundedProgress}% complete`} /><span>{roundedProgress}%</span></div>
    <div className="processing-banner-meta"><span>{stages.find((stage) => stage.id === currentStage)?.label || 'Preparing transcription'}{estimatedRemainingMs === null ? '' : ` · About ${formatDuration(estimatedRemainingMs)} remaining`}</span><Button variant="ghost" size="sm" className="cancel-processing" onClick={onCancel}>Cancel processing</Button></div>
  </section>;

  return <section className="processing-panel" aria-label="Recording processing progress">
    <div className="processing-summary">
      <div><span className="spinner" /><span><span className="processing-label-line"><strong>Processing locally</strong><b>{roundedProgress}%</b></span><small>Audio never leaves this Mac</small></span></div>
    </div>
    <progress max="100" value={progress} aria-label={`${roundedProgress}% complete`} />
    <ol className="processing-stages">
      {stages.map((stage, index) => {
        const done = stage.id === 'prepared' || completedStages.includes(stage.id);
        const active = !done && stage.id === currentStage;
        return <li key={stage.id} className={done ? 'done' : active ? 'current' : ''}>
          <span className="stage-marker">{done ? '✓' : active ? <span className="stage-pulse" /> : index + 1}</span>
          <span>{stage.label}</span>{active && stage.id === 'transcription' ? <span className="stage-activity" aria-label="In progress" /> : null}
        </li>;
      })}
    </ol>
    <dl className="processing-details">
      <div><dt>Audio processed</dt><dd>~{formatDuration(processedMs)} / {formatDuration(durationMs)}</dd></div>
      <div><dt>Elapsed</dt><dd>{formatDuration(elapsedMs)}</dd></div>
      <div><dt>Estimated remaining</dt><dd>{estimatedRemainingMs === null ? 'Calculating…' : `~${formatDuration(estimatedRemainingMs)}`}</dd></div>
    </dl>
    <Button variant="ghost" size="sm" className="cancel-processing" onClick={onCancel}>Cancel processing</Button>
  </section>;
}
