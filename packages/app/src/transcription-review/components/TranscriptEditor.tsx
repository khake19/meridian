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
}

export function TranscriptEditor({ project, positionMs, saveState, onSeek, onTextChange, onTextCommit, onSpeakerChange }: TranscriptEditorProps) {
  return <section className="transcript-panel">
    <div className="panel-heading"><div><p className="eyebrow">TRANSCRIPT</p><h2>Review conversation</h2></div><span className={`save-indicator ${saveState}`}><StatusDot state={saveState === 'failed' ? 'error' : saveState === 'saving' ? 'busy' : 'ready'} />{saveState === 'saving' ? 'Saving…' : saveState === 'failed' ? 'Save failed' : 'Saved locally'}</span></div>
    <div className="saved-transcript">
      {project.transcript?.map((segment) => <ConversationSegment key={segment.id} segment={segment} project={project} active={positionMs >= segment.startMs && positionMs < segment.endMs} onSeek={onSeek} onTextChange={onTextChange} onTextCommit={onTextCommit} onSpeakerChange={onSpeakerChange} />)}
    </div>
  </section>;
}
