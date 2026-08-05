import type { MeridianPlatform } from '@meridian/platform';

export interface TranscriptionReviewModuleProps {
  platform: MeridianPlatform;
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'failed';
export type DiarizationSetupState = 'checking' | 'missing' | 'installing' | 'installed' | 'failed';
