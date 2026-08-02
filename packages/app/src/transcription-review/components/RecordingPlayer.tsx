import { useState, type RefObject } from 'react';
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
  onSeek(positionMs: number): void;
  onPersist(positionMs: number, rate: number, force: boolean): void;
}

export function RecordingPlayer({ project, source, audioRef, positionMs, rate, onTimeUpdate, onRateChange, onSeek, onPersist }: RecordingPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const durationMs = project.recording.durationMs;

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => undefined);
    else audio.pause();
  }

  return <section className="recording-bar">
    <div className="player">
      <audio className="native-audio" key={project.project.id} ref={audioRef} preload="metadata" src={source} onLoadedMetadata={(event) => { event.currentTarget.currentTime = project.playback.positionMs / 1000; event.currentTarget.playbackRate = project.playback.playbackRate; }} onTimeUpdate={onTimeUpdate} onPlay={() => setPlaying(true)} onPause={() => { setPlaying(false); onPersist(positionMs, rate, true); }} />
      <button className="transport-button" aria-label={playing ? 'Pause recording' : 'Play recording'} onClick={togglePlayback}>{playing ? 'Ⅱ' : '▷'}</button>
      <time>{formatDuration(positionMs)}</time>
      <input className="timeline" type="range" min="0" max={Math.max(durationMs, 1)} value={Math.min(positionMs, durationMs)} aria-label="Recording position" onChange={(event) => onSeek(Number(event.target.value))} />
      <time className="duration">{formatDuration(durationMs)}</time>
      <select aria-label="Playback speed" value={rate} onChange={(event) => onRateChange(Number(event.target.value))}>
        <option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option>
      </select>
    </div>
    <div className="recording-meta"><span>{project.recording.originalFilename}</span><small>{(project.recording.sizeBytes / 1048576).toFixed(1)} MB · local verified</small></div>
  </section>;
}
