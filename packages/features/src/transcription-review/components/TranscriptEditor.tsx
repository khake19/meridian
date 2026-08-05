import { useEffect, useRef, useState, type FocusEvent } from 'react';
import type { ReviewProjectDetails } from '@meridian/contracts';
import { StatusDot } from './StatusDot';
import { ConversationSegment } from './ConversationSegment';
import { ConversationInsertion } from './ConversationInsertion';
import type { SaveState } from '../types/transcription-review.types';

interface TranscriptEditorProps {
  project: ReviewProjectDetails;
  positionMs: number;
  saveState: SaveState;
  onSeek(positionMs: number): void;
  onTextChange(segmentId: string, text: string): void;
  onTextCommit(segmentId: string, text: string): void;
  onSpeakerChange(segmentId: string, speakerId: string | null): void;
  onAddConversation(startMs: number): Promise<string | null>;
  onTimeChange(segmentId: string, startMs: number): void;
  onDeleteConversation(segmentId: string): void;
}

export function TranscriptEditor({ project, positionMs, saveState, onSeek, onTextChange, onTextCommit, onSpeakerChange, onAddConversation, onTimeChange, onDeleteConversation }: TranscriptEditorProps) {
  const panelRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [newSegmentId, setNewSegmentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const segments = project.transcript || [];
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  const visibleSegments = normalizedQuery
    ? segments.filter((segment) => {
      const speaker = project.speakers?.find((candidate) => candidate.id === segment.speakerId)?.displayName || 'Unassigned';
      return segment.text.toLocaleLowerCase().includes(normalizedQuery) || speaker.toLocaleLowerCase().includes(normalizedQuery);
    })
    : segments;

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'f') {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    }
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

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
      if (!panelRef.current?.contains(document.activeElement)) setSelectedSegmentId(null);
    });
  }

  return <section ref={panelRef} className="transcript-panel" onFocusCapture={handleFocus} onBlurCapture={handleBlur}>
    <div className="panel-heading"><div><p className="eyebrow">TRANSCRIPT</p><h2>Review conversation</h2></div><div className="transcript-heading-actions"><div className="transcript-search"><svg aria-hidden="true" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.25" /><path d="m10.2 10.2 3 3" /></svg><input ref={searchRef} type="search" placeholder="Search transcript" aria-label="Search transcript" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { setSearchQuery(''); event.currentTarget.blur(); } }} />{normalizedQuery && <span>{visibleSegments.length}</span>}</div>{selectedSegmentId && <button className="resume-follow" onClick={() => setSelectedSegmentId(null)}>▶ Resume follow</button>}<span className={`save-indicator ${saveState}`}><StatusDot state={saveState === 'failed' ? 'error' : saveState === 'saving' ? 'busy' : 'ready'} />{saveState === 'saving' ? 'Saving…' : saveState === 'failed' ? 'Save failed' : 'Saved locally'}</span></div></div>
    <div className="saved-transcript">
      {!normalizedQuery && segments.length > 0 && <ConversationInsertion startMs={Math.floor(segments[0].startMs / 2)} onInsert={insertConversation} />}
      {visibleSegments.map((segment, index) => {
        const next = visibleSegments[index + 1];
        const insertionTime = next
          ? next.startMs > segment.endMs ? Math.floor((segment.endMs + next.startMs) / 2) : next.startMs
          : Math.min(segment.endMs, project.recording.durationMs);
        return <div className="conversation-with-insertion" key={segment.id}>
          <ConversationSegment segment={segment} project={project} autoEdit={newSegmentId === segment.id} speakerChanged={index > 0 && visibleSegments[index - 1]?.speakerId !== segment.speakerId} active={selectedSegmentId ? selectedSegmentId === segment.id : positionMs >= segment.startMs && positionMs < segment.endMs} onSeek={onSeek} onTextChange={onTextChange} onTextCommit={onTextCommit} onSpeakerChange={onSpeakerChange} onTimeChange={onTimeChange} onDelete={onDeleteConversation} />
          {!normalizedQuery && <ConversationInsertion startMs={insertionTime} onInsert={insertConversation} />}
        </div>;
      })}
      {normalizedQuery && visibleSegments.length === 0 && <div className="empty-search"><strong>No matching conversations</strong><span>Try another word or speaker name.</span></div>}
    </div>
  </section>;
}
