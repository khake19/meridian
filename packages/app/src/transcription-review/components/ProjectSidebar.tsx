import type { ReviewProjectDetails } from '@meridian/contracts';
import { StatusDot } from './StatusDot';
import type { DiarizationSetupState } from '../types/transcription-review.types';

interface ProjectSidebarProps {
  activeProjectId?: string;
  recentProjects: ReviewProjectDetails['project'][];
  loadingRecent: boolean;
  importing: boolean;
  diarizationSetup: DiarizationSetupState;
  hfToken: string;
  onHfTokenChange(token: string): void;
  onImport(): void;
  onOpenProject(projectId: string): void;
  onInstallDiarization(): void;
}

export function ProjectSidebar({
  activeProjectId,
  recentProjects,
  loadingRecent,
  importing,
  diarizationSetup,
  hfToken,
  onHfTokenChange,
  onImport,
  onOpenProject,
  onInstallDiarization,
}: ProjectSidebarProps) {
  const setupReady = diarizationSetup === 'installed';

  return <aside className="sidebar">
    <div className="brand"><span className="brand-mark">M</span><div><strong>Meridian</strong><small>Case transcription</small></div></div>
    <button className="new-project" disabled={importing} onClick={onImport}><span>＋</span>{importing ? 'Importing…' : 'New transcription'}</button>

    <nav className="project-nav" aria-label="Recent projects">
      <div className="nav-heading"><span>Recent cases</span><small>{recentProjects.length}</small></div>
      {loadingRecent && <p className="muted">Loading projects…</p>}
      {!loadingRecent && recentProjects.length === 0 && <p className="muted">Your imported recordings will appear here.</p>}
      {recentProjects.map((project) => <button className={`project-link${activeProjectId === project.id ? ' selected' : ''}`} key={project.id} aria-pressed={activeProjectId === project.id} onClick={() => onOpenProject(project.id)}>
        <span className="project-icon">◫</span><span><strong>{project.title}</strong><small>{new Date(project.lastOpenedAt).toLocaleDateString()}</small></span>
      </button>)}
    </nav>

    <div className="sidebar-footer">
      <div className="local-status"><StatusDot state={setupReady ? 'ready' : diarizationSetup === 'failed' ? 'error' : 'busy'} /><span><strong>{setupReady ? 'Offline AI ready' : 'Setup required'}</strong><small>Processing stays on this Mac</small></span></div>
      {!setupReady && diarizationSetup !== 'checking' && <details className="setup-panel" open>
        <summary>Install speaker detection</summary><p>Use a read-only Hugging Face token once.</p>
        <input type="password" aria-label="Hugging Face token" autoComplete="off" placeholder="hf_…" value={hfToken} disabled={diarizationSetup === 'installing'} onChange={(event) => onHfTokenChange(event.target.value)} />
        <button disabled={!hfToken.trim() || diarizationSetup === 'installing'} onClick={onInstallDiarization}>{diarizationSetup === 'installing' ? 'Downloading…' : 'Install model'}</button>
        <small>Your token is never saved.</small>
      </details>}
    </div>
  </aside>;
}
