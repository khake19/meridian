import type { ReviewProjectDetails } from '@meridian/contracts';
import { StatusDot } from './StatusDot';
import type { DiarizationSetupState } from '../types/transcription-review.types';
import { formatRecordingTitle } from '../utils/format-recording-title';
import meridianMark from '../../assets/meridian-mark.svg';

interface ProjectSidebarProps {
  activeProjectId?: string;
  recentProjects: ReviewProjectDetails['project'][];
  loadingRecent: boolean;
  importing: boolean;
  processingProjectId: string | null;
  diarizationSetup: DiarizationSetupState;
  hfToken: string;
  onHfTokenChange(token: string): void;
  onImport(): void;
  onOpenProject(projectId: string): void;
  onDeleteProject(projectId: string): void;
  onInstallDiarization(): void;
}

export function ProjectSidebar({
  activeProjectId,
  recentProjects,
  loadingRecent,
  importing,
  processingProjectId,
  diarizationSetup,
  hfToken,
  onHfTokenChange,
  onImport,
  onOpenProject,
  onDeleteProject,
  onInstallDiarization,
}: ProjectSidebarProps) {
  const setupReady = diarizationSetup === 'installed';
  const processing = Boolean(processingProjectId);

  return <aside className="sidebar">
    <div className="brand"><span className="brand-mark"><img src={meridianMark} alt="" /></span><div><strong>Meridian</strong><small>Case transcription</small></div></div>
    <button className="new-project" disabled={importing} onClick={onImport}><span>＋</span>{importing ? 'Importing…' : 'New transcription'}</button>

    <nav className="project-nav" aria-label="Recordings">
      <div className="nav-heading"><span>Recordings</span><small>{recentProjects.length}</small></div>
      {loadingRecent && <p className="muted">Loading projects…</p>}
      {!loadingRecent && recentProjects.length === 0 && <p className="muted">Your imported recordings will appear here.</p>}
      {recentProjects.map((project) => {
        const status = processingProjectId === project.id ? 'processing' : project.status;
        return <div className="project-item" key={project.id}>
        <button className={`project-link${activeProjectId === project.id ? ' selected' : ''}`} aria-pressed={activeProjectId === project.id} onClick={() => onOpenProject(project.id)}>
          <span className="project-icon">◫</span><span><strong>{formatRecordingTitle(project.title)}</strong><small><span className={`project-status ${status}`}>{status === 'review' ? 'Ready' : status}</span><span> · {new Date(project.lastOpenedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></small></span>
        </button>
        <button className="project-delete" aria-label={`Delete ${project.title}`} onClick={() => onDeleteProject(project.id)}>×</button>
      </div>})}
    </nav>

    <div className="sidebar-footer">
      <div className="local-status"><StatusDot state={setupReady ? 'ready' : diarizationSetup === 'failed' ? 'error' : 'busy'} /><span><strong>{processing ? 'Processing locally' : setupReady ? 'Local engine ready' : 'Setup required'}</strong><small>{processing ? 'Audio never leaves this Mac' : 'Processing stays on this Mac'}</small></span></div>
      {!setupReady && diarizationSetup !== 'checking' && <details className="setup-panel" open>
        <summary>Install speaker detection</summary><p>Use a read-only Hugging Face token once.</p>
        <input type="password" aria-label="Hugging Face token" autoComplete="off" placeholder="hf_…" value={hfToken} disabled={diarizationSetup === 'installing'} onChange={(event) => onHfTokenChange(event.target.value)} />
        <button disabled={!hfToken.trim() || diarizationSetup === 'installing'} onClick={onInstallDiarization}>{diarizationSetup === 'installing' ? 'Downloading…' : 'Install model'}</button>
        <small>Your token is never saved.</small>
      </details>}
    </div>
  </aside>;
}
