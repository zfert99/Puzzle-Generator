'use client';

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { classifySkyscrapers } from '@/features/engine/skyscrapers/skyscrapers-logical-solver';
import { scoreSkyscrapersSolve } from '@/features/engine/skyscrapers/skyscrapers-score';
import { countSkyscrapersSolutions } from '@/features/engine/skyscrapers/skyscrapers-solver';
import { presentClueCount } from '@/features/engine/skyscrapers/skyscrapers-types';
import { useBoardStore } from '../store/useBoardStore';

/**
 * Development-only readout under a Skyscrapers board: what the exact solver says (unique? at
 * what search cost) — the plan's E1 slice asks for this as the visible proof that a real solver
 * sits behind the board — plus, since E2, the classifier's grade, score and technique histogram
 * and the clue metrics the generator will read (the plan's "rung histogram"). Nodes, not
 * milliseconds: a count is a pure function of the puzzle and can be derived in render; a
 * wall-clock timing is not (`react-hooks/purity`) and belongs in the benchmarks. Never rendered
 * in production — `PlayExperience` gates it on `NODE_ENV`.
 */
export function SkyscrapersDevBadge() {
  const { clues, size } = useBoardStore(useShallow((s) => ({ clues: s.edgeClues, size: s.config.size })));
  const lines = useMemo(() => {
    if (!clues) return ['exact: no clues'];
    const shape = { gridSize: size, clues };
    const exact = countSkyscrapersSolutions(shape);
    const unique = exact.exhausted
      ? 'uniqueness: node budget exhausted'
      : exact.solutions !== 1
        ? `NOT unique — ${exact.solutions} solutions found`
        : `unique ✓ · ${exact.nodes} nodes`;
    const graded = classifySkyscrapers(shape, { metrics: true });
    const histogram = Object.entries(graded.result.techniqueCounts)
      .map(([name, count]) => `${name}×${count}`)
      .join(' ');
    const grade = graded.tier === null ? 'beyond the ladder (unrated)' : `${graded.difficulty} (tier ${graded.tier})`;
    const score = scoreSkyscrapersSolve(graded.result);
    const m = graded.metrics!;
    return [
      `exact: ${unique} · ${presentClueCount(clues)} of ${4 * size} clues`,
      `ladder: ${grade} · score ${score.final.toFixed(1)} · ${histogram || 'nothing applied'}`,
      `metrics: trivial clues ${m.trivialClues} · facing sums ${m.facingSumPairs} · fixed ${m.fixed} · implied ${m.implied} · rating ${m.rating.toFixed(2)}`,
    ];
  }, [clues, size]);

  return (
    <div className="text-xs font-mono text-ink-soft mt-2 space-y-0.5" data-testid="skyscrapers-dev-badge">
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}
