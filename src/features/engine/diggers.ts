import { HumanSolver, canHumanSolveExtreme } from './human-solver';
import type { GridConfig, Difficulty, GridSize } from './sudoku';
import { copyGrid, createEmptyGrid, fillGrid, shuffle, popcount } from './grid-utils';

/**
 * Counts how many valid solutions exist for a given partially-filled grid.
 * Used to ensure our generated puzzles have EXACTLY ONE unique solution.
 * We set a limit (default 2) because we only care if it has 1 solution or >1 solution.
 * Continuing to count past 2 would be a massive waste of CPU.
 *
 * Like {@link fillGrid}, this uses bitmask-based backtracking with an MRV
 * heuristic: used-digit bitmasks per row/column/box make each legality test O(1),
 * and always branching on the most-constrained empty cell first prunes the tree
 * hard — which matters because `applyQuotaDigger` calls this after every candidate
 * clue removal. See AGENTS.md Section 1.
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
 * Expert Digger:
 * Tries to remove AS MANY CLUES AS POSSIBLE while guaranteeing the puzzle can still be solved
 * by a human using pure logic (without guessing).
 * It achieves this by utilizing the `HumanSolver`.
 */
export function applyExhaustiveDigger(grid: number[][], config: GridConfig): void {
  // Create an array of all positions and shuffle it
  const positions = shuffle(Array.from({ length: config.totalCells }, (_, i) => i));
  
  // Attempt to "dig" (remove) the number at each position one by one
  for (const pos of positions) {
    const row = Math.floor(pos / config.size);
    const col = pos % config.size;

    // Backup the value in case removing it breaks the puzzle
    const backup = grid[row][col];
    if (backup === 0) continue; // Already empty (shouldn't happen here, but safe)
    
    // Tentatively remove the clue
    grid[row][col] = 0;

    // Verify a human can solve the resulting puzzle without guessing.
    // We use `HumanSolver` instead of `countSolutions` because `countSolutions` uses brute-force backtracking
    // and would successfully solve puzzles that require guessing. We want to guarantee it's logically solvable.
    // Additionally, because `HumanSolver` relies purely on logic, if it can solve the puzzle,
    // the puzzle is inherently guaranteed to have a UNIQUE solution.
    const solver = new HumanSolver(copyGrid(grid));
    const res = solver.solve({ maxTier: 'advanced' });
    
    // If the HumanSolver gets stuck (requires guessing or unprogrammed strategies),
    // we put the clue back and move on to the next position.
    if (!res.solved) {
      grid[row][col] = backup;
    }
  }
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
export function applyQuotaDigger(grid: number[][], difficulty: Difficulty, config: GridConfig): void {
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
    // Pick a completely random cell
    let row = Math.floor(Math.random() * config.size);
    let col = Math.floor(Math.random() * config.size);
    
    // If the cell is already empty, keep picking until we hit a filled one
    while (grid[row][col] === 0) {
      row = Math.floor(Math.random() * config.size);
      col = Math.floor(Math.random() * config.size);
    }

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

/**
 * Extreme Digger:
 * Generates puzzles that require extreme strategies (W-Wing, ALS-XZ, AICs) to solve.
 * Uses the same exhaustive digging approach as the expert digger, but then validates
 * that the resulting puzzle actually REQUIRES extreme strategies. If the puzzle can be
 * solved with only expert-level strategies, the entire process is retried with a fresh
 * solution grid.
 */
export function applyExtremeDigger(grid: number[][], solution: number[][], config: GridConfig): void {
  const MAX_RETRIES = 50;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // On retry, generate a completely new solution and start fresh
    if (attempt > 0) {
      const newSolution = createEmptyGrid(config.size);
      fillGrid(newSolution, config);
      // Copy the new solution into both the grid and solution arrays
      for (let r = 0; r < config.size; r++) {
        for (let c = 0; c < config.size; c++) {
          grid[r][c] = newSolution[r][c];
          solution[r][c] = newSolution[r][c];
        }
      }
    }

    // Step 1: Exhaustively dig holes (same logic as expert digger)
    const positions = shuffle(Array.from({ length: config.totalCells }, (_, i) => i));
    for (const pos of positions) {
      const row = Math.floor(pos / config.size);
      const col = pos % config.size;
      const backup = grid[row][col];
      if (backup === 0) continue;

      grid[row][col] = 0;

      // Verify the puzzle is still solvable by the full solver (including extreme strategies)
      const solver = new HumanSolver(copyGrid(grid));
      const res = solver.solve();

      if (!res.solved) {
        grid[row][col] = backup;
      }
    }

    // Step 2: Validate that the puzzle actually REQUIRES extreme strategies
    if (canHumanSolveExtreme(copyGrid(grid))) {
      return; // Success! The puzzle requires extreme strategies.
    }

    // If it didn't require extreme strategies, retry with a new grid
  }

  // If we exhausted all retries, keep the last puzzle even if it's only expert-level.
  // This is a graceful degradation — the puzzle is still valid and logically solvable.
}
