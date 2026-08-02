export type StatusDotState = 'ready' | 'busy' | 'error';

export function StatusDot({ state }: { state: StatusDotState }) {
  return <span className={`status-dot ${state}`} aria-hidden="true" />;
}
