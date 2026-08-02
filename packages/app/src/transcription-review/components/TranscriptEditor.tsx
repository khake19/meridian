import type { ReviewProjectDetails } from '@meridian/contracts';
import { StatusDot } from './StatusDot';
import type { SaveState } from '../types/transcription-review.types';
import { formatDuration } from '../utils/format-duration';

interface TranscriptEditorProps {
  project: ReviewProjectDetails;
  positionMs: number;
  saveState: SaveState;
  onSeek(positionMs: number): void;
  onTextChange(segmentId: string, text: string): void;
  onTextCommit(segmentId: string, text: string): void;
  onSpeakerChange(segmentId: string, speakerId: string | null): void;
}

export function TranscriptEditor({ project, positionMs, saveState, onSeek, onTextChange, onTextCommit, onSpeakerChange }: TranscriptEditorProps) {
  return <section className="transcript-panel">
    <div className="panel-heading"><div><p className="eyebrow">TRANSCRIPT</p><h2>Review conversation</h2></div><span className={`save-indicator ${saveState}`}><StatusDot state={saveState === 'failed' ? 'error' : saveState === 'saving' ? 'busy' : 'ready'} />{saveState === 'saving' ? 'Saving…' : saveState === 'failed' ? 'Save failed' : 'Saved locally'}</span></div>
    <div className="saved-transcript">
      {project.transcript?.map((segment) => <article className={`transcript-segment${positionMs >= segment.startMs && positionMs < segment.endMs ? ' active' : ''}`} key={segment.id}>
        <button className="timestamp" onClick={() => onSeek(segment.startMs)}><span className="play-glyph">▶</span><time>{formatDuration(segment.startMs)}</time></button>
        <div className="segment-body"><select aria-label="Segment speaker" value={segment.speakerId || ''} onChange={(event) => onSpeakerChange(segment.id, event.target.value || null)}><option value="">Unassigned speaker</option>{project.speakers?.map((speaker) => <option key={speaker.id} value={speaker.id}>{speaker.displayName}</option>)}</select><textarea aria-label={`Transcript segment ${segment.sequence + 1}`} value={segment.text} onChange={(event) => onTextChange(segment.id, event.target.value)} onBlur={(event) => onTextCommit(segment.id, event.target.value)} /></div>
      </article>)}
    </div>
  </section>;
}
