'use client';

import { useSyncExternalStore } from 'react';
import {
  DEFAULT_SETTINGS,
  getSettings,
  motionReduced,
  subscribeSettings,
  type Settings,
} from './settings';

/**
 * Read one setting reactively. Returns the DEFAULT on the server and first client render so
 * server/hydration agree (no mismatch), then the persisted value — the same discipline as the
 * theme hook. Selecting a single primitive keeps `Object.is` stable, so a component (e.g. the
 * 81 board cells) only re-renders when *its* setting actually changes.
 */
export function useSetting<K extends keyof Settings>(key: K): Settings[K] {
  return useSyncExternalStore(
    subscribeSettings,
    () => getSettings()[key],
    () => DEFAULT_SETTINGS[key],
  );
}

/** Effective reduced-motion (setting resolved against the OS) — the JS counterpart to CSS. */
export function useMotionReduced(): boolean {
  return useSyncExternalStore(
    subscribeSettings,
    () => motionReduced(getSettings()),
    () => false,
  );
}
