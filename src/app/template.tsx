'use client';

import { motion } from 'motion/react';
import { useReducedMotion } from '@/features/juice/useReducedMotion';

/**
 * Route transition (design system §4): a subtle fade + 8px slide on navigation. A `template`
 * (unlike `layout`) re-mounts on every route change, so wrapping its children in a Motion
 * enter animation gives each page a gentle entrance.
 *
 * The wrapper is `flex-1 flex flex-col` so it transparently passes the body's flex column
 * through to each page's `flex-1` main. Under reduced motion it renders children directly —
 * no wrapper animation.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();

  if (reduced) return <div className="flex-1 flex flex-col">{children}</div>;

  return (
    <motion.div
      className="flex-1 flex flex-col"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
