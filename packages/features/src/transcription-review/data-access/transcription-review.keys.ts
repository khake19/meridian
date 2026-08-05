export const transcriptionReviewKeys = {
  all: ['transcription-review'] as const,
  projects: () => [...transcriptionReviewKeys.all, 'projects'] as const,
  project: (projectId: string) => [...transcriptionReviewKeys.projects(), projectId] as const,
  diarization: () => [...transcriptionReviewKeys.all, 'diarization'] as const,
};
