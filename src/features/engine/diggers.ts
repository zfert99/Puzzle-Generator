import { HumanSolver, canHumanSolveExpert, canHumanSolveExtreme } from './human-solver';
import type { GridConfig, Difficulty, GridSize } from './sudoku';
import { copyGrid, createEmptyGrid, fillGrid, shuffle, popcount, solvableBySinglesAlone } from './grid-utils';

/**
 * Counts how many valid solutions exist for a given partially-filled grid.
 * Used to ensure our generated puzzles have EXACTLY ONE unique solution.
 * We set a limit (default 2) because we only care if it has 1 solution or >1 solution.
 * Continuing to count past 2 would be a massive waste of CPU.
 *
 * Like {@link fillGrid}, this uses bitmask-based backtracking with an MRV
 * heuristic: used-digit bitmasks per row/column/box make each legality test O(1),
 * and always branching on the most-constrained empty cell first prunes the tree
 * hard — which matters because every digger calls this after every candidate clue
 * removal (the Expert/Extreme diggers as the gate in front of `HumanSolver`). See
 * AGENTS.md Section 1.
 */
export function countSolutions(grid: number[][], config: GridConfig, limit = 2): number {
  const { size, boxWidth, boxHeight, maxNum } = config;
  const fullMask = (1 << maxNum) - 1;
  const boxesPerRow = size / boxWidth;
  const boxOf = (r: number, c: number) =>
    Math.floor(r / boxHeight) * boxesPerRow + Math.floor(c / boxWidth);

  const rowMask = new Array<number>(size).fill(0);
  const colMask = new Array<number>(size).fill(0);
  const boxMask = new Array<number>(size).fill(0);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const v = grid[r][c];
      if (v !== 0) {
        const bit = 1 << (v - 1);
        rowMask[r] |= bit;
        colMask[c] |= bit;
        boxMask[boxOf(r, c)] |= bit;
      }
    }
  }

  let count = 0;

  const solve = (): void => {
    if (count >= limit) return;

    // MRV: branch on the empty cell with the fewest legal candidates.
    let bestR = -1, bestC = -1, bestAllowed = 0, bestCount = maxNum + 1;
    search:
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c] !== 0) continue;
        const allowed = fullMask & ~(rowMask[r] | colMask[c] | boxMask[boxOf(r, c)]);
        const cnt = popcount(allowed);
        if (cnt === 0) return; // dead end — no solution down this branch
        if (cnt < bestCount) {
          bestCount = cnt; bestR = r; bestC = c; bestAllowed = allowed;
          if (cnt === 1) break search;
        }
      }
    }

    if (bestR === -1) {
      // No empty cells left → a complete, valid solution.
      count++;
      return;
    }

    const b = boxOf(bestR, bestC);
    let m = bestAllowed;
    while (m !== 0) {
      const lowestBit = m & -m;
      const num = 31 - Math.clz32(lowestBit) + 1;
      const bit = 1 << (num - 1);

      grid[bestR][bestC] = num;
      rowMask[bestR] |= bit; colMask[bestC] |= bit; boxMask[b] |= bit;
      solve();
      grid[bestR][bestC] = 0;
      rowMask[bestR] &= ~bit; colMask[bestC] &= ~bit; boxMask[b] &= ~bit;

      if (count >= limit) return;
      m &= m - 1;
    }
  };

  solve();
  return count;
}

/**
 * `error.name` of the error a classic generator throws when its `timeBudgetMs` runs out — the
 * Kakuro/Skyscrapers convention (a name-tagged `Error`, recognised by {@link isSudokuBudgetError}),
 * so a route can tell "the request was too large for its budget" from a real fault.
 */
export const SUDOKU_BUDGET_ERROR = 'SudokuBudgetError';

export function isSudokuBudgetError(error: unknown): error is Error {
  return error instanceof Error && error.name === SUDOKU_BUDGET_ERROR;
}

/**
 * Throws {@link SUDOKU_BUDGET_ERROR} once the absolute `deadline` (a `performance.now()` value)
 * has passed. `Infinity` — the default everywhere — never reads the clock, so an unbudgeted
 * caller pays nothing and behaves exactly as before.
 */
function assertWithinDeadline(deadline: number): void {
  if (deadline !== Infinity && performance.now() > deadline) {
    throw Object.assign(new Error('Sudoku generation ran out of its time budget'), { name: SUDOKU_BUDGET_ERROR });
  }
}

/**
 * One exhaustive dig pass — the shared core of the Expert and Extreme diggers. Visits every cell
 * in a shuffled order and keeps a removal only if the puzzle stays solvable by `HumanSolver`
 * capped at `maxTier`, i.e. solvable by pure logic with no guessing.
 *
 * **Uniqueness gate first.** A sound logical solver can never finish a grid with two solutions,
 * so a removal that breaks uniqueness is always rejected — and almost every rejection is exactly
 * that. `countSolutions` (limit 2) answers it in ~0.1 ms, whereas a failing `HumanSolver` run
 * grinds through ALS/AIC to exhaustion before giving up. Checking uniqueness first therefore
 * rejects the same removals far more cheaply (measured 5–70× on Extreme generation) and accepts
 * exactly the same ones: neither check consumes `rng`, so for a given seed the output is
 * byte-identical to running `HumanSolver` alone.
 *
 * Exported for the determinism test in `diggers.test.ts`; production callers use the diggers.
 */
export function digExhaustively(
  grid: number[][],
  config: GridConfig,
  rng: () => number,
  maxTier: 'advanced' | 'extreme',
  deadline: number = Infinity,
): void {
  const positions = shuffle(Array.from({ length: config.totalCells }, (_, i) => i), rng);

  for (const pos of positions) {
    assertWithinDeadline(deadline);
    const row = Math.floor(pos / config.size);
    const col = pos % config.size;
    const backup = grid[row][col];
    if (backup === 0) continue;

    grid[row][col] = 0;

    // countSolutions backtracks in place and restores every cell it touches, so no copy is needed.
    if (countSolutions(grid, config) !== 1) {
      grid[row][col] = backup;
      continue;
    }

    if (!new HumanSolver(copyGrid(grid)).solve({ maxTier }).solved) {
      grid[row][col] = backup;
    }
  }
}

/**
 * How many full dig passes the Expert digger makes before keeping its last puzzle anyway. A pass
 * yields an advanced-requiring puzzle ~10% of the time (measured 20 of 200), so 60 passes leave a
 * ~0.2% chance of falling back to an unverified (basic-solvable) Expert.
 */
const EXPERT_MAX_RETRIES = 60;

/**
 * Expert Digger:
 * Removes as many clues as possible while the puzzle stays solvable by pure logic up to the
 * advanced tier, then **verifies the puzzle actually needs that tier** — mirroring the Extreme
 * digger. A minimal advanced-solvable puzzle usually turns out to be basic-solvable anyway
 * (measured 180 of 200), so without the check "Expert" was mostly a Hard with fewer clues. Each
 * failed pass restores the original solution and re-digs it in a fresh shuffled order.
 *
 * @param deadline Absolute `performance.now()` cut-off; past it the digger throws
 *   {@link SUDOKU_BUDGET_ERROR}. Defaults to no deadline.
 */
export function applyExhaustiveDigger(
  grid: number[][],
  config: GridConfig,
  rng: () => number = Math.random,
  deadline: number = Infinity,
): void {
  const solution = copyGrid(grid);

  for (let attempt = 0; attempt < EXPERT_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      for (let r = 0; r < config.size; r++) {
        for (let c = 0; c < config.size; c++) grid[r][c] = solution[r][c];
      }
    }

    digExhaustively(grid, config, rng, 'advanced', deadline);

    if (canHumanSolveExpert(copyGrid(grid))) return;
  }

  // Retries exhausted: keep the last puzzle. It is still unique and logically solvable — just not
  // verified to need an advanced strategy (graceful degradation, as in the Extreme digger).
}

/**
 * Standard Digger (Easy/Medium/Hard for all grid sizes):
 * Removes a specific number of clues from the grid to hit a target difficulty.
 * Uses brute-force uniqueness checking (`countSolutions`) rather than logical deduction,
 * because we aren't trying to force advanced logical techniques, we just want a specific clue density.
 *
 * Clue quotas (how many givens to LEAVE):
 *   4x4: Easy=9, Medium=6, Hard=4
 *   6x6: Easy=20, Medium=16, Hard=10
 *   9x9: Easy=41(removes 40), Medium=31(removes 50), Hard=26(removes 55)
 */
export function applyQuotaDigger(grid: number[][], difficulty: Difficulty, config: GridConfig, rng: () => number = Math.random): void {
  // Only the box-tileable classic sizes exist here — 5/7 are boxless KenKen sizes with no
  // classic digger (Partial, not an exhaustive Record, so we don't invent quotas for puzzles
  // that can't exist). The `?.` + `?? 40` fallback keeps a boxless size from throwing.
  const quotas: Partial<Record<GridSize, Record<string, number>>> = {
    4: { easy: 7, medium: 10, hard: 12 },
    6: { easy: 16, medium: 20, hard: 26 },
    9: { easy: 40, medium: 50, hard: 55 },
  };

  // How many clues to REMOVE
  let cluesToRemove = quotas[config.size]?.[difficulty] ?? 40;

  // Fail-safe to prevent infinite loops if we get a grid layout where it's 
  // mathematically difficult to reach the target quota while maintaining uniqueness
  let attempts = 0;

  // Keep digging until we've removed enough clues OR we've failed 100 times
  while (cluesToRemove > 0 && attempts < 100) {
    // Pick a random *filled* cell. Collecting the filled positions and indexing into them (instead
    // of re-rolling a random cell until one happens to be non-empty) gives the same uniform choice
    // over filled cells but is bounded — the old inner `while (grid[row][col] === 0)` re-roll had no
    // iteration cap and only terminated by the invariant that a filled cell still exists. The rebuild
    // is O(cells) per attempt, negligible next to the `countSolutions` call below.
    const filled: number[] = [];
    for (let r = 0; r < config.size; r++) {
      for (let c = 0; c < config.size; c++) {
        if (grid[r][c] !== 0) filled.push(r * config.size + c);
      }
    }
    if (filled.length === 0) break; // nothing left to dig (defensive — quotas never empty the grid)

    const pos = filled[Math.floor(rng() * filled.length)];
    const row = Math.floor(pos / config.size);
    const col = pos % config.size;

    // Backup the value
    const backup = grid[row][col];
    
    // Tentatively remove the clue
    grid[row][col] = 0;

    // Check if the puzzle still has exactly ONE unique solution
    const copy = copyGrid(grid);
    if (countSolutions(copy, config) !== 1) {
      // Removing this clue created multiple valid solutions.
      // Put the clue back and log a failed attempt.
      grid[row][col] = backup;
      attempts++;
    } else {
      // Removing this clue kept the puzzle unique!
      // Decrement our remaining quota and continue.
      cluesToRemove--;
    }
  }
}

/** How many fresh dig orders a 9×9 Medium gets to stop being singles-only before the last one is kept. */
export const MEDIUM_MAX_RETRIES = 30;

/**
 * Medium Digger (9×9 only): the quota digger plus one technique gate — the result must NOT be
 * finishable by naked singles alone.
 *
 * Why: the quota tiers separate on clue count only, and the difficulty-separation report
 * (October 2026) measured that **half** of 9×9 Mediums at 31 clues were still singles-only — an
 * Easy with fewer clues — while Hard at 26 clues always needed a real technique. The gate makes
 * Medium mean "you will need at least a hidden single or a pair", which is what the label
 * promises. Each retry restores the full solution and re-digs in a fresh `rng` order; the check
 * itself (`solvableBySinglesAlone`) is microseconds, so a retry costs one more quota dig (~1 ms).
 * After `MEDIUM_MAX_RETRIES` the last dig is kept — still a valid, unique, 31-clue Medium — rather
 * than failing generation over a label. Not applied to 4×4/6×6: at those sizes nearly every
 * unique grid is singles-only and clue count is the honest lever (the report's T0 columns).
 */
export function applyMediumDigger(grid: number[][], solution: number[][], config: GridConfig, rng: () => number = Math.random): void {
  for (let attempt = 0; attempt < MEDIUM_MAX_RETRIES; attempt++) {
    for (let r = 0; r < config.size; r++) for (let c = 0; c < config.size; c++) grid[r][c] = solution[r][c];
    applyQuotaDigger(grid, 'medium', config, rng);
    if (!solvableBySinglesAlone(grid, config)) return;
  }
}

/**
 * Extreme Digger:
 * Generates puzzles that require extreme strategies (W-Wing, ALS-XZ, AICs) to solve.
 * Uses the same exhaustive digging approach as the expert digger, but then validates
 * that the resulting puzzle actually REQUIRES extreme strategies. If the puzzle can be
 * solved with only expert-level strategies, the entire process is retried with a fresh
 * solution grid.
 *
 * @param deadline Absolute `performance.now()` cut-off; past it the digger throws
 *   {@link SUDOKU_BUDGET_ERROR}. Defaults to no deadline.
 */
export function applyExtremeDigger(
  grid: number[][],
  solution: number[][],
  config: GridConfig,
  rng: () => number = Math.random,
  deadline: number = Infinity,
): void {
  const MAX_RETRIES = 50;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // On retry, generate a completely new solution and start fresh
    if (attempt > 0) {
      assertWithinDeadline(deadline);
      const newSolution = createEmptyGrid(config.size);
      fillGrid(newSolution, config, rng);
      // Copy the new solution into both the grid and solution arrays
      for (let r = 0; r < config.size; r++) {
        for (let c = 0; c < config.size; c++) {
          grid[r][c] = newSolution[r][c];
          solution[r][c] = newSolution[r][c];
        }
      }
    }

    // Step 1: Exhaustively dig holes, verifying each removal against the full solver.
    digExhaustively(grid, config, rng, 'extreme', deadline);

    // Step 2: Validate that the puzzle actually REQUIRES extreme strategies
    if (canHumanSolveExtreme(copyGrid(grid))) {
      return; // Success! The puzzle requires extreme strategies.
    }

    // If it didn't require extreme strategies, retry with a new grid
  }

  // If we exhausted all retries, keep the last puzzle even if it's only expert-level.
  // This is a graceful degradation — the puzzle is still valid and logically solvable.
}
