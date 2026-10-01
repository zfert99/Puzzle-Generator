'use client';

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { countKakuroSolutions } from '@/features/engine/kakuro/kakuro-solver';
import { useBoardStore } from '../store/useBoardStore';

/**
 * Development-only readout under a Kakuro board: whether the exact solver finds the puzzle
 * unique, and what it cost in search nodes. The Kakuro plan's E1 slice asks for this as the
 * visible proof that a real solver sits behind the board (and later slices read the node count
 * as a rough difficulty signal). Nodes, not milliseconds: the count is a pure function of the
 * puzzle, so it can be derived in render; a wall-clock timing is not (`react-hooks/purity`) and
 * is measured in the engine benchmarks instead. Never rendered in production — `PlayExperience`
 * gates it on `NODE_ENV`.
 */
export function KakuroDevBadge() {
  const { runs, size } = useBoardStore(useShallow((s) => ({ runs: s.runs, size: s.config.size })));
  const verdict = useMemo(() => {
    const result = countKakuroSolutions({ gridSize: size, runs });
    if (result.exhausted) return 'uniqueness: node budget exhausted';
    if (result.solutions !== 1) return `NOT unique — ${result.solutions} solutions found`;
    return `unique ✓ · ${result.nodes} nodes`;
  }, [runs, size]);

  return (
    <p className="text-xs font-mono text-ink-soft mt-2" data-testid="kakuro-dev-badge">
      solver: {verdict}
    </p>
  );
}
