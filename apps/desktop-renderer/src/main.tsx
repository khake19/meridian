import React from 'react';
import { createRoot } from 'react-dom/client';
import { MeridianApp } from '@meridian/app';
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
      onTranscriptionEvent(callback: (event: TranscriptionEvent) => void): () => void;
      listRecentProjects(limit?: number): Promise<ReviewProjectDetails['project'][]>;
      openProject(projectId: string): Promise<ReviewProjectDetails>;
      savePlaybackState(projectId: string, positionMs: number, playbackRate: number): Promise<void>;
      saveSegmentText(projectId: string, segmentId: string, text: string): Promise<void>;
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
  recordingSource: (projectId) => `meridian-media://recording/${encodeURIComponent(projectId)}`,
  savePlaybackState: (projectId, positionMs, playbackRate) => window.meridian.savePlaybackState(
    projectId, positionMs, playbackRate,
  ),
  saveSegmentText: (projectId, segmentId, text) => window.meridian.saveSegmentText(projectId, segmentId, text),
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
