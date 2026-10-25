import { useEffect, useState } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';
const KEY = 'firebreak.theme';

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

function apply(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === 'system') delete root.dataset.theme;
  else root.dataset.theme = choice;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (meta) meta.content = choice === 'system' ? 'light dark' : choice;
}

export const systemPrefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

/** Three-state theme preference (System / Light / Dark), shown in the settings menu. */
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(read);

  useEffect(() => {
    apply(choice);
  }, [choice]);

  // Stay in sync when the preference changes in another tab.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => e.key === KEY && setChoice(read());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const update = (next: ThemeChoice) => {
    try {
      if (next === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // Not persisted, but still applied for this page view.
    }
    setChoice(next);
  };

  return { choice, setTheme: update };
}
