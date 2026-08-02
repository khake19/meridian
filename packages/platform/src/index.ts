import type {
  ReviewProjectDetails,
  StartTranscriptionRequest,
  TranscriptionEvent,
  WhisperModel,
} from '@meridian/contracts';

export interface ModelStatus {
  model: WhisperModel;
  downloaded: boolean;
  approximateSizeGb: number;
}

export interface MeridianPlatform {
  importRecording(): Promise<ReviewProjectDetails | null>;
  listRecentProjects(limit?: number): Promise<ReviewProjectDetails['project'][]>;
  openProject(projectId: string): Promise<ReviewProjectDetails>;
  getModelStatus(model: WhisperModel): Promise<ModelStatus>;
  startTranscription(request: StartTranscriptionRequest): Promise<{ jobId: string }>;
  subscribeToTranscription(listener: (event: TranscriptionEvent) => void): () => void;
}
