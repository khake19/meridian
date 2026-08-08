import { useEffect, useRef, useState } from 'react';
import { transcriptTagDefinitions, type ReviewProjectDetails, type TranscriptTagCode } from '@meridian/contracts';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@meridian/ui';
import { EditableTranscriptText } from './EditableTranscriptText';
import { MenuCheckIcon } from './MenuCheckIcon';
import { formatDuration } from '../utils/format-duration';

type TranscriptSegment = NonNullable<ReviewProjectDetails['transcript']>[number];

interface ConversationSegmentProps {
  segment: TranscriptSegment;
  project: ReviewProjectDetails;
  active: boolean;
  autoFollow: boolean;
  speakerChanged: boolean;
  autoEdit: boolean;
  onSeek(positionMs: number): void;
  onTextChange(segmentId: string, text: string): void;
  onTextCommit(segmentId: string, text: string): void;
  onSpeakerChange(segmentId: string, speakerId: string | null): void;
  onTagChange(segmentId: string, tagCode: TranscriptTagCode, assigned: boolean): void;
  onTimeChange(segmentId: string, startMs: number, endMs: number): void;
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

export function ConversationSegment({ segment, project, active, autoFollow, speakerChanged, autoEdit, onSeek, onTextChange, onTextCommit, onSpeakerChange, onTagChange, onTimeChange, onDelete }: ConversationSegmentProps) {
  const rowRef = useRef<HTMLElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [editingTime, setEditingTime] = useState(false);
  const [startTimeValue, setStartTimeValue] = useState(formatDuration(segment.startMs));
  const [endTimeValue, setEndTimeValue] = useState(formatDuration(segment.endMs));
  const speakerIndex = project.speakers?.findIndex((speaker) => speaker.id === segment.speakerId) ?? -1;
  const speaker = speakerIndex >= 0 ? project.speakers?.[speakerIndex] : undefined;
  const speakerName = speaker?.displayName || 'Unassigned';
  const initial = speakerName === 'Unassigned' ? '?' : speakerName.trim().charAt(0).toUpperCase();

  useEffect(() => {
    if (autoFollow) rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [autoFollow]);

  useEffect(() => {
    if (autoEdit) setEditing(true);
  }, [autoEdit]);

  const colorIndex = Math.max(speakerIndex, 0) % 4;

  function commitTime() {
    const startMs = parseTimestamp(startTimeValue);
    const endMs = parseTimestamp(endTimeValue);
    if (startMs === null || endMs === null || endMs <= startMs) {
      setStartTimeValue(formatDuration(segment.startMs));
      setEndTimeValue(formatDuration(segment.endMs));
    } else if (startMs !== segment.startMs || endMs !== segment.endMs) {
      onTimeChange(segment.id, startMs, endMs);
    }
    setEditingTime(false);
  }

  return <article ref={rowRef} data-segment-id={segment.id} className={`transcript-segment speaker-color-${colorIndex}${active ? ' active' : ''}${speakerChanged ? ' speaker-changed' : ''}`}>
    <span className={`speaker-avatar color-${colorIndex}`} aria-hidden="true">{initial}</span>
    <div className="segment-body">
      <div className="segment-heading">
        <span className="segment-speaker-control"><strong className="segment-speaker">{speakerName}</strong><DropdownMenu><DropdownMenuTrigger asChild><button className="speaker-change" aria-label={`Change speaker from ${speakerName}`}><svg aria-hidden="true" viewBox="0 0 16 16"><path d="M5.3 7.2a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8ZM1.8 13c.2-2.2 1.4-3.4 3.5-3.4 1.1 0 2 .3 2.6 1M10.5 5.2h3M12 3.7v3M9.5 12h4M11.8 9.7l2.2 2.3-2.2 2.3" /></svg></button></DropdownMenuTrigger><DropdownMenuContent className="conversation-menu conversation-speaker-menu" align="start"><DropdownMenuItem onSelect={() => onSpeakerChange(segment.id, null)}>Unassigned<MenuCheckIcon checked={segment.speakerId === null} /></DropdownMenuItem>{project.speakers?.map((option) => <DropdownMenuItem key={option.id} onSelect={() => onSpeakerChange(segment.id, option.id)}>{option.displayName}<MenuCheckIcon checked={segment.speakerId === option.id} /></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu></span>
        <span className="timestamp-control">
          {editingTime
            ? <span className="timestamp-range-inputs" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) commitTime(); }}><input className="timestamp-input" aria-label="Conversation start time" autoFocus value={startTimeValue} onChange={(event) => setStartTimeValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') commitTime(); if (event.key === 'Escape') { setStartTimeValue(formatDuration(segment.startMs)); setEndTimeValue(formatDuration(segment.endMs)); setEditingTime(false); } }} /><span>–</span><input className="timestamp-input" aria-label="Conversation end time" value={endTimeValue} onChange={(event) => setEndTimeValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') commitTime(); if (event.key === 'Escape') { setStartTimeValue(formatDuration(segment.startMs)); setEndTimeValue(formatDuration(segment.endMs)); setEditingTime(false); } }} /></span>
            : <span className="timestamp-pill"><button className="timestamp" onClick={() => onSeek(segment.startMs)}><svg className="timestamp-clock" aria-hidden="true" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5" /><path d="M8 4.8v3.5l2.3 1.4" /></svg><time>{formatDuration(segment.startMs)}<span className="timestamp-separator" aria-hidden="true">–</span>{formatDuration(segment.endMs)}</time></button><button className="timestamp-edit" aria-label="Edit conversation time range" onClick={() => { setStartTimeValue(formatDuration(segment.startMs)); setEndTimeValue(formatDuration(segment.endMs)); setEditingTime(true); }}><svg aria-hidden="true" viewBox="0 0 16 16"><path d="m3 11.8-.5 2.1 2.1-.5 7.7-7.7-1.6-1.6zM9.8 5l1.6 1.6" /></svg></button></span>}
        </span>
      </div>
      <EditableTranscriptText ref={editorRef} text={segment.text} label={`Transcript segment ${segment.sequence + 1}`} editing={editing} onActivate={() => onSeek(segment.startMs)} onChange={(text) => onTextChange(segment.id, text)} onCommit={(text) => onTextCommit(segment.id, text)} onFinishEditing={() => setEditing(false)} />
      {segment.tags.length > 0 && <div className="segment-tags">{segment.tags.slice(0, 4).map((code) => {
        const tag = transcriptTagDefinitions.find((candidate) => candidate.code === code);
        return tag ? <span key={code} style={{ backgroundColor: `${tag.color}14`, borderColor: `${tag.color}38` }}><i className="tag-dot" style={{ backgroundColor: tag.color }} />{tag.label}</span> : null;
      })}{segment.tags.length > 4 && <span>+{segment.tags.length - 4}</span>}</div>}
    </div>
    <div className="segment-actions" aria-label="Conversation actions">
      <button onMouseDown={(event) => event.preventDefault()} onClick={() => setEditing(true)}>Edit</button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button>Tags{segment.tags.length > 0 && <span className="segment-action-count">{segment.tags.length}</span>}</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="conversation-menu conversation-tag-menu" align="end">
          {transcriptTagDefinitions.map((tag) => {
            const assigned = segment.tags.includes(tag.code);
            return <DropdownMenuItem key={tag.code} onSelect={() => onTagChange(segment.id, tag.code, !assigned)}><i className="tag-dot" style={{ backgroundColor: tag.color }} />{tag.label}<MenuCheckIcon checked={assigned} /></DropdownMenuItem>;
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      <button className="segment-delete" aria-label="Delete conversation" onClick={() => onDelete(segment.id)}><svg aria-hidden="true" viewBox="0 0 16 16"><path d="M3.5 4.5h9M6.2 4.5V3h3.6v1.5M5 6.5l.5 6h5l.5-6M7 7.5v3.2M9 7.5v3.2" /></svg></button>
    </div>
  </article>;
}
