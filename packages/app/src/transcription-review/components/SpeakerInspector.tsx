import type { ReviewProjectDetails, WhisperModel } from '@meridian/contracts';

interface SpeakerInspectorProps {
  project: ReviewProjectDetails;
  model: WhisperModel;
  running: boolean;
  newSpeakerName: string;
  onNewSpeakerNameChange(name: string): void;
  onCreateSpeaker(): void;
  onRenameSpeaker(speakerId: string, name: string): void;
  onModelChange(model: WhisperModel): void;
  onTranscribe(): void;
}

export function SpeakerInspector({ project, model, running, newSpeakerName, onNewSpeakerNameChange, onCreateSpeaker, onRenameSpeaker, onModelChange, onTranscribe }: SpeakerInspectorProps) {
  return <aside className="inspector">
    <section className="inspector-card"><div className="panel-heading small"><h3>Speakers</h3><span>{project.speakers?.length || 0}</span></div><p className="muted">Rename once to update every assigned segment.</p><div className="speaker-list">{project.speakers?.map((speaker, index) => <label key={speaker.id}><span className={`speaker-swatch color-${index % 4}`} /><input aria-label={`Rename ${speaker.displayName}`} defaultValue={speaker.displayName} onBlur={(event) => onRenameSpeaker(speaker.id, event.target.value)} /></label>)}</div><div className="add-speaker"><input aria-label="New speaker name" placeholder="Add a speaker" value={newSpeakerName} maxLength={100} onChange={(event) => onNewSpeakerNameChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onCreateSpeaker(); }} /><button disabled={!newSpeakerName.trim()} onClick={onCreateSpeaker}>＋</button></div></section>
    <section className="inspector-card"><h3>Transcription</h3><label>AI model<select value={model} onChange={(event) => onModelChange(event.target.value as WhisperModel)}><option value="large-v3">Large-v3 · best</option><option value="medium">Medium · faster</option></select></label><button className="secondary full" disabled={running} onClick={onTranscribe}>Run transcription again</button></section>
  </aside>;
}
