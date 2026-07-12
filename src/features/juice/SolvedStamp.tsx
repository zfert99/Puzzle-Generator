'use client';

import { useEffect } from 'react';
import { motion } from 'motion/react';
import { useReducedMotion } from './useReducedMotion';
import { fireConfetti } from './confetti';

/**
 * The completion "stamp" — the design system's win moment (§4): a chunky rounded badge that
 * scales in `0 → 1.15 → 1` with a squash/rotate, fires a one-off confetti burst, and flashes
 * the screen once (opacity only, never a shake). Replaces the old `celebrate`/`rank-reveal`
 * CSS. Reserved for genuine completions — mounted only when a puzzle is actually solved.
 *
 * Reduced motion: renders the badge instantly with no animation, no confetti, no flash —
 * gated on the single `useReducedMotion` switch.
 */
export function SolvedStamp({ label }: { label: string }) {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!reduced) fireConfetti();
  }, [reduced]);

  return (
    <div className="relative flex justify-center mb-3">
      {/* Single soft screen-flash (opacity, not shake). */}
      {!reduced && (
        <motion.div
          aria-hidden
          className="fixed inset-0 z-40 bg-paper pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.28, 0] }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      )}

      <motion.div
        initial={reduced ? false : { scale: 0, rotate: -8 }}
        animate={reduced ? {} : { scale: [0, 1.15, 1], rotate: [-8, 3, -3] }}
        transition={{ duration: 0.55, ease: 'easeOut', times: [0, 0.6, 1] }}
        className="bg-butterscotch text-ink border-4 border-ink rounded-lg px-6 py-2.5 shadow-chunky -rotate-3"
      >
        <span className="font-display text-2xl sm:text-3xl">{label}</span>
      </motion.div>
    </div>
  );
}
