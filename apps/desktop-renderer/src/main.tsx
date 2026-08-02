import React from 'react';
import { createRoot } from 'react-dom/client';
import { MeridianApp } from '@meridian/app';
import type { MeridianPlatform } from '@meridian/platform';
import {
  transcriptionEventSchema,
  reviewProjectDetailsSchema,
  reviewProjectSchema,
  type StartTranscriptionRequest,
  type TranscriptionEvent,
  type ReviewProjectDetails,
  type WhisperModel,
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
