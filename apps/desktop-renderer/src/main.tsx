import React from 'react';
import { createRoot } from 'react-dom/client';
import { MeridianApp } from '@meridian/features';
import type { MeridianPlatform } from '@meridian/platform';
import {
  transcriptionEventSchema,
  reviewProjectDetailsSchema,
  reviewProjectSchema,
  diarizationModelStatusSchema,
  type StartTranscriptionRequest,
  type TranscriptionEvent,
  type ReviewProjectDetails,
  type WhisperModel,
  type DiarizationModelStatus,
} from '@meridian/contracts';
import './styles.css';

declare global {
  interface Window {
    meridian: {
      importRecording(): Promise<ReviewProjectDetails | null>;
      getModelStatus(model: WhisperModel): Promise<{ model: WhisperModel; downloaded: boolean; approximateSizeGb: number }>;
      startTranscription(request: StartTranscriptionRequest): Promise<{ jobId: string }>;
      cancelTranscription(jobId: string): Promise<void>;
      onTranscriptionEvent(callback: (event: TranscriptionEvent) => void): () => void;
      listRecentProjects(limit?: number): Promise<ReviewProjectDetails['project'][]>;
      openProject(projectId: string): Promise<ReviewProjectDetails>;
      deleteProject(projectId: string): Promise<{ deletionToken: string }>;
      restoreProject(projectId: string, deletionToken: string): Promise<ReviewProjectDetails>;
      savePlaybackState(projectId: string, positionMs: number, playbackRate: number): Promise<void>;
      saveSegmentText(projectId: string, segmentId: string, text: string): Promise<void>;
      updateTranscriptSegmentTime(projectId: string, segmentId: string, startMs: number): Promise<ReviewProjectDetails>;
      createTranscriptSegment(projectId: string, startMs: number): Promise<ReviewProjectDetails>;
      deleteTranscriptSegment(projectId: string, segmentId: string): Promise<ReviewProjectDetails>;
      restoreTranscriptSegment(projectId: string, segmentId: string): Promise<ReviewProjectDetails>;
      deleteTranscript(projectId: string): Promise<{ project: ReviewProjectDetails; deletionToken: string }>;
      restoreTranscript(projectId: string, deletionToken: string): Promise<ReviewProjectDetails>;
      exportTranscriptDocx(projectId: string): Promise<{ canceled: boolean; filePath?: string }>;
      assignSegmentSpeaker(projectId: string, segmentId: string, speakerId: string | null): Promise<void>;
      createSpeaker(projectId: string, displayName: string): Promise<ReviewProjectDetails>;
      renameSpeaker(projectId: string, speakerId: string, displayName: string): Promise<ReviewProjectDetails>;
      getDiarizationModelStatus(): Promise<DiarizationModelStatus>;
      installDiarizationModel(token: string): Promise<DiarizationModelStatus>;
    };
  }
}

const platform: MeridianPlatform = {
  importRecording: async () => {
    const project = await window.meridian.importRecording();
    return project ? reviewProjectDetailsSchema.parse(project) : null;
  },
  listRecentProjects: async (limit) => {
    const projects = await window.meridian.listRecentProjects(limit);
    return projects.map((project) => reviewProjectSchema.parse(project));
  },
  openProject: async (projectId) => reviewProjectDetailsSchema.parse(
    await window.meridian.openProject(projectId),
  ),
  deleteProject: (projectId) => window.meridian.deleteProject(projectId),
  restoreProject: async (projectId, deletionToken) => reviewProjectDetailsSchema.parse(
    await window.meridian.restoreProject(projectId, deletionToken),
  ),
  recordingSource: (projectId) => `meridian-media://recording/${encodeURIComponent(projectId)}`,
  savePlaybackState: (projectId, positionMs, playbackRate) => window.meridian.savePlaybackState(
    projectId, positionMs, playbackRate,
  ),
  saveSegmentText: (projectId, segmentId, text) => window.meridian.saveSegmentText(projectId, segmentId, text),
  updateTranscriptSegmentTime: async (projectId, segmentId, startMs) => reviewProjectDetailsSchema.parse(
    await window.meridian.updateTranscriptSegmentTime(projectId, segmentId, startMs),
  ),
  createTranscriptSegment: async (projectId, startMs) => reviewProjectDetailsSchema.parse(
    await window.meridian.createTranscriptSegment(projectId, startMs),
  ),
  deleteTranscriptSegment: async (projectId, segmentId) => reviewProjectDetailsSchema.parse(
    await window.meridian.deleteTranscriptSegment(projectId, segmentId),
  ),
  restoreTranscriptSegment: async (projectId, segmentId) => reviewProjectDetailsSchema.parse(
    await window.meridian.restoreTranscriptSegment(projectId, segmentId),
  ),
  deleteTranscript: async (projectId) => {
    const result = await window.meridian.deleteTranscript(projectId);
    return { project: reviewProjectDetailsSchema.parse(result.project), deletionToken: result.deletionToken };
  },
  restoreTranscript: async (projectId, deletionToken) => reviewProjectDetailsSchema.parse(
    await window.meridian.restoreTranscript(projectId, deletionToken),
  ),
  exportTranscriptDocx: (projectId) => window.meridian.exportTranscriptDocx(projectId),
  assignSegmentSpeaker: (projectId, segmentId, speakerId) => window.meridian.assignSegmentSpeaker(
    projectId, segmentId, speakerId,
  ),
  createSpeaker: async (projectId, displayName) => reviewProjectDetailsSchema.parse(
    await window.meridian.createSpeaker(projectId, displayName),
  ),
  renameSpeaker: async (projectId, speakerId, displayName) => reviewProjectDetailsSchema.parse(
    await window.meridian.renameSpeaker(projectId, speakerId, displayName),
  ),
  getDiarizationModelStatus: async () => diarizationModelStatusSchema.parse(
    await window.meridian.getDiarizationModelStatus(),
  ),
  installDiarizationModel: async (token) => diarizationModelStatusSchema.parse(
    await window.meridian.installDiarizationModel(token),
  ),
  getModelStatus: (model) => window.meridian.getModelStatus(model),
  startTranscription: (request) => window.meridian.startTranscription(request),
  cancelTranscription: (jobId) => window.meridian.cancelTranscription(jobId),
  subscribeToTranscription: (listener) => window.meridian.onTranscriptionEvent((event) => {
    const result = transcriptionEventSchema.safeParse(event);
    if (result.success) {
      listener(result.data);
    } else {
      console.error('Rejected an invalid transcription event.', result.error);
    }
  }),
};

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MeridianApp platform={platform} />
  </React.StrictMode>,
);
