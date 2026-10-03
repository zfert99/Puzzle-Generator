import { generateSudoku, type Difficulty, type GridSize } from '../sudoku';
import { HumanSolver } from '../human-solver';
import { getGridConfig } from '../sudoku';
import { solvableBySinglesAlone } from '../grid-utils';
import { generateKillerSudoku, type KillerDifficulty } from '../killer/killer-sudoku';
import { KillerLogicalSolver } from '../killer/killer-logical-solver';
import { scoreKillerSolve } from '../killer/killer-score';
import { generateCalcSudoku } from '../calc/calc-sudoku';
import type { CalcDifficulty } from '../calc/calc-types';
import { CalcLogicalSolver } from '../calc/calc-logical-solver';
import { scoreCalcSolve } from '../calc/calc-score';
import { generateKakuro, KAKURO_SIZES } from '../kakuro/kakuro';
import { KAKURO_LADDER, type KakuroLevel } from '../kakuro/kakuro-types';
import { classifyKakuro } from '../kakuro/kakuro-logical-solver';
import { scoreKakuroSolve } from '../kakuro/kakuro-score';
import { generateSkyscrapers } from '../skyscrapers/skyscrapers';
import { SKYSCRAPERS_SIZES, SKYSCRAPERS_TIERS_BY_SIZE } from '../skyscrapers/skyscrapers-types';
import { classifySkyscrapers } from '../skyscrapers/skyscrapers-logical-solver';
import { scoreSkyscrapersSolve } from '../skyscrapers/skyscrapers-score';

/**
 * Difficulty-separation report: does each type's ladder actually step up, at every size it is
 * offered at? For every (type, size, tier) it generates a sample, grades each puzzle with the
 * engine's own logical solver and two-factor scorer, and prints the distribution — so adjacent
 * tiers can be compared on the same axis the generator itself uses.
 *
 * It exists because "the generator was asked for hard" and "the puzzle is hard" are different
 * claims: the October 2026 pass found that 38 of 40 classic "Expert" puzzles solved with basic
 * strategies, and nothing had ever measured the small sizes at all. Read with the generator's
 * design in mind — classic 4×4/6×6 and 9×9 easy/medium/hard are **clue-quota** tiers (no
 * technique gate), so their separation is in clue count and in how far naked singles alone get
 * you, not in the solver tier.
 *
 * Printed, not logged to `benchmark-logs.md`: this is a distribution report, not a timing row.
 * Usage: `npx tsx src/features/engine/benchmarks/difficulty-separation.ts [count]`.
 */

const COUNT = Number(process.argv[2]) || 10;
/** Optional type filter: `classic | killer | keisan | kakuro | skyscrapers` (case-insensitive prefix). */
const ONLY = (process.argv[3] ?? '').toLowerCase();

interface Sample {
  /** The engine's own tier / grade for this puzzle (classic: 0 singles-only, 1 basic, 2 advanced, 3 extreme). */
  tier: number;
  /** The engine's two-factor score where one exists; classic: clue count. */
  score: number;
  /**
   * A second axis where the generator separates tiers on something the score cannot see:
   * Keisan 9×9 easy/medium split on single-cell givens and expert/extreme on guess-step count
   * (see `DIFFICULTY_CONFIG_9` in `calc-sudoku.ts`). Printed as `givens`/`guesses` when set.
   */
  extra?: { label: string; value: number };
}

function pct(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}

function summarize(samples: Sample[]): string {
  const scores = samples.map((s) => s.score);
  const tiers = new Map<number, number>();
  for (const s of samples) tiers.set(s.tier, (tiers.get(s.tier) ?? 0) + 1);
  const tierText = [...tiers.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, n]) => `T${t}×${n}`)
    .join(' ');
  const extra = samples[0]?.extra
    ? ` · ${samples[0].extra.label} p10/p50/p90 ${pct(samples.map((x) => x.extra!.value), 10)}/${pct(samples.map((x) => x.extra!.value), 50)}/${pct(samples.map((x) => x.extra!.value), 90)}`
    : '';
  return `p10 ${pct(scores, 10).toFixed(0)} · p50 ${pct(scores, 50).toFixed(0)} · p90 ${pct(scores, 90).toFixed(0)}${extra} | ${tierText}`; // two cells
}

function classicSample(difficulty: Difficulty, size: GridSize): Sample {
  const p = generateSudoku(difficulty, size);
  const clues = p.grid.flat().filter((v) => v !== 0).length;
  let tier: number;
  if (solvableBySinglesAlone(p.grid, getGridConfig(size))) tier = 0;
  else if (new HumanSolver(p.grid).solve({ maxTier: 'basic' }).solved) tier = 1;
  else if (new HumanSolver(p.grid).solve({ maxTier: 'advanced' }).solved) tier = 2;
  else tier = 3;
  return { tier, score: clues };
}

function killerSample(difficulty: KillerDifficulty, size: 4 | 6 | 9): Sample {
  const p = generateKillerSudoku(difficulty, { gridSize: size });
  const result = new KillerLogicalSolver(p.cages, size, p.grid).solve();
  return { tier: result.hardestTier, score: scoreKillerSolve(result).final };
}

function calcSample(difficulty: CalcDifficulty, size: 4 | 6 | 9): Sample {
  const p = generateCalcSudoku(difficulty, { gridSize: size });
  const result = new CalcLogicalSolver(p.cages, size).solve({ maxTier: 6 });
  const givens = p.cages.filter((c) => c.cells.length === 1).length;
  const extra = result.guessSteps > 0 ? { label: 'guesses', value: result.guessSteps } : { label: 'givens', value: givens };
  return { tier: result.hardestTier, score: scoreCalcSolve(result).final, extra };
}

function kakuroSample(difficulty: KakuroLevel, size: 6 | 7 | 9): Sample {
  const p = generateKakuro(difficulty, { gridSize: size });
  const c = classifyKakuro({ gridSize: size, runs: p.runs });
  return { tier: c.tier ?? -1, score: scoreKakuroSolve(c.result).final };
}

function skyscrapersSample(difficulty: 'easy' | 'medium' | 'hard' | 'expert' | 'extreme', size: 5 | 6 | 7): Sample {
  const p = generateSkyscrapers(difficulty, { gridSize: size });
  const c = classifySkyscrapers({ gridSize: size, clues: p.clues });
  return { tier: c.tier ?? -1, score: scoreSkyscrapersSolve(c.result).final };
}

function runCell(label: string, count: number, draw: () => Sample): void {
  if (ONLY && !label.toLowerCase().startsWith(ONLY)) return;
  const samples: Sample[] = [];
  const start = performance.now();
  for (let i = 0; i < count; i++) {
    try {
      samples.push(draw());
    } catch (err) {
      console.log(`| ${label} | — | not offered / failed: ${(err as Error).message.slice(0, 60)} | — | — |`);
      return;
    }
  }
  const ms = ((performance.now() - start) / count).toFixed(0);
  console.log(`| ${label} | ${count} | ${summarize(samples)} | ${ms} ms |`);
}

function main(): void {
  const LADDER = ['easy', 'medium', 'hard', 'expert', 'extreme'] as const;
  console.log('| Type · size · tier | n | score p10 · p50 · p90 | solver tiers | avg gen |');
  console.log('|---|---|---|---|---|');

  // Classic: score = clue count (lower is harder); tier 0 = naked singles alone finish it.
  for (const size of [4, 6, 9] as const) {
    for (const d of LADDER) {
      if (size !== 9 && (d === 'expert' || d === 'extreme')) continue;
      const n = d === 'extreme' ? Math.max(3, Math.ceil(COUNT / 3)) : COUNT;
      runCell(`Classic ${size}×${size} ${d}`, n, () => classicSample(d, size));
    }
  }
  for (const size of [4, 6, 9] as const) {
    for (const d of LADDER) {
      if (size === 4 && d !== 'easy') continue;
      if (size === 6 && (d === 'expert' || d === 'extreme')) continue;
      const n = d === 'extreme' ? Math.max(3, Math.ceil(COUNT / 3)) : d === 'expert' ? Math.max(4, Math.ceil(COUNT / 2)) : COUNT;
      runCell(`Killer ${size}×${size} ${d}`, n, () => killerSample(d, size));
    }
  }
  for (const size of [4, 6, 9] as const) {
    for (const d of LADDER) {
      const n = d === 'extreme' ? Math.max(3, Math.ceil(COUNT / 3)) : COUNT;
      runCell(`Keisan ${size}×${size} ${d}`, n, () => calcSample(d, size));
    }
  }
  for (const size of KAKURO_SIZES) {
    for (const d of KAKURO_LADDER) {
      const n = d === 'extreme' || d === 'expert' ? Math.max(3, Math.ceil(COUNT / 2)) : COUNT;
      runCell(`Kakuro ${size}×${size} ${d}`, n, () => kakuroSample(d, size));
    }
  }
  for (const size of SKYSCRAPERS_SIZES) {
    for (const d of SKYSCRAPERS_TIERS_BY_SIZE[size]) {
      const n = d === 'extreme' || d === 'expert' ? Math.max(3, Math.ceil(COUNT / 2)) : COUNT;
      runCell(`Skyscrapers ${size}×${size} ${d}`, n, () => skyscrapersSample(d, size));
    }
  }
}

main();
