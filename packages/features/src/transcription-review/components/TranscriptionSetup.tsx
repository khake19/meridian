import type { WhisperModel } from '@meridian/contracts';
import { PrimaryButton } from '@meridian/ui';

interface TranscriptionSetupProps { model: WhisperModel; running: boolean; onModelChange(model: WhisperModel): void; onTranscribe(): void; }

export function TranscriptionSetup({ model, running, onModelChange, onTranscribe }: TranscriptionSetupProps) {
  return <section className="transcribe-card">
    <div><p className="eyebrow">READY TO PROCESS</p><h2>Choose transcription quality</h2><p>Large-v3 gives the strongest Taglish accuracy. Medium is useful for quicker drafts.</p></div>
    <div className="transcribe-controls"><label>AI model<select value={model} onChange={(event) => onModelChange(event.target.value as WhisperModel)}><option value="large-v3">Best accuracy · Large-v3</option><option value="medium">Faster draft · Medium</option></select></label><PrimaryButton disabled={running} onClick={onTranscribe}>Start transcription</PrimaryButton></div>
  </section>;
}
