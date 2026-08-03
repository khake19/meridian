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
  deleteProject(projectId: string): Promise<{ deletionToken: string }>;
  restoreProject(projectId: string, deletionToken: string): Promise<ReviewProjectDetails>;
  recordingSource(projectId: string): string;
  savePlaybackState(projectId: string, positionMs: number, playbackRate: number): Promise<void>;
  saveSegmentText(projectId: string, segmentId: string, text: string): Promise<void>;
  updateTranscriptSegmentTime(projectId: string, segmentId: string, startMs: number): Promise<ReviewProjectDetails>;
  createTranscriptSegment(projectId: string, startMs: number): Promise<ReviewProjectDetails>;
  deleteTranscriptSegment(projectId: string, segmentId: string): Promise<ReviewProjectDetails>;
  restoreTranscriptSegment(projectId: string, segmentId: string): Promise<ReviewProjectDetails>;
  deleteTranscript(projectId: string): Promise<{ project: ReviewProjectDetails; deletionToken: string }>;
  restoreTranscript(projectId: string, deletionToken: string): Promise<ReviewProjectDetails>;
  assignSegmentSpeaker(projectId: string, segmentId: string, speakerId: string | null): Promise<void>;
  createSpeaker(projectId: string, displayName: string): Promise<ReviewProjectDetails>;
  renameSpeaker(projectId: string, speakerId: string, displayName: string): Promise<ReviewProjectDetails>;
  getDiarizationModelStatus(): Promise<DiarizationModelStatus>;
  installDiarizationModel(token: string): Promise<DiarizationModelStatus>;
  getModelStatus(model: WhisperModel): Promise<ModelStatus>;
  startTranscription(request: StartTranscriptionRequest): Promise<{ jobId: string }>;
  cancelTranscription(jobId: string): Promise<void>;
  subscribeToTranscription(listener: (event: TranscriptionEvent) => void): () => void;
}
