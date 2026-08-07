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
  const seekRequest = useRef(0);
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

    const durationMs = Number.isFinite(audio.duration) && audio.duration > 0
      ? Math.round(audio.duration * 1000)
      : project?.recording.durationMs ?? position;
    const nextPositionMs = Math.min(Math.max(Math.round(position), 0), durationMs);
    const requestId = ++seekRequest.current;
    const wasEnded = audio.ended
      || (Number.isFinite(audio.duration) && audio.currentTime >= audio.duration - 0.05);

    const applySeek = () => {
      if (seekRequest.current !== requestId) return;

      const resumeAfterSeek = () => {
        audio.removeEventListener('seeked', resumeAfterSeek);
        if (seekRequest.current !== requestId) return;
        audio.play().catch(() => undefined);
      };

      audio.addEventListener('seeked', resumeAfterSeek, { once: true });
      audio.currentTime = nextPositionMs / 1000;

      // Setting currentTime to the current position does not always emit seeked.
      if (!audio.seeking) queueMicrotask(resumeAfterSeek);
    };

    audio.pause();
    setPositionMs(nextPositionMs);
    persist(nextPositionMs, audio.playbackRate, true);

    if (wasEnded) {
      // A custom-protocol media stream can be exhausted after `ended`. Reload
      // it before seeking so Electron requests a fresh readable stream.
      audio.addEventListener('loadedmetadata', applySeek, { once: true });
      audio.load();
    } else {
      applySeek();
    }
  }

  function changeRate(nextRate: number) {
    setRate(nextRate);
    if (audioRef.current) audioRef.current.playbackRate = nextRate;
    persist(positionMs, nextRate, true);
  }

  return { audioRef, positionMs, rate, handleTimeUpdate, seek, changeRate, persist };
}
