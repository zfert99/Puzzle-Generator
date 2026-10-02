'use client';

import { useEffect } from 'react';
import { useReducedMotion } from './useReducedMotion';
import { fireConfetti } from './confetti';
import { WobbleFrame } from '@/features/chaos/Wobble';

/**
 * The completion "stamp" — the design system's win moment (§4): a chunky rounded badge that
 * scales in `0 → 1.15 → 1` with a squash/rotate, fires a one-off confetti burst, and flashes
 * the screen once (opacity only, never a shake). Reserved for genuine completions — mounted
 * only when a puzzle is actually solved.
 *
 * The animations are CSS keyframes (`.stamp-pop` / `.stamp-flash` in `globals.css`), not the
 * `motion` library: this was the last consumer of that ~39 KB runtime, and a two-keyframe pop
 * does not justify shipping it. Reduced motion: renders the badge instantly with no animation,
 * no confetti, no flash — the CSS side keys off `[data-motion="reduce"]`, the confetti off the
 * single `useReducedMotion` switch, so both agree with the pre-paint attribute.
 */
export function SolvedStamp({ label }: { label: string }) {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!reduced) fireConfetti();
  }, [reduced]);

  return (
    <div className="relative flex justify-center mb-3">
      {/* Single soft screen-flash (opacity, not shake). */}
      {!reduced && <div aria-hidden className="fixed inset-0 z-40 bg-paper pointer-events-none stamp-flash" />}

      <div className="-rotate-3 stamp-pop">
        {/* The stamp's outline is a hand-inked wobble frame (chaos §8), not a crisp border. */}
        <WobbleFrame className="p-2">
          <div className="bg-butterscotch rounded-md px-6 py-2">
            <span className="font-display text-2xl sm:text-3xl text-on-butterscotch">{label}</span>
          </div>
        </WobbleFrame>
      </div>

      {/* A scrawled Caveat aside (decorative). */}
      <span
        aria-hidden
        style={{ fontFamily: 'var(--font-caveat, cursive)' }}
        className="absolute -bottom-5 right-2 text-lg text-grape -rotate-6"
      >
        nice work!
      </span>
    </div>
  );
}
