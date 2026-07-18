/**
 * Cage generator — partitions a solved grid into connected cages by randomized region growing
 * (the KDE KSudoku approach). Produces a valid PARTITION only; uniqueness is the generator
 * pipeline's job (K5), which gates the layout through the exact solver.
 *
 * See `cage-generator.md` for the "why".
 */

import { getGridConfig, type GridSize } from '../sudoku';
import { orthogonalNeighbors, type Cage } from './killer-types';

export interface CageGenOptions {
  /**
   * Largest cage to grow (clamped to 9 — the no-repeat ceiling). Default 4.
   *
   * Measured: the exact solver verifies maxSize ≤ 4 layouts in < 10 ms, but maxSize 5 can
   * occasionally explode to seconds — large loose cages have many arithmetic combinations that
   * the solver's (deliberately simple) cage pruning under-prunes, so the search thrashes. 4 is
   * a standard cage cap and keeps verification well under budget; going to 5 needs either
   * tighter solver pruning or a K5 verify time-budget (see killer-solver.md). Difficulty is
   * tuned by cage structure, not by chasing size 5.
   */
  maxSize?: number;
  /**
   * Smallest cage to intend (target size is drawn from `[minSize, maxSize]`). Default 1. Setting
   * it to 2+ suppresses *intentional* single-cell cages (which act as givens → too easy — see the
   * difficulty research); a few forced singles can still occur when a cage boxes itself in.
   */
  minSize?: number;
  /**
   * Probability of drawing `maxSize` as the target instead of a uniform pick from
   * `[minSize, maxSize]`. Default: uniform. This is the research's "2-cell cage count" lever
   * (too many small cages = too constrained = easy) applied at the DRAW, so harder tiers get
   * bigger-cage-heavy partitions without rejection-sampling a rare tail.
   */
  maxSizeBias?: number;
  /**
   * Random source in [0, 1). Injectable so tests are deterministic; defaults to `Math.random`.
   * Killer generation is RNG-driven, so it must run client-side, never during SSR (AGENTS.md §1).
   */
  rng?: () => number;
}

/**
 * Grow a partition of connected, no-repeat cages over `solution`, assigning each cage the sum
 * of the solution digits it covers.
 *
 * Seeds are taken in scan order (guaranteeing every cell is eventually covered and the loop
 * terminates); growth annexes a RANDOM eligible neighbor, giving irregular organic shapes. A
 * neighbor is eligible when it is unassigned and its solution digit isn't already in the cage —
 * so the no-repeat invariant holds by construction.
 */
export function generateCages(
  solution: number[][],
  gridSize: GridSize,
  options: CageGenOptions = {},
): Cage[] {
  const size = getGridConfig(gridSize).size;
  const maxSize = Math.min(options.maxSize ?? 4, 9);
  const minSize = Math.max(1, Math.min(options.minSize ?? 1, maxSize));
  const rng = options.rng ?? Math.random;
  const cellCount = size * size;

  const assigned = new Array<boolean>(cellCount).fill(false);
  const digitAt = (cell: number) => solution[Math.floor(cell / size)][cell % size];
  const cages: Cage[] = [];
  let id = 0;

  for (let seed = 0; seed < cellCount; seed++) {
    if (assigned[seed]) continue;

    const targetSize =
      options.maxSizeBias !== undefined && rng() < options.maxSizeBias
        ? maxSize
        : minSize + Math.floor(rng() * (maxSize - minSize + 1)); // [minSize, maxSize]
    const cells = [seed];
    assigned[seed] = true;
    const usedDigits = new Set<number>([digitAt(seed)]);

    while (cells.length < targetSize) {
      // Every unassigned orthogonal neighbor of the growing cage whose digit is still free.
      const frontier = new Set<number>();
      for (const cell of cells) {
        for (const neighbor of orthogonalNeighbors(cell, size)) {
          if (!assigned[neighbor] && !usedDigits.has(digitAt(neighbor))) frontier.add(neighbor);
        }
      }
      if (frontier.size === 0) break; // boxed in — the cage ends here

      const options_ = [...frontier];
      const pick = options_[Math.floor(rng() * options_.length)];
      cells.push(pick);
      assigned[pick] = true;
      usedDigits.add(digitAt(pick));
    }

    const sum = cells.reduce((total, cell) => total + digitAt(cell), 0);
    cages.push({ id: id++, sum, cells });
  }

  return cages;
}
