'use client';

import { useSyncExternalStore } from 'react';
import { getAppliedTheme, setTheme, type Theme } from './theme';

/**
 * Light/dark toggle. The theme is applied before paint by the inline script
 * (`THEME_PRE_PAINT_SCRIPT`); this control reads the current value from the DOM and
 * flips it, persisting the choice.
 *
 * Reads via `useSyncExternalStore` rather than an effect+setState: `getServerSnapshot`
 * returns null (server + first client render match → no hydration mismatch, no icon
 * flash), then the real theme after hydration. The toggle fires a `themechange` event
 * so the store re-renders — avoiding synchronous setState in an effect.
 */
const THEME_EVENT = 'themechange';

function subscribe(onChange: () => void): () => void {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}

export function ThemeToggle() {
  const theme = useSyncExternalStore<Theme | null>(
    subscribe,
    () => getAppliedTheme(),
    () => null, // server + pre-hydration: unknown → neutral placeholder
  );

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="w-9 h-9 rounded-md flex items-center justify-center text-sm border border-ink-soft hover:bg-paper transition-colors"
    >
      {theme === null ? '' : theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
