export function ProcessingStatus({ status, progress }: { status: string; progress: number }) {
  return <section className="processing-strip"><div><span className="spinner" /><span><strong>Transcribing locally</strong><small>{status}</small></span><b>{Math.round(progress)}%</b></div><progress max="100" value={progress} /></section>;
}
