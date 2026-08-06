import { useEffect, useRef, useState } from 'react';
import { transcriptTagDefinitions, type ReviewProjectDetails, type TranscriptTagCode } from '@meridian/contracts';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@meridian/ui';
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

export function ConversationSegment({ segment, project, active, autoFollow, speakerChanged, autoEdit, onSeek, onTextChange, onTextCommit, onSpeakerChange, onTagChange, onTimeChange, onDelete }: ConversationSegmentProps) {
  const rowRef = useRef<HTMLElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [editingTime, setEditingTime] = useState(false);
  const [timeValue, setTimeValue] = useState(formatDuration(segment.startMs));
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
      <strong className="segment-speaker">{speakerName}</strong>
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
          <button className="conversation-more" aria-label="More conversation actions">•••</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="conversation-menu" align="end">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="conversation-submenu-trigger">Change speaker <span aria-hidden="true">›</span></DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="conversation-menu conversation-speaker-menu">
              <DropdownMenuItem onSelect={() => onSpeakerChange(segment.id, null)}>Unassigned<MenuCheckIcon checked={segment.speakerId === null} /></DropdownMenuItem>
              {project.speakers?.map((option) => <DropdownMenuItem key={option.id} onSelect={() => onSpeakerChange(segment.id, option.id)}>{option.displayName}<MenuCheckIcon checked={segment.speakerId === option.id} /></DropdownMenuItem>)}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="conversation-submenu-trigger">Tags <span aria-hidden="true">›</span></DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="conversation-menu conversation-tag-menu">
              {transcriptTagDefinitions.map((tag) => {
                const assigned = segment.tags.includes(tag.code);
                return <DropdownMenuItem key={tag.code} onSelect={() => onTagChange(segment.id, tag.code, !assigned)}><i className="tag-dot" style={{ backgroundColor: tag.color }} />{tag.label}<MenuCheckIcon checked={assigned} /></DropdownMenuItem>;
              })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onSelect={() => { setTimeValue(formatDuration(segment.startMs)); setEditingTime(true); }}>Edit timestamp</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="conversation-menu-delete" onSelect={() => onDelete(segment.id)}>Delete conversation</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </article>;
}
