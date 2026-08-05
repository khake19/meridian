import type { TranscriptionReviewService } from './transcription-review.service';

export function listRecentTranscriptionProjects(service: TranscriptionReviewService, limit?: number) {
  return service.listRecentProjects(limit);
}

export function getDiarizationSetup(service: TranscriptionReviewService) {
  return service.getDiarizationModelStatus();
}

export function getTranscriptionProject(service: TranscriptionReviewService, projectId: string) {
  return service.openProject(projectId);
}
