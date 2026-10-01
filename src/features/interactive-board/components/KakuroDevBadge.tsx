'use client';

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { classifyKakuro } from '@/features/engine/kakuro/kakuro-logical-solver';
import { scoreKakuroSolve } from '@/features/engine/kakuro/kakuro-score';
import { countKakuroSolutions } from '@/features/engine/kakuro/kakuro-solver';
import { useBoardStore } from '../store/useBoardStore';

/**
 * Development-only readout under a Kakuro board: what the exact solver says (unique? at what
 * search cost) and what the logical solver says (the grade, the techniques it needed, the
 * instrumentation set). The Kakuro plan's E1/E2 slices ask for this as the visible proof that
 * real solvers sit behind the board; the numbers are the ones the generator will calibrate on.
 * Nodes, not milliseconds: counts are a pure function of the puzzle, so they can be derived in
 * render; a wall-clock timing is not (`react-hooks/purity`) and belongs in the benchmarks.
 * Never rendered in production — `PlayExperience` gates it on `NODE_ENV`.
 */
export function KakuroDevBadge() {
  const { runs, size } = useBoardStore(useShallow((s) => ({ runs: s.runs, size: s.config.size })));
  const lines = useMemo(() => {
    const shape = { gridSize: size, runs };
    const exact = countKakuroSolutions(shape);
    const unique = exact.exhausted
      ? 'uniqueness: node budget exhausted'
      : exact.solutions !== 1
        ? `NOT unique — ${exact.solutions} solutions found`
        : `unique ✓ · ${exact.nodes} nodes`;

    const graded = classifyKakuro(shape, { metrics: true });
    const { result } = graded;
    const metrics = graded.metrics as NonNullable<typeof graded.metrics>;
    const techniques = Object.entries(result.techniqueCounts)
      .map(([name, count]) => `${name}×${count}`)
      .join(' ');
    const grade = graded.tier === null ? 'beyond tier 3 (chains not built yet)' : `${graded.difficulty} (tier ${graded.tier})`;
    const score = scoreKakuroSolve(result);
    return [
      `exact: ${unique}`,
      `ladder: ${grade} · score ${score.final.toFixed(1)} · ${techniques || 'nothing applied'}`,
      `metrics: ${metrics.whiteCells} cells · fixed ${metrics.fixed} · implied ${metrics.implied} · rating ${metrics.rating.toFixed(2)} · ACRL ${metrics.avgCellRunLength.toFixed(2)} · magic runs ${metrics.uniqueComboRuns}`,
    ];
  }, [runs, size]);

  return (
    <div className="text-xs font-mono text-ink-soft mt-2 space-y-0.5" data-testid="kakuro-dev-badge">
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}
