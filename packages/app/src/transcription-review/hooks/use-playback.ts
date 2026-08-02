import { useEffect, useRef, useState } from 'react';
import type { ReviewProjectDetails } from '@meridian/contracts';
import type { TranscriptionReviewService } from '../data-access/transcription-review.service';

interface UsePlaybackOptions {
  project: ReviewProjectDetails | null;
  service: TranscriptionReviewService;
  onError(message: string): void;
}

export function usePlayback({ project, service, onError }: UsePlaybackOptions) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastSave = useRef(0);
  const [positionMs, setPositionMs] = useState(0);
  const [rate, setRate] = useState(1);

  useEffect(() => {
    setPositionMs(project?.playback.positionMs ?? 0);
    setRate(project?.playback.playbackRate ?? 1);
  }, [project?.project.id, project?.playback.positionMs, project?.playback.playbackRate]);

  function persist(nextPositionMs: number, nextRate: number, force = false) {
    if (!project) return;
    const now = Date.now();
    if (!force && now - lastSave.current < 1000) return;
    lastSave.current = now;
    service.savePlaybackState(project.project.id, nextPositionMs, nextRate)
      .catch((reason) => onError(reason instanceof Error ? reason.message : 'Unable to save playback position.'));
  }

  function handleTimeUpdate() {
    const audio = audioRef.current;
    if (!audio) return;
    const nextPositionMs = Math.round(audio.currentTime * 1000);
    setPositionMs(nextPositionMs);
    persist(nextPositionMs, audio.playbackRate);
  }

  function seek(position: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = position / 1000;
    setPositionMs(position);
    persist(position, audio.playbackRate, true);
    audio.play().catch(() => undefined);
  }

  function changeRate(nextRate: number) {
    setRate(nextRate);
    if (audioRef.current) audioRef.current.playbackRate = nextRate;
    persist(positionMs, nextRate, true);
  }

  return { audioRef, positionMs, rate, handleTimeUpdate, seek, changeRate, persist };
}
