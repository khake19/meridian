import { useEffect, useRef, useState } from 'react';
import type { ReviewProjectDetails } from '@meridian/contracts';
import { EditableTranscriptText } from './EditableTranscriptText';
import { formatDuration } from '../utils/format-duration';

type TranscriptSegment = NonNullable<ReviewProjectDetails['transcript']>[number];

interface ConversationSegmentProps {
  segment: TranscriptSegment;
  project: ReviewProjectDetails;
  active: boolean;
  speakerChanged: boolean;
  onSeek(positionMs: number): void;
  onTextChange(segmentId: string, text: string): void;
  onTextCommit(segmentId: string, text: string): void;
  onSpeakerChange(segmentId: string, speakerId: string | null): void;
  onTimeChange(segmentId: string, startMs: number): void;
  onDelete(segmentId: string): void;
}

function parseTimestamp(value: string) {
  const parts = value.trim().split(':');
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) return null;
  const numbers = parts.map(Number);
  const [hours, minutes, seconds] = numbers.length === 3 ? numbers : [0, numbers[0], numbers[1]];
  if (minutes === undefined || seconds === undefined || seconds >= 60 || (numbers.length === 3 && minutes >= 60)) return null;
  return ((hours || 0) * 3600 + minutes * 60 + seconds) * 1000;
}

export function ConversationSegment({ segment, project, active, speakerChanged, onSeek, onTextChange, onTextCommit, onSpeakerChange, onTimeChange, onDelete }: ConversationSegmentProps) {
  const rowRef = useRef<HTMLElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [changingSpeaker, setChangingSpeaker] = useState(false);
  const [editingTime, setEditingTime] = useState(false);
  const [timeValue, setTimeValue] = useState(formatDuration(segment.startMs));
  const speakerIndex = project.speakers?.findIndex((speaker) => speaker.id === segment.speakerId) ?? -1;
  const speaker = speakerIndex >= 0 ? project.speakers?.[speakerIndex] : undefined;
  const speakerName = speaker?.displayName || 'Unassigned';
  const initial = speakerName === 'Unassigned' ? '?' : speakerName.trim().charAt(0).toUpperCase();

  useEffect(() => {
    if (active) rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [active]);

  const colorIndex = Math.max(speakerIndex, 0) % 4;

  function commitTime() {
    const startMs = parseTimestamp(timeValue);
    if (startMs === null) {
      setTimeValue(formatDuration(segment.startMs));
    } else if (startMs !== segment.startMs) {
      onTimeChange(segment.id, startMs);
    }
    setEditingTime(false);
  }

  return <article ref={rowRef} data-segment-id={segment.id} className={`transcript-segment speaker-color-${colorIndex}${active ? ' active' : ''}${speakerChanged ? ' speaker-changed' : ''}`}>
    {editingTime
      ? <input className="timestamp-input" aria-label="Conversation start time" autoFocus value={timeValue} onChange={(event) => setTimeValue(event.target.value)} onBlur={commitTime} onKeyDown={(event) => { if (event.key === 'Enter') commitTime(); if (event.key === 'Escape') { setTimeValue(formatDuration(segment.startMs)); setEditingTime(false); } }} />
      : <button className="timestamp" onClick={() => onSeek(segment.startMs)}><time>{formatDuration(segment.startMs)}</time></button>}
    <span className={`speaker-avatar color-${colorIndex}`} aria-hidden="true">{initial}</span>
    <div className="segment-body">
      {changingSpeaker ? <select className="speaker-picker" aria-label="Change segment speaker" autoFocus value={segment.speakerId || ''} onChange={(event) => { onSpeakerChange(segment.id, event.target.value || null); setChangingSpeaker(false); }} onBlur={() => setChangingSpeaker(false)}>
        <option value="">Unassigned speaker</option>{project.speakers?.map((option) => <option key={option.id} value={option.id}>{option.displayName}</option>)}
      </select> : <strong className="segment-speaker">{speakerName}</strong>}
      <EditableTranscriptText ref={editorRef} text={segment.text} label={`Transcript segment ${segment.sequence + 1}`} editing={editing} onActivate={() => onSeek(segment.startMs)} onChange={(text) => onTextChange(segment.id, text)} onCommit={(text) => onTextCommit(segment.id, text)} onFinishEditing={() => setEditing(false)} />
    </div>
    <div className="segment-actions" aria-label="Conversation actions">
      <button onMouseDown={(event) => event.preventDefault()} onClick={() => setEditing(true)}>Edit</button>
      <button onMouseDown={(event) => event.preventDefault()} onClick={() => { setTimeValue(formatDuration(segment.startMs)); setEditingTime(true); }}>Edit time</button>
      <button onClick={() => setChangingSpeaker(true)}>Change speaker</button>
      <button className="delete-action" onMouseDown={(event) => event.preventDefault()} onClick={() => onDelete(segment.id)}>Delete</button>
    </div>
  </article>;
}
