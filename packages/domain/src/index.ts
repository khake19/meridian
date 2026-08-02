export type ReviewProjectStatus = 'ready' | 'processing' | 'review' | 'error';
export type ProcessingStage = 'queued' | 'transcription' | 'alignment' | 'diarization' | 'complete';
export type StageOutcome = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
export type ProcessingRunStatus = 'queued' | 'running' | 'partial' | 'completed' | 'failed';

export interface ReviewProject {
  id: string;
  title: string;
  status: ReviewProjectStatus;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
}

export interface Recording {
  id: string;
  projectId: string;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  fileExtension: string;
  sizeBytes: number;
  durationMs: number;
  sha256: string;
  importedAt: string;
}

export interface ProcessingRun {
  id: string;
  projectId: string;
  recordingId: string;
  engine: 'whisperx';
  engineVersion: string | null;
  model: 'medium' | 'large-v3';
  language: string | null;
  status: ProcessingRunStatus;
  currentStage: ProcessingStage;
  transcriptionOutcome: StageOutcome;
  alignmentOutcome: StageOutcome;
  diarizationOutcome: StageOutcome;
  startedAt: string | null;
  completedAt: string | null;
  elapsedMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface TranscriptWord {
  id: string;
  segmentId: string;
  sequence: number;
  text: string;
  startMs: number | null;
  endMs: number | null;
  alignmentScore: number | null;
}

export interface TranscriptSegment {
  id: string;
  projectId: string;
  processingRunId: string;
  sequence: number;
  startMs: number;
  endMs: number;
  originalText: string;
  text: string;
  originalSpeakerId: string | null;
  speakerId: string | null;
  words?: TranscriptWord[];
  createdAt: string;
  updatedAt: string;
}

export interface Speaker {
  id: string;
  projectId: string;
  diarizationLabel: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlaybackState {
  projectId: string;
  positionMs: number;
  playbackRate: number;
  updatedAt: string;
}
