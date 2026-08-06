import { z } from 'zod';

export const protocolVersionSchema = z.literal(1);
export const whisperModelSchema = z.enum(['medium', 'large-v3']);
export type WhisperModel = z.infer<typeof whisperModelSchema>;

export const transcriptTagCodes = [
  'admission',
  'denial',
  'key_statement',
  'timeline',
  'witness_mentioned',
  'policy_referenced',
  'inconsistency',
  'action_item',
] as const;
export const transcriptTagCodeSchema = z.enum(transcriptTagCodes);
export type TranscriptTagCode = z.infer<typeof transcriptTagCodeSchema>;
export const transcriptTagDefinitions: ReadonlyArray<{ code: TranscriptTagCode; label: string; color: string }> = [
  { code: 'admission', label: 'Admission', color: '#c96b76' },
  { code: 'denial', label: 'Denial', color: '#8d82c9' },
  { code: 'key_statement', label: 'Key statement', color: '#d09a52' },
  { code: 'timeline', label: 'Timeline', color: '#4d91c9' },
  { code: 'witness_mentioned', label: 'Witness mentioned', color: '#4fa58d' },
  { code: 'policy_referenced', label: 'Policy referenced', color: '#7892a8' },
  { code: 'inconsistency', label: 'Inconsistency', color: '#c17c45' },
  { code: 'action_item', label: 'Action item', color: '#70a85d' },
];

export const diarizationModelStatusSchema = z.object({
  installed: z.boolean(),
  model: z.literal('pyannote/speaker-diarization-community-1'),
});
export type DiarizationModelStatus = z.infer<typeof diarizationModelStatusSchema>;

export const reviewProjectStatusSchema = z.enum(['ready', 'processing', 'review', 'error']);
export const processingStageSchema = z.enum(['queued', 'transcription', 'alignment', 'diarization', 'complete']);
export const stageOutcomeSchema = z.enum(['pending', 'running', 'succeeded', 'failed', 'skipped']);
export const processingRunStatusSchema = z.enum(['queued', 'running', 'partial', 'completed', 'failed']);

export const reviewProjectSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  status: reviewProjectStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  lastOpenedAt: z.iso.datetime(),
});

export const recordingSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  originalFilename: z.string().min(1),
  storedFilename: z.string().min(1),
  mimeType: z.string().min(1),
  fileExtension: z.string().regex(/^\.[a-z0-9]+$/),
  sizeBytes: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  importedAt: z.iso.datetime(),
});

export const playbackStateSchema = z.object({
  projectId: z.string().min(1),
  positionMs: z.number().int().nonnegative(),
  playbackRate: z.number().min(0.5).max(3),
  updatedAt: z.iso.datetime(),
});

export const processingRunSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  recordingId: z.string().min(1),
  engine: z.literal('whisperx'),
  engineVersion: z.string().nullable(),
  model: whisperModelSchema,
  language: z.string().nullable(),
  status: processingRunStatusSchema,
  currentStage: processingStageSchema,
  transcriptionOutcome: stageOutcomeSchema,
  alignmentOutcome: stageOutcomeSchema,
  diarizationOutcome: stageOutcomeSchema,
  startedAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
  elapsedMs: z.number().int().nonnegative().nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
});

export const speakerSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  diarizationLabel: z.string().min(1),
  displayName: z.string().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const transcriptWordSchema = z.object({
  id: z.string().min(1),
  segmentId: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  text: z.string(),
  startMs: z.number().int().nonnegative().nullable(),
  endMs: z.number().int().nonnegative().nullable(),
  alignmentScore: z.number().min(0).max(1).nullable(),
});

export const transcriptSegmentSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  processingRunId: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  originalText: z.string(),
  text: z.string(),
  originalSpeakerId: z.string().nullable(),
  speakerId: z.string().nullable(),
  tags: z.array(transcriptTagCodeSchema),
  words: z.array(transcriptWordSchema).optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
}).refine((segment) => segment.endMs >= segment.startMs, {
  message: 'Segment end must not be before its start.',
  path: ['endMs'],
});

export const reviewProjectDetailsSchema = z.object({
  project: reviewProjectSchema,
  recording: recordingSchema,
  playback: playbackStateSchema,
  latestProcessingRun: processingRunSchema.nullable().optional(),
  transcript: z.array(transcriptSegmentSchema).optional(),
  speakers: z.array(speakerSchema).optional(),
});
export type ReviewProjectDetails = z.infer<typeof reviewProjectDetailsSchema>;

export const startTranscriptionRequestSchema = z.object({
  projectId: z.string().min(1),
  backend: z.literal('whisperx'),
  model: whisperModelSchema,
});
export type StartTranscriptionRequest = z.infer<typeof startTranscriptionRequestSchema>;

const workerEventBase = {
  protocolVersion: protocolVersionSchema,
  jobId: z.string().min(1),
};

const stageStartedEventSchema = z.object({
  ...workerEventBase,
  type: z.literal('stage.started'),
  stage: processingStageSchema.exclude(['queued', 'complete']),
});

const stageProgressEventSchema = z.object({
  ...workerEventBase,
  type: z.literal('stage.progress'),
  stage: processingStageSchema.exclude(['queued', 'complete']),
  percent: z.number().min(0).max(100),
});

const stageCompletedEventSchema = z.object({
  ...workerEventBase,
  type: z.literal('stage.completed'),
  stage: processingStageSchema.exclude(['queued', 'complete']),
});

const stageFailedEventSchema = z.object({
  ...workerEventBase,
  type: z.literal('stage.failed'),
  stage: processingStageSchema.exclude(['queued', 'complete']),
  code: z.string().min(1),
  message: z.string().min(1),
  recoverable: z.boolean(),
});

const stageSkippedEventSchema = z.object({
  ...workerEventBase,
  type: z.literal('stage.skipped'),
  stage: processingStageSchema.exclude(['queued', 'complete']),
  reason: z.string().min(1),
});

const completeEventSchema = z.object({
  ...workerEventBase,
  type: z.literal('job.completed'),
  backend: z.enum(['whisperx', 'mock']),
  model: whisperModelSchema.nullable(),
  language: z.string().nullable(),
  elapsedMs: z.number().int().nonnegative(),
  status: z.enum(['completed', 'partial']),
  segments: z.array(z.unknown()),
});

const errorEventSchema = z.object({
  protocolVersion: protocolVersionSchema,
  type: z.literal('job.failed'),
  jobId: z.string().nullish(),
  code: z.string().min(1),
  message: z.string().min(1),
});

export const transcriptionEventSchema = z.discriminatedUnion('type', [
  stageStartedEventSchema,
  stageProgressEventSchema,
  stageCompletedEventSchema,
  stageFailedEventSchema,
  stageSkippedEventSchema,
  completeEventSchema,
  errorEventSchema,
]);
export type TranscriptionEvent = z.infer<typeof transcriptionEventSchema>;
