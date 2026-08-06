import { useMemo, useState } from 'react';
import type { ReviewProjectDetails, TranscriptTagCode } from '@meridian/contracts';

type TranscriptSegment = NonNullable<ReviewProjectDetails['transcript']>[number];
type Speaker = NonNullable<ReviewProjectDetails['speakers']>[number];

export function useTranscriptFilters(segments: TranscriptSegment[], speakers: Speaker[]) {
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilters, setTagFilters] = useState<TranscriptTagCode[]>([]);
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();

  const visibleSegments = useMemo(() => segments.filter((segment) => {
    const speaker = speakers.find((candidate) => candidate.id === segment.speakerId)?.displayName || 'Unassigned';
    const matchesSearch = !normalizedQuery
      || segment.text.toLocaleLowerCase().includes(normalizedQuery)
      || speaker.toLocaleLowerCase().includes(normalizedQuery);
    const matchesTags = tagFilters.length === 0
      || tagFilters.some((tag) => segment.tags.includes(tag));
    return matchesSearch && matchesTags;
  }), [normalizedQuery, segments, speakers, tagFilters]);

  function toggleTagFilter(tagCode: TranscriptTagCode) {
    setTagFilters((current) => current.includes(tagCode)
      ? current.filter((code) => code !== tagCode)
      : [...current, tagCode]);
  }

  return {
    searchQuery,
    setSearchQuery,
    tagFilters,
    toggleTagFilter,
    clearTagFilters: () => setTagFilters([]),
    visibleSegments,
    hasActiveFilters: Boolean(normalizedQuery || tagFilters.length),
    hasSearchQuery: Boolean(normalizedQuery),
  };
}
