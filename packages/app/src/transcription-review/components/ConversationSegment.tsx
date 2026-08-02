import { useRef, useState } from 'react';
import type { ReviewProjectDetails } from '@meridian/contracts';
import { EditableTranscriptText } from './EditableTranscriptText';
import { formatDuration } from '../utils/format-duration';

type TranscriptSegment = NonNullable<ReviewProjectDetails['transcript']>[number];

interface ConversationSegmentProps {
  segment: TranscriptSegment;
  project: ReviewProjectDetails;
  active: boolean;
  onSeek(positionMs: number): void;
  onTextChange(segmentId: string, text: string): void;
  onTextCommit(segmentId: string, text: string): void;
  onSpeakerChange(segmentId: string, speakerId: string | null): void;
}

export function ConversationSegment({ segment, project, active, onSeek, onTextChange, onTextCommit, onSpeakerChange }: ConversationSegmentProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [changingSpeaker, setChangingSpeaker] = useState(false);
  const speakerIndex = project.speakers?.findIndex((speaker) => speaker.id === segment.speakerId) ?? -1;
  const speaker = speakerIndex >= 0 ? project.speakers?.[speakerIndex] : undefined;
  const speakerName = speaker?.displayName || 'Unassigned';
  const initial = speakerName === 'Unassigned' ? '?' : speakerName.trim().charAt(0).toUpperCase();

  return <article className={`transcript-segment${active ? ' active' : ''}`}>
    <button className="timestamp" onClick={() => onSeek(segment.startMs)}><time>{formatDuration(segment.startMs)}</time></button>
    <span className={`speaker-avatar color-${Math.max(speakerIndex, 0) % 4}`} aria-hidden="true">{initial}</span>
    <div className="segment-body">
      {changingSpeaker ? <select className="speaker-picker" aria-label="Change segment speaker" autoFocus value={segment.speakerId || ''} onChange={(event) => { onSpeakerChange(segment.id, event.target.value || null); setChangingSpeaker(false); }} onBlur={() => setChangingSpeaker(false)}>
        <option value="">Unassigned speaker</option>{project.speakers?.map((option) => <option key={option.id} value={option.id}>{option.displayName}</option>)}
      </select> : <strong className="segment-speaker">{speakerName}</strong>}
      <EditableTranscriptText ref={editorRef} text={segment.text} label={`Transcript segment ${segment.sequence + 1}`} editing={editing} onActivate={() => onSeek(segment.startMs)} onChange={(text) => onTextChange(segment.id, text)} onCommit={(text) => onTextCommit(segment.id, text)} onFinishEditing={() => setEditing(false)} />
    </div>
    <div className="segment-actions" aria-label="Conversation actions">
      <button onMouseDown={(event) => event.preventDefault()} onClick={() => setEditing(true)}>Edit</button>
      <button onClick={() => setChangingSpeaker(true)}>Change speaker</button>
    </div>
  </article>;
}
