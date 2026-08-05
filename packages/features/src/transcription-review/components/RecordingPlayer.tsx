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
  const [volume, setVolume] = useState(1);
  const durationMs = project.recording.durationMs;

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => undefined);
    else audio.pause();
  }

  function changeVolume(nextVolume: number) {
    setVolume(nextVolume);
    if (audioRef.current) audioRef.current.volume = nextVolume;
  }

  return <section className="recording-bar">
    <div className="player-left">
      <audio className="native-audio" key={project.project.id} ref={audioRef} preload="metadata" src={source} onLoadedMetadata={(event) => { event.currentTarget.currentTime = project.playback.positionMs / 1000; event.currentTarget.playbackRate = project.playback.playbackRate; }} onTimeUpdate={onTimeUpdate} onPlay={() => setPlaying(true)} onPause={() => { setPlaying(false); onPersist(positionMs, rate, true); }} />
      <button className="transport-button" aria-label={playing ? 'Pause recording' : 'Play recording'} onClick={togglePlayback}>
        {playing
          ? <svg aria-hidden="true" viewBox="0 0 16 16"><path d="M5.25 3.5v9M10.75 3.5v9" /></svg>
          : <svg aria-hidden="true" viewBox="0 0 16 16"><path className="play-shape" d="M5 3.25 12 8l-7 4.75z" /></svg>}
      </button>
      <time>{formatDuration(positionMs)}</time>
    </div>
    <div className="player-center">
      <input className="timeline" type="range" min="0" max={Math.max(durationMs, 1)} value={Math.min(positionMs, durationMs)} aria-label="Recording position" onChange={(event) => onSeek(Number(event.target.value))} />
      <time className="duration">{formatDuration(durationMs)}</time>
    </div>
    <div className="player-right">
      <select aria-label="Playback speed" value={rate} onChange={(event) => onRateChange(Number(event.target.value))}>
        <option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option>
      </select>
      <span className="volume-control"><svg aria-hidden="true" viewBox="0 0 16 16"><path d="M2.5 6.2h2.4l3-2.5v8.6l-3-2.5H2.5zM10.2 6a3 3 0 0 1 0 4M11.8 4.4a5.2 5.2 0 0 1 0 7.2" /></svg><input type="range" min="0" max="1" step="0.05" value={volume} aria-label="Volume" onChange={(event) => changeVolume(Number(event.target.value))} /></span>
    </div>
  </section>;
}
