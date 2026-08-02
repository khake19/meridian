import type {
  ReviewProjectDetails,
  StartTranscriptionRequest,
  TranscriptionEvent,
  WhisperModel,
  DiarizationModelStatus,
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
  recordingSource(projectId: string): string;
  savePlaybackState(projectId: string, positionMs: number, playbackRate: number): Promise<void>;
  saveSegmentText(projectId: string, segmentId: string, text: string): Promise<void>;
  assignSegmentSpeaker(projectId: string, segmentId: string, speakerId: string | null): Promise<void>;
  createSpeaker(projectId: string, displayName: string): Promise<ReviewProjectDetails>;
  renameSpeaker(projectId: string, speakerId: string, displayName: string): Promise<ReviewProjectDetails>;
  getDiarizationModelStatus(): Promise<DiarizationModelStatus>;
  installDiarizationModel(token: string): Promise<DiarizationModelStatus>;
  getModelStatus(model: WhisperModel): Promise<ModelStatus>;
  startTranscription(request: StartTranscriptionRequest): Promise<{ jobId: string }>;
  subscribeToTranscription(listener: (event: TranscriptionEvent) => void): () => void;
}
