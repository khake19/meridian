import type { WhisperModel } from '@meridian/contracts';
import type { TranscriptionReviewService } from './transcription-review.service';

export function importTranscriptionRecording(service: TranscriptionReviewService) {
  return service.importRecording();
}

export function startLocalTranscription(service: TranscriptionReviewService, projectId: string, model: WhisperModel) {
  return service.startTranscription({ projectId, backend: 'whisperx', model });
}
