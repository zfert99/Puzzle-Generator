'use client';

import { useEffect, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

/**
 * Animate a number from 0 up to `target` when it changes (e.g. the streak "roll", design
 * system §4). Returns the in-progress value; `null` until the first frame.
 *
 * All setState happens inside the `requestAnimationFrame` callback (asynchronous), never
 * synchronously in the effect body — so it satisfies `react-hooks/set-state-in-effect`.
 * Under reduced motion the duration is 0, so it snaps to the target on the first frame.
 */
export function useCountUp(target: number | null, ms = 500): number | null {
  const [value, setValue] = useState<number | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (target == null) return;
    const duration = reduced ? 0 : ms;
    let raf = 0;
    let start = 0;
    const tick = (t: number) => {
      if (!start) start = t;
      const progress = duration === 0 ? 1 : Math.min(1, (t - start) / duration);
      setValue(Math.round(target * progress));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced, ms]);

  return value;
}
