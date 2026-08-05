import { useEffect, useState } from 'react';

export type MeridianTheme = 'dark' | 'light';

const storageKey = 'meridian.theme';

export function useTheme() {
  const [theme, setTheme] = useState<MeridianTheme>(() => {
    const saved = window.localStorage.getItem(storageKey);
    return saved === 'light' || saved === 'dark' ? saved : 'dark';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(storageKey, theme);
  }, [theme]);

  return {
    theme,
    toggleTheme: () => setTheme((current) => current === 'dark' ? 'light' : 'dark'),
  };
}
