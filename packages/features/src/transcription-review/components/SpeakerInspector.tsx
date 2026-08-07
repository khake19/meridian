import type { ReviewProjectDetails, WhisperModel } from '@meridian/contracts';
import { Button, Input, Select } from '@meridian/ui';
import { formatDuration } from '../utils/format-duration';

function formatLanguage(language: string | null | undefined) {
  if (!language) return 'Language unavailable';
  const names: Record<string, string> = { en: 'English', tl: 'Tagalog', fil: 'Filipino' };
  return names[language.toLowerCase()] || language.toUpperCase();
}

interface SpeakerInspectorProps {
  project: ReviewProjectDetails;
  model: WhisperModel;
  running: boolean;
  onRenameSpeaker(speakerId: string, name: string): void;
  onModelChange(model: WhisperModel): void;
  onTranscribe(): void;
  onDeleteTranscript(): void;
}

export function SpeakerInspector({ project, model, running, onRenameSpeaker, onModelChange, onTranscribe, onDeleteTranscript }: SpeakerInspectorProps) {
  const run = project.latestProcessingRun;
  const completed = run && (run.status === 'completed' || run.status === 'partial');

  return <aside className="inspector">
    <section className="inspector-card"><div className="panel-heading small"><h3>Speakers</h3><span>{project.speakers?.length || 0}</span></div><p className="muted">Rename once to update every assigned segment.</p><div className="speaker-list">{project.speakers?.map((speaker, index) => <label key={speaker.id}><small>{speaker.diarizationLabel.replace('_', ' ')}</small><span><i className={`speaker-swatch color-${index % 4}`} /><Input aria-label={`Rename ${speaker.displayName}`} defaultValue={speaker.displayName} onBlur={(event) => onRenameSpeaker(speaker.id, event.target.value)} /></span></label>)}</div></section>
    <section className="inspector-card"><h3>Transcription</h3>{completed && <dl className="transcription-summary"><div><dt>Result</dt><dd>{run.model === 'large-v3' ? 'Large-v3' : 'Medium'} · {formatLanguage(run.language)}</dd></div>{run.elapsedMs !== null && <div><dt>Processing time</dt><dd>{formatDuration(run.elapsedMs)}</dd></div>}{run.completedAt && <div><dt>Completed</dt><dd>{new Date(run.completedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</dd></div>}</dl>}<label>AI model<Select value={model} onChange={(event) => onModelChange(event.target.value as WhisperModel)}><option value="large-v3">Large-v3 · best</option><option value="medium">Medium · faster</option></Select></label><Button variant="secondary" size="sm" className="retranscribe-action" disabled={running} onClick={onTranscribe}>Transcribe again</Button><Button variant="destructive" size="sm" className="delete-transcript" disabled={running} onClick={onDeleteTranscript}>Delete transcript</Button></section>
  </aside>;
}
