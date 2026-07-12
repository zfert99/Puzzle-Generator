export type Theme = 'light' | 'dark';

/** localStorage key + cookie name for the persisted theme choice. */
export const THEME_STORAGE_KEY = 'theme';

/**
 * The pre-paint script, injected as the first thing in <body>. It sets
 * `data-theme` on <html> BEFORE the page paints — reading the saved choice, else
 * the system preference — so there is no flash of the wrong theme and no hydration
 * mismatch (the attribute is present before React hydrates). Kept as a plain string
 * because it must run inline, not as a bundled module.
 */
export const THEME_PRE_PAINT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

/** Apply a theme now and persist the explicit choice. Client-only. */
export function setTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // storage unavailable (private mode) — the attribute still applies for this session.
  }
}

/** The theme currently applied to the document (set by the pre-paint script). */
export function getAppliedTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}
