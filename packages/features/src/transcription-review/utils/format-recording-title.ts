function embeddedDate(value: string) {
  for (const match of value.matchAll(/\d{8}/g)) {
    const digits = match[0];
    const candidates = [
      [Number(digits.slice(0, 4)), Number(digits.slice(4, 6)), Number(digits.slice(6, 8))],
      [Number(digits.slice(4, 8)), Number(digits.slice(0, 2)), Number(digits.slice(2, 4))],
    ];
    for (const [year, month, day] of candidates) {
      const date = new Date(year, month - 1, day);
      if (year >= 2000 && year <= 2100 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) return date;
    }
  }
  return null;
}

export function formatRecordingTitle(title: string, recordedAt?: string, originalFilename = '') {
  const readable = title
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/\d{5,}/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const normalized = readable
    ? readable.split(' ').map((word) => word ? word.charAt(0).toUpperCase() + word.slice(1) : word).join(' ')
    : title;
  const date = embeddedDate(originalFilename || title) || (recordedAt ? new Date(recordedAt) : null);
  if (!date) return normalized;
  if (Number.isNaN(date.getTime())) return normalized;
  return `${normalized} — ${date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`;
}
