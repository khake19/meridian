import type { MeridianPlatform } from '@meridian/platform';

/** Desktop supplies IPC; a future web renderer can supply HTTP. */
export type TranscriptionReviewService = MeridianPlatform;

export function createTranscriptionReviewService(platform: MeridianPlatform): TranscriptionReviewService {
  return platform;
}
