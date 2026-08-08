import type { SpeakerCount, WhisperModel } from '@meridian/contracts';
import { Button, Select } from '@meridian/ui';

interface TranscriptionSetupProps { model: WhisperModel; speakerCount: SpeakerCount; running: boolean; onModelChange(model: WhisperModel): void; onSpeakerCountChange(count: SpeakerCount): void; onTranscribe(): void; }

export function TranscriptionSetup({ model, speakerCount, running, onModelChange, onSpeakerCountChange, onTranscribe }: TranscriptionSetupProps) {
  return <section className="transcribe-card">
    <div><p className="eyebrow">READY TO PROCESS</p><h2>Choose transcription quality</h2><p>Large-v3 gives the strongest Taglish accuracy. Medium is useful for quicker drafts.</p></div>
    <div className="transcribe-controls"><label>AI model<Select value={model} onChange={(event) => onModelChange(event.target.value as WhisperModel)}><option value="large-v3">Best accuracy · Large-v3</option><option value="medium">Faster draft · Medium</option></Select></label><label>Number of speakers<Select value={speakerCount ?? 'auto'} onChange={(event) => onSpeakerCountChange(event.target.value === 'auto' ? null : Number(event.target.value) as SpeakerCount)}><option value="auto">Auto-detect</option><option value="2">2 speakers</option><option value="3">3 speakers</option><option value="4">4 speakers</option></Select></label><Button size="lg" disabled={running} onClick={onTranscribe}>Start transcription</Button></div>
  </section>;
}
