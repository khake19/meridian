import type { ReactNode } from 'react';
import type { ReviewProjectDetails, SpeakerCount, WhisperModel } from '@meridian/contracts';
import { Button, Input, Select } from '@meridian/ui';
import { formatDuration } from '../utils/format-duration';

function formatLanguage(language: string | null | undefined) {
  if (!language) return 'Language unavailable';
  const names: Record<string, string> = { en: 'English', tl: 'Tagalog', fil: 'Filipino' };
  return names[language.toLowerCase()] || language.toUpperCase();
}

interface InspectorSectionProps {
  title: string;
  count?: number;
  description?: string;
  children: ReactNode;
}

function InspectorSection({ title, count, description, children }: InspectorSectionProps) {
  return (
    <section className="inspector-card">
      <header className="inspector-heading">
        <h3>{title}</h3>
        {count !== undefined && <span>{count}</span>}
      </header>
      {description && <p className="inspector-description">{description}</p>}
      {children}
    </section>
  );
}

interface SpeakerInspectorProps {
  project: ReviewProjectDetails;
  model: WhisperModel;
  speakerCount: SpeakerCount;
  running: boolean;
  onRenameSpeaker(speakerId: string, name: string): void;
  onModelChange(model: WhisperModel): void;
  onSpeakerCountChange(count: SpeakerCount): void;
  onTranscribe(): void;
  onDeleteTranscript(): void;
}

export function SpeakerInspector({
  project,
  model,
  speakerCount,
  running,
  onRenameSpeaker,
  onModelChange,
  onSpeakerCountChange,
  onTranscribe,
  onDeleteTranscript,
}: SpeakerInspectorProps) {
  const run = project.latestProcessingRun;
  const completed = run && (run.status === 'completed' || run.status === 'partial');

  return (
    <aside className="inspector">
      <InspectorSection
        title="Speakers"
        count={project.speakers?.length || 0}
        description="Rename once to update every assigned segment."
      >
        <div className="speaker-list">
          {project.speakers?.map((speaker, index) => (
            <label className="inspector-field" key={speaker.id}>
              <span className="inspector-field-label">{speaker.diarizationLabel.replace('_', ' ')}</span>
              <span className="speaker-control">
                <i className={`speaker-swatch color-${index % 4}`} />
                <Input
                  aria-label={`Rename ${speaker.displayName}`}
                  defaultValue={speaker.displayName}
                  onBlur={(event) => onRenameSpeaker(speaker.id, event.target.value)}
                />
              </span>
            </label>
          ))}
        </div>
      </InspectorSection>

      <InspectorSection title="Transcription">
        {completed && (
          <dl className="transcription-summary">
            <div><dt>Result</dt><dd>{run.model === 'large-v3' ? 'Large-v3' : 'Medium'} · {formatLanguage(run.language)}</dd></div>
            {run.elapsedMs !== null && <div><dt>Processing time</dt><dd>{formatDuration(run.elapsedMs)}</dd></div>}
            {run.completedAt && <div><dt>Completed</dt><dd>{new Date(run.completedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</dd></div>}
          </dl>
        )}

        <label className="inspector-field">
          <span className="inspector-field-label pb-1">AI model</span>
          <Select value={model} onChange={(event) => onModelChange(event.target.value as WhisperModel)}>
            <option value="large-v3">Large-v3 · best</option>
            <option value="medium">Medium · faster</option>
          </Select>
        </label>

        <label className="inspector-field">
          <span className="inspector-field-label">Number of speakers</span>
          <Select value={speakerCount ?? 'auto'} onChange={(event) => onSpeakerCountChange(event.target.value === 'auto' ? null : Number(event.target.value) as SpeakerCount)}>
            <option value="auto">Auto-detect</option>
            <option value="2">2 speakers</option>
            <option value="3">3 speakers</option>
            <option value="4">4 speakers</option>
          </Select>
        </label>

        <div className="inspector-actions">
          <Button variant="secondary" size="sm" className="retranscribe-action" disabled={running} onClick={onTranscribe}>
            Transcribe again
          </Button>
          <Button variant="destructive" size="sm" className="delete-transcript" disabled={running} onClick={onDeleteTranscript}>
            Delete transcript
          </Button>
        </div>
      </InspectorSection>
    </aside>
  );
}
