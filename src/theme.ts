import { useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'sensesync-theme';

// Browser-chrome colour (status bar / address bar) per theme, kept in sync with
// the canvas background so the OS UI matches the app surface.
const THEME_COLOR: Record<Theme, string> = { dark: '#0d0d0d', light: '#f4f4f5' };

function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  // Dark is the default (bare :root tokens), so the attribute is only present
  // for light — matching the pre-paint bootstrap script in index.html.
  if (theme === 'light') root.setAttribute('data-theme', 'light');
  else root.removeAttribute('data-theme');

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLOR[theme]);
}

/**
 * Light/dark theme with localStorage persistence. The initial paint is handled
 * by the inline script in index.html; this hook keeps the DOM, storage, and
 * browser-chrome colour in sync as the user toggles.
 */
export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Storage can be unavailable (private mode); the in-memory state still works.
    }
  }, [theme]);

  const toggleTheme = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'));

  return { theme, toggleTheme };
}
