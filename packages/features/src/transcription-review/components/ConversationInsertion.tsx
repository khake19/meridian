import { formatDuration } from '../utils/format-duration';

interface ConversationInsertionProps {
  startMs: number;
  onInsert(startMs: number): void;
}

export function ConversationInsertion({ startMs, onInsert }: ConversationInsertionProps) {
  return <div className="conversation-insertion">
    <span />
    <button onClick={() => onInsert(startMs)} aria-label={`Add conversation at ${formatDuration(startMs)}`}>
      <b>＋</b><span>Add conversation here</span>
    </button>
    <span />
  </div>;
}
