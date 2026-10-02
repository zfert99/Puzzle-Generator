'use client';

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { countSkyscrapersSolutions } from '@/features/engine/skyscrapers/skyscrapers-solver';
import { presentClueCount } from '@/features/engine/skyscrapers/skyscrapers-types';
import { useBoardStore } from '../store/useBoardStore';

/**
 * Development-only readout under a Skyscrapers board: what the exact solver says (unique? at
 * what search cost) — the plan's E1 slice asks for this as the visible proof that a real solver
 * sits behind the board; E2 adds the classifier's grade and technique histogram. Nodes, not
 * milliseconds: a count is a pure function of the puzzle and can be derived in render; a
 * wall-clock timing is not (`react-hooks/purity`) and belongs in the benchmarks. Never rendered
 * in production — `PlayExperience` gates it on `NODE_ENV`.
 */
export function SkyscrapersDevBadge() {
  const { clues, size } = useBoardStore(useShallow((s) => ({ clues: s.edgeClues, size: s.config.size })));
  const line = useMemo(() => {
    if (!clues) return 'exact: no clues';
    const exact = countSkyscrapersSolutions({ gridSize: size, clues });
    const unique = exact.exhausted
      ? 'uniqueness: node budget exhausted'
      : exact.solutions !== 1
        ? `NOT unique — ${exact.solutions} solutions found`
        : `unique ✓ · ${exact.nodes} nodes`;
    return `exact: ${unique} · ${presentClueCount(clues)} of ${4 * size} clues`;
  }, [clues, size]);

  return (
    <p className="text-xs font-mono text-ink-soft mt-2" data-testid="skyscrapers-dev-badge">
      {line}
    </p>
  );
}
