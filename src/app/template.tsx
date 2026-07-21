'use client';

import { motion } from 'motion/react';
import { useReducedMotion } from '@/features/juice/useReducedMotion';

/**
 * Route transition (design system §4): a subtle fade + 8px slide on navigation. A `template`
 * (unlike `layout`) re-mounts on every route change, so wrapping its children in a Motion
 * enter animation gives each page a gentle entrance.
 *
 * The wrapper is `flex-1 flex flex-col` so it transparently passes the body's flex column
 * through to each page's `flex-1` main. Under reduced motion the animation is skipped.
 *
 * IMPORTANT: always render the SAME element type (`motion.div`) regardless of the motion
 * setting — never branch to a plain `<div>`. Switching the element type at this position
 * remounts the whole page subtree, which would reset in-progress puzzle state (view, timer)
 * whenever the Motion setting is toggled mid-game. Gating the animation values keeps the tree
 * stable, so only the animation changes, not the mounted components.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className="flex-1 flex flex-col"
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={reduced ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.15, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
