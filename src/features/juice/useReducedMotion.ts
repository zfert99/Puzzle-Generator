'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/**
 * The single source of truth for the motion switch (design system §4/§6): every juice
 * effect gates on this, rather than each component re-implementing the media query.
 *
 * Read via `useSyncExternalStore` — `getServerSnapshot` returns `false` so the server and
 * first client render agree (no hydration mismatch), then it reflects the real preference
 * after hydration and updates live if the user changes it.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
