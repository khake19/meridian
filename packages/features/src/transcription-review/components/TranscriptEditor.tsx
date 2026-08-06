import { useRef, useState, type FocusEvent } from 'react';
import type { ReviewProjectDetails, TranscriptTagCode } from '@meridian/contracts';
import type { SaveState } from '../types/transcription-review.types';
import { useTranscriptFilters } from '../hooks/use-transcript-filters';
import { TranscriptConversationList } from './TranscriptConversationList';
import { TranscriptToolbar } from './TranscriptToolbar';

interface TranscriptEditorProps {
  project: ReviewProjectDetails;
  positionMs: number;
  saveState: SaveState;
  onSeek(positionMs: number): void;
  onTextChange(segmentId: string, text: string): void;
  onTextCommit(segmentId: string, text: string): void;
  onSpeakerChange(segmentId: string, speakerId: string | null): void;
  onTagChange(segmentId: string, tagCode: TranscriptTagCode, assigned: boolean): void;
  onAddConversation(startMs: number): Promise<string | null>;
  onTimeChange(segmentId: string, startMs: number): void;
  onDeleteConversation(segmentId: string): void;
}

export function TranscriptEditor({
  project,
  positionMs,
  saveState,
  onSeek,
  onTextChange,
  onTextCommit,
  onSpeakerChange,
  onTagChange,
  onAddConversation,
  onTimeChange,
  onDeleteConversation,
}: TranscriptEditorProps) {
  const panelRef = useRef<HTMLElement>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [newSegmentId, setNewSegmentId] = useState<string | null>(null);
  const segments = project.transcript || [];
  const filters = useTranscriptFilters(segments, project.speakers || []);

  async function insertConversation(startMs: number) {
    const segmentId = await onAddConversation(startMs);
    if (segmentId) {
      setNewSegmentId(segmentId);
      setSelectedSegmentId(segmentId);
    }
  }

  function handleFocus(event: FocusEvent<HTMLElement>) {
    const row = (event.target as HTMLElement).closest<HTMLElement>('[data-segment-id]');
    if (row?.dataset.segmentId) setSelectedSegmentId(row.dataset.segmentId);
  }

  function handleBlur() {
    requestAnimationFrame(() => {
      const focusedElement = document.activeElement as HTMLElement | null;
      const focusRemainsInEditor = panelRef.current?.contains(focusedElement);
      const focusRemainsInMenu = focusedElement?.closest('.conversation-menu')
        || focusedElement?.closest('.transcript-filter-menu');
      if (!focusRemainsInEditor && !focusRemainsInMenu) setSelectedSegmentId(null);
    });
  }

  return (
    <section
      ref={panelRef}
      className="transcript-panel"
      onFocusCapture={handleFocus}
      onBlurCapture={handleBlur}
    >
      <TranscriptToolbar
        searchQuery={filters.searchQuery}
        tagFilters={filters.tagFilters}
        resultCount={filters.visibleSegments.length}
        hasSearchQuery={filters.hasSearchQuery}
        saveState={saveState}
        followingPaused={Boolean(selectedSegmentId)}
        onSearchChange={filters.setSearchQuery}
        onToggleTag={filters.toggleTagFilter}
        onClearTags={filters.clearTagFilters}
        onResumeFollow={() => setSelectedSegmentId(null)}
      />

      <TranscriptConversationList
        project={project}
        segments={filters.visibleSegments}
        positionMs={positionMs}
        selectedSegmentId={selectedSegmentId}
        newSegmentId={newSegmentId}
        hasActiveFilters={filters.hasActiveFilters}
        onSeek={onSeek}
        onTextChange={onTextChange}
        onTextCommit={onTextCommit}
        onSpeakerChange={onSpeakerChange}
        onTagChange={onTagChange}
        onInsert={insertConversation}
        onTimeChange={onTimeChange}
        onDelete={onDeleteConversation}
      />
    </section>
  );
}
