import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { ReviewProjectDetails } from '@meridian/contracts';
import { toast } from '@meridian/ui';
import type { TranscriptionReviewService } from '../data-access/transcription-review.service';
import type { SaveState } from '../types/transcription-review.types';
import type { ConfirmationOptions } from './use-confirmation';

interface UseTranscriptEditingOptions {
  project: ReviewProjectDetails | null;
  setProject: Dispatch<SetStateAction<ReviewProjectDetails | null>>;
  service: TranscriptionReviewService;
  onError(message: string): void;
  confirm(options: ConfirmationOptions): Promise<boolean>;
}

export function useTranscriptEditing({ project, setProject, service, onError, confirm }: UseTranscriptEditingOptions) {
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pending = useRef(new Map<string, string>());
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [newSpeakerName, setNewSpeakerName] = useState('');

  function updateSegment(segmentId: string, changes: { text?: string; speakerId?: string | null }) {
    setProject((current) => current ? { ...current, transcript: current.transcript?.map((segment) => segment.id === segmentId ? { ...segment, ...changes } : segment) } : current);
  }

  async function saveText(segmentId: string, text: string) {
    if (!project) return;
    setSaveState('saving');
    try {
      await service.saveSegmentText(project.project.id, segmentId, text);
      if (pending.current.get(segmentId) === text) pending.current.delete(segmentId);
      setSaveState('saved');
    } catch (reason) {
      setSaveState('failed');
      onError(reason instanceof Error ? reason.message : 'Unable to save transcript changes.');
    }
  }

  function queueTextSave(segmentId: string, text: string) {
    updateSegment(segmentId, { text });
    pending.current.set(segmentId, text);
    setSaveState('saving');
    const existing = timers.current.get(segmentId);
    if (existing) clearTimeout(existing);
    timers.current.set(segmentId, setTimeout(() => { timers.current.delete(segmentId); saveText(segmentId, text); }, 500));
  }

  function commitText(segmentId: string, text: string) {
    const timer = timers.current.get(segmentId);
    if (timer) clearTimeout(timer);
    timers.current.delete(segmentId);
    return saveText(segmentId, text);
  }

  async function flushPendingTextSaves() {
    if (pending.current.size === 0) return true;
    for (const timer of timers.current.values()) clearTimeout(timer);
    timers.current.clear();
    const results = await Promise.allSettled([...pending.current.entries()].map(([segmentId, text]) => saveText(segmentId, text)));
    return results.every((result) => result.status === 'fulfilled') && pending.current.size === 0;
  }

  async function assignSpeaker(segmentId: string, speakerId: string | null) {
    if (!project) return;
    updateSegment(segmentId, { speakerId });
    setSaveState('saving');
    try {
      await service.assignSegmentSpeaker(project.project.id, segmentId, speakerId);
      setSaveState('saved');
    } catch (reason) {
      setSaveState('failed');
      onError(reason instanceof Error ? reason.message : 'Unable to assign the speaker.');
    }
  }

  async function addConversation(startMs: number) {
    if (!project) return;
    setSaveState('saving');
    try {
      setProject(await service.createTranscriptSegment(project.project.id, startMs));
      setSaveState('saved');
    } catch (reason) {
      setSaveState('failed');
      onError(reason instanceof Error ? reason.message : 'Unable to add a conversation.');
    }
  }

  async function deleteConversation(segmentId: string) {
    if (!project) return;
    const projectId = project.project.id;
    try {
      setProject(await service.deleteTranscriptSegment(projectId, segmentId));
      setSaveState('saved');
      toast('Conversation deleted', {
        duration: 8000,
        action: {
          label: 'Undo',
          onClick: () => restoreDeletedConversation(projectId, segmentId),
        },
      });
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : 'Unable to delete the conversation.');
    }
  }

  async function restoreDeletedConversation(projectId: string, segmentId: string) {
    try {
      const restored = await service.restoreTranscriptSegment(projectId, segmentId);
      setProject((current) => current?.project.id === projectId ? restored : current);
      setSaveState('saved');
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : 'Unable to restore the conversation.');
    }
  }

  async function deleteEntireTranscript() {
    if (!project || !project.transcript?.length) return;
    if (!(await confirm({
      title: 'Delete the entire transcript?',
      description: 'Every conversation will be removed from the working transcript. The project and audio will remain available, and you can undo this action.',
      actionLabel: 'Delete transcript',
      destructive: true,
    }))) return;
    const projectId = project.project.id;
    try {
      const deletion = await service.deleteTranscript(projectId);
      setProject(deletion.project);
      setSaveState('saved');
      toast('Transcript deleted', {
        duration: 10000,
        action: {
          label: 'Undo',
          onClick: () => restoreEntireTranscript(projectId, deletion.deletionToken),
        },
      });
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : 'Unable to delete the transcript.');
    }
  }

  async function restoreEntireTranscript(projectId: string, deletionToken: string) {
    try {
      const restored = await service.restoreTranscript(projectId, deletionToken);
      setProject((current) => current?.project.id === projectId ? restored : current);
      setSaveState('saved');
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : 'Unable to restore the transcript.');
    }
  }

  async function createSpeaker() {
    if (!project || !newSpeakerName.trim()) return;
    setSaveState('saving');
    try {
      setProject(await service.createSpeaker(project.project.id, newSpeakerName.trim()));
      setNewSpeakerName('');
      setSaveState('saved');
    } catch (reason) {
      setSaveState('failed');
      onError(reason instanceof Error ? reason.message : 'Unable to create the speaker.');
    }
  }

  async function renameSpeaker(speakerId: string, displayName: string) {
    if (!project || !displayName.trim()) return;
    try {
      setProject(await service.renameSpeaker(project.project.id, speakerId, displayName.trim()));
      setSaveState('saved');
    } catch (reason) {
      setSaveState('failed');
      onError(reason instanceof Error ? reason.message : 'Unable to rename the speaker.');
    }
  }

  return { saveState, newSpeakerName, setNewSpeakerName, queueTextSave, commitText, flushPendingTextSaves, assignSpeaker, addConversation, deleteConversation, deleteEntireTranscript, createSpeaker, renameSpeaker };
}
