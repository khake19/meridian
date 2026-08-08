import type { ReviewProjectDetails, TranscriptTagCode } from '@meridian/contracts';
import { ConversationInsertion } from './ConversationInsertion';
import { ConversationSegment } from './ConversationSegment';

type TranscriptSegment = NonNullable<ReviewProjectDetails['transcript']>[number];

interface TranscriptConversationListProps {
  project: ReviewProjectDetails;
  segments: TranscriptSegment[];
  positionMs: number;
  selectedSegmentId: string | null;
  newSegmentId: string | null;
  hasActiveFilters: boolean;
  onSeek(positionMs: number): void;
  onTextChange(segmentId: string, text: string): void;
  onTextCommit(segmentId: string, text: string): void;
  onSpeakerChange(segmentId: string, speakerId: string | null): void;
  onTagChange(segmentId: string, tagCode: TranscriptTagCode, assigned: boolean): void;
  onInsert(startMs: number): void;
  onTimeChange(segmentId: string, startMs: number, endMs: number): void;
  onDelete(segmentId: string): void;
}

export function TranscriptConversationList({
  project,
  segments,
  positionMs,
  selectedSegmentId,
  newSegmentId,
  hasActiveFilters,
  onSeek,
  onTextChange,
  onTextCommit,
  onSpeakerChange,
  onTagChange,
  onInsert,
  onTimeChange,
  onDelete,
}: TranscriptConversationListProps) {
  const allSegments = project.transcript || [];

  return (
    <div className="saved-transcript">
      {!hasActiveFilters && allSegments.length > 0 && (
        <ConversationInsertion startMs={Math.floor(allSegments[0].startMs / 2)} onInsert={onInsert} />
      )}

      {segments.map((segment, index) => {
        const next = segments[index + 1];
        const playingSegment = positionMs >= segment.startMs && positionMs < segment.endMs;
        const insertionTime = next
          ? next.startMs > segment.endMs
            ? Math.floor((segment.endMs + next.startMs) / 2)
            : next.startMs
          : Math.min(segment.endMs, project.recording.durationMs);

        return (
          <div className="conversation-with-insertion" key={segment.id}>
            <ConversationSegment
              segment={segment}
              project={project}
              autoEdit={newSegmentId === segment.id}
              speakerChanged={index > 0 && segments[index - 1]?.speakerId !== segment.speakerId}
              active={selectedSegmentId ? selectedSegmentId === segment.id : playingSegment}
              autoFollow={!selectedSegmentId && playingSegment}
              onSeek={onSeek}
              onTextChange={onTextChange}
              onTextCommit={onTextCommit}
              onSpeakerChange={onSpeakerChange}
              onTagChange={onTagChange}
              onTimeChange={onTimeChange}
              onDelete={onDelete}
            />
            {!hasActiveFilters && <ConversationInsertion startMs={insertionTime} onInsert={onInsert} />}
          </div>
        );
      })}

      {hasActiveFilters && segments.length === 0 && (
        <div className="empty-search">
          <strong>No matching conversations</strong>
          <span>Try another search or tag filter.</span>
        </div>
      )}
    </div>
  );
}
