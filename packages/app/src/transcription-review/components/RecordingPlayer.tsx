import type { RefObject } from 'react';
import type { ReviewProjectDetails } from '@meridian/contracts';
import { formatDuration } from '../utils/format-duration';

interface RecordingPlayerProps {
  project: ReviewProjectDetails;
  source: string;
  audioRef: RefObject<HTMLAudioElement | null>;
  positionMs: number;
  rate: number;
  onTimeUpdate(): void;
  onRateChange(rate: number): void;
  onPersist(positionMs: number, rate: number, force: boolean): void;
}

export function RecordingPlayer({ project, source, audioRef, positionMs, rate, onTimeUpdate, onRateChange, onPersist }: RecordingPlayerProps) {
  return <section className="recording-bar">
    <div className="recording-meta"><span className="file-badge">AUDIO</span><div><strong>{project.recording.originalFilename}</strong><small>{formatDuration(project.recording.durationMs)} · {(project.recording.sizeBytes / 1048576).toFixed(1)} MB · local copy verified</small></div></div>
    <div className="player">
      <audio key={project.project.id} ref={audioRef} controls preload="metadata" src={source} onLoadedMetadata={(event) => { event.currentTarget.currentTime = project.playback.positionMs / 1000; event.currentTarget.playbackRate = project.playback.playbackRate; }} onTimeUpdate={onTimeUpdate} onPause={() => onPersist(positionMs, rate, true)} />
      <select aria-label="Playback speed" value={rate} onChange={(event) => onRateChange(Number(event.target.value))}>
        <option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option>
      </select>
    </div>
  </section>;
}
