import { useEffect, useRef } from 'react';
import { transcriptTagDefinitions, type TranscriptTagCode } from '@meridian/contracts';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@meridian/ui';
import type { SaveState } from '../types/transcription-review.types';
import { StatusDot } from './StatusDot';
import { MenuCheckIcon } from './MenuCheckIcon';

interface TranscriptToolbarProps {
  searchQuery: string;
  tagFilters: TranscriptTagCode[];
  resultCount: number;
  hasSearchQuery: boolean;
  saveState: SaveState;
  followingPaused: boolean;
  onSearchChange(value: string): void;
  onToggleTag(tagCode: TranscriptTagCode): void;
  onClearTags(): void;
  onResumeFollow(): void;
}

export function TranscriptToolbar({
  searchQuery,
  tagFilters,
  resultCount,
  hasSearchQuery,
  saveState,
  followingPaused,
  onSearchChange,
  onToggleTag,
  onClearTags,
  onResumeFollow,
}: TranscriptToolbarProps) {
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'f') {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    }
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

  return (
    <div className="panel-heading">
      <div>
        <p className="eyebrow">TRANSCRIPT</p>
        <h2>Review conversation</h2>
      </div>

      <div className="transcript-heading-actions">
        <div className="transcript-search">
          <svg aria-hidden="true" viewBox="0 0 16 16">
            <circle cx="7" cy="7" r="4.25" />
            <path d="m10.2 10.2 3 3" />
          </svg>
          <input
            ref={searchRef}
            type="search"
            placeholder="Search transcript"
            aria-label="Search transcript"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                onSearchChange('');
                event.currentTarget.blur();
              }
            }}
          />
          {hasSearchQuery && <span>{resultCount}</span>}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={`tag-filter-trigger${tagFilters.length ? ' active' : ''}`}>
              Tags{tagFilters.length ? ` · ${tagFilters.length}` : ''}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="conversation-menu transcript-filter-menu" align="end">
            {transcriptTagDefinitions.map((tag) => (
              <DropdownMenuItem
                key={tag.code}
                onSelect={(event) => {
                  event.preventDefault();
                  onToggleTag(tag.code);
                }}
              >
                <i className="tag-dot" style={{ backgroundColor: tag.color }} />
                {tag.label}
                <MenuCheckIcon checked={tagFilters.includes(tag.code)} />
              </DropdownMenuItem>
            ))}
            {tagFilters.length > 0 && (
              <DropdownMenuItem className="clear-tag-filters" onSelect={onClearTags}>
                Clear filters
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {followingPaused && (
          <button className="resume-follow" onClick={onResumeFollow}>▶ Resume follow</button>
        )}

        <span className={`save-indicator ${saveState}`}>
          <StatusDot state={saveState === 'failed' ? 'error' : saveState === 'saving' ? 'busy' : 'ready'} />
          {saveState === 'saving' ? 'Saving…' : saveState === 'failed' ? 'Save failed' : 'Saved locally'}
        </span>
      </div>
    </div>
  );
}
