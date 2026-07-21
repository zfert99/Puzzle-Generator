/**
 * App-wide settings: motion, colorblind mode, and error highlighting — persisted to
 * localStorage and applied to `<html>` as `data-*` attributes so CSS keys off them with no
 * flash (the same pre-paint pattern as the theme, `theme.ts`). Theme itself stays in its own
 * module; the settings panel renders both.
 *
 * Kept as a tiny event-backed store (not Zustand) to match `theme.ts` and to make the
 * pre-paint script a trivial `JSON.parse` — the value must be applied before React hydrates.
 */

export type MotionPref = 'system' | 'reduce' | 'full';

export interface Settings {
  /** 'system' follows the OS `prefers-reduced-motion`; 'reduce'/'full' override it. */
  motion: MotionPref;
  /** Colorblind-friendly mode: shape cues + a lightness-differentiated cell palette. */
  colorblind: boolean;
  /** Highlight wrong entries during play (the board's real-time error check). */
  errorHighlight: boolean;
}

export const SETTINGS_STORAGE_KEY = 'pl-settings';

export const DEFAULT_SETTINGS: Settings = {
  motion: 'system',
  colorblind: false,
  errorHighlight: true,
};

const SETTINGS_EVENT = 'pl-settingschange';

/** Read the persisted settings, falling back to defaults for any missing/invalid field. */
export function getSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}');
    return {
      motion: raw.motion === 'reduce' || raw.motion === 'full' ? raw.motion : DEFAULT_SETTINGS.motion,
      colorblind: typeof raw.colorblind === 'boolean' ? raw.colorblind : DEFAULT_SETTINGS.colorblind,
      errorHighlight: typeof raw.errorHighlight === 'boolean' ? raw.errorHighlight : DEFAULT_SETTINGS.errorHighlight,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Is motion effectively reduced right now (explicit 'reduce', or 'system' + OS prefers reduce)? */
export function motionReduced(settings: Settings): boolean {
  if (settings.motion === 'reduce') return true;
  if (settings.motion === 'full') return false;
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Apply the current settings to `<html>` as `data-motion` / `data-colorblind`. Client-only. */
export function applySettings(settings: Settings = getSettings()): void {
  const el = document.documentElement;
  if (motionReduced(settings)) el.setAttribute('data-motion', 'reduce');
  else el.removeAttribute('data-motion');
  if (settings.colorblind) el.setAttribute('data-colorblind', 'true');
  else el.removeAttribute('data-colorblind');
}

/** Persist one setting, re-apply to the DOM, and notify subscribers. Client-only. */
export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  const next = { ...getSettings(), [key]: value };
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable (private mode) — attributes still apply for this session.
  }
  applySettings(next);
  window.dispatchEvent(new Event(SETTINGS_EVENT));
}

/** Subscribe to settings changes (and, since 'system' motion tracks the OS, OS motion changes). */
export function subscribeSettings(onChange: () => void): () => void {
  window.addEventListener(SETTINGS_EVENT, onChange);
  const mq = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
  const onOs = () => {
    // Only 'system' mode depends on the OS; re-apply so `data-motion` stays correct.
    if (getSettings().motion === 'system') applySettings();
    onChange();
  };
  mq?.addEventListener('change', onOs);
  return () => {
    window.removeEventListener(SETTINGS_EVENT, onChange);
    mq?.removeEventListener('change', onOs);
  };
}

/**
 * Pre-paint script (injected inline before React): applies `data-motion`/`data-colorblind`
 * from localStorage before first paint, so there is no flash and no hydration mismatch.
 * Mirrors the effective-value logic of `applySettings`/`motionReduced` in plain JS.
 */
export const SETTINGS_PRE_PAINT_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem('${SETTINGS_STORAGE_KEY}')||'{}');var m=(s.motion==='reduce'||s.motion==='full')?s.motion:'system';var reduce=m==='reduce'||(m!=='full'&&matchMedia('(prefers-reduced-motion: reduce)').matches);var el=document.documentElement;if(reduce)el.setAttribute('data-motion','reduce');if(s.colorblind===true)el.setAttribute('data-colorblind','true');}catch(e){}})();`;
