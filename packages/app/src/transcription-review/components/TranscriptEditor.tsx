import { useRef, useState, type FocusEvent } from 'react';
import type { ReviewProjectDetails } from '@meridian/contracts';
import { StatusDot } from './StatusDot';
import { ConversationSegment } from './ConversationSegment';
import type { SaveState } from '../types/transcription-review.types';

interface TranscriptEditorProps {
  project: ReviewProjectDetails;
  positionMs: number;
  saveState: SaveState;
  onSeek(positionMs: number): void;
  onTextChange(segmentId: string, text: string): void;
  onTextCommit(segmentId: string, text: string): void;
  onSpeakerChange(segmentId: string, speakerId: string | null): void;
  onAddConversation(): void;
  onDeleteConversation(segmentId: string): void;
}

export function TranscriptEditor({ project, positionMs, saveState, onSeek, onTextChange, onTextCommit, onSpeakerChange, onAddConversation, onDeleteConversation }: TranscriptEditorProps) {
  const panelRef = useRef<HTMLElement>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);

  function handleFocus(event: FocusEvent<HTMLElement>) {
    const row = (event.target as HTMLElement).closest<HTMLElement>('[data-segment-id]');
    if (row?.dataset.segmentId) setSelectedSegmentId(row.dataset.segmentId);
  }

  function handleBlur() {
    requestAnimationFrame(() => {
      if (!panelRef.current?.contains(document.activeElement)) setSelectedSegmentId(null);
    });
  }

  return <section ref={panelRef} className="transcript-panel" onFocusCapture={handleFocus} onBlurCapture={handleBlur}>
    <div className="panel-heading"><div><p className="eyebrow">TRANSCRIPT</p><h2>Review conversation</h2></div><div className="transcript-heading-actions">{selectedSegmentId && <button className="resume-follow" onClick={() => setSelectedSegmentId(null)}>▶ Resume follow</button>}<span className={`save-indicator ${saveState}`}><StatusDot state={saveState === 'failed' ? 'error' : saveState === 'saving' ? 'busy' : 'ready'} />{saveState === 'saving' ? 'Saving…' : saveState === 'failed' ? 'Save failed' : 'Saved locally'}</span><button className="add-conversation" onClick={onAddConversation}>＋ Add conversation</button></div></div>
    <div className="saved-transcript">
      {project.transcript?.map((segment) => <ConversationSegment key={segment.id} segment={segment} project={project} active={selectedSegmentId ? selectedSegmentId === segment.id : positionMs >= segment.startMs && positionMs < segment.endMs} onSeek={onSeek} onTextChange={onTextChange} onTextCommit={onTextCommit} onSpeakerChange={onSpeakerChange} onDelete={onDeleteConversation} />)}
    </div>
  </section>;
}
