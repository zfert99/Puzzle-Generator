import { applyNakedSingle, applyHiddenSingle, applyNakedPair, applyHiddenPair, applyPointingPairs } from './strategies/basic';
import { applyXWing, applySwordfish, applyYWing, applyXYZWing } from './strategies/advanced';
import { applyWWing, applyALSXZ, applyAIC } from './strategies/extreme';

export type Cell = { r: number; c: number };
export type CandidateCell = { r: number; c: number; cands: number[] };

/**
 * Population count (number of set bits) via Brian Kernighan's algorithm. This is
 * how a cell's remaining-candidate count is computed in O(set bits) instead of
 * O(grid size) — the core win of storing candidates as a bitmask rather than the
 * previous `Set<number>[][]`. See AGENTS.md Section 1 (bitmask engine mandate).
 */
function popcount(mask: number): number {
  let count = 0;
  while (mask !== 0) {
    mask &= mask - 1;
    count++;
  }
  return count;
}

/**
 * HumanSolver is a pure logical deduction engine for solving Sudoku puzzles.
 * Unlike backtracking algorithms which use brute-force guessing to quickly find a solution,
 * this solver mimics how a human plays by systematically applying increasingly complex strategies.
 * If this solver can complete the puzzle, it guarantees a human can solve it without guessing.
 */
export class HumanSolver {
  grid: number[][];
  // Candidates are stored as a bitmask per cell: bit (n-1) set means digit n is
  // still possible. Access via candidateCount/hasCandidate/removeCandidate/
  // candidateList rather than treating this as a Set.
  candidates: number[][];
  readonly size: number;
  readonly boxWidth: number;
  readonly boxHeight: number;
  readonly numBoxes: number;
  readonly numHouses: number;
  readonly totalCells: number;
  usedAdvanced: boolean = false;
  usedExtreme: boolean = false;
  private filledCount: number = 0;
  // Reused scratch buffers for the single-pass hidden-single scan, so that the
  // solver's hottest strategy allocates nothing per call. Indexed by
  // (globalHouseIndex * size + digitIndex); length is numHouses * size.
  private readonly hsCount: number[];
  private readonly hsPos: number[];

  constructor(initialGrid: number[][]) {
    this.grid = initialGrid.map(row => [...row]);

    this.size = initialGrid.length;
    if (this.size === 4) {
      this.boxWidth = 2; this.boxHeight = 2;
    } else if (this.size === 6) {
      this.boxWidth = 3; this.boxHeight = 2;
    } else {
      this.boxWidth = 3; this.boxHeight = 3;
    }
    this.numBoxes = this.size;
    this.numHouses = this.size * 3;
    this.totalCells = this.size * this.size;

    const fullMask = (1 << this.size) - 1;
    this.candidates = Array.from({ length: this.size }, () => new Array<number>(this.size).fill(fullMask));

    this.hsCount = new Array<number>(this.numHouses * this.size).fill(0);
    this.hsPos = new Array<number>(this.numHouses * this.size).fill(0);

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] !== 0) {
          this.placeNumber(r, c, this.grid[r][c]);
        }
      }
    }
  }

  /** Number of remaining candidates in a cell (popcount of its bitmask). */
  public candidateCount(r: number, c: number): number {
    return popcount(this.candidates[r][c]);
  }

  /** Whether digit `num` is still a candidate for the cell. */
  public hasCandidate(r: number, c: number, num: number): boolean {
    return (this.candidates[r][c] & (1 << (num - 1))) !== 0;
  }

  /**
   * Removes digit `num` from a cell's candidates. Returns true when the digit was
   * actually present (state changed), so strategies can track whether they made
   * progress without a separate read.
   */
  public removeCandidate(r: number, c: number, num: number): boolean {
    const bit = 1 << (num - 1);
    if ((this.candidates[r][c] & bit) === 0) return false;
    this.candidates[r][c] &= ~bit;
    return true;
  }

  /** A cell's candidates as an ascending array (empty when none remain). */
  public candidateList(r: number, c: number): number[] {
    const result: number[] = [];
    let mask = this.candidates[r][c];
    while (mask !== 0) {
      const lowestBit = mask & -mask;
      result.push(31 - Math.clz32(lowestBit) + 1);
      mask &= mask - 1;
    }
    return result;
  }

  /**
   * Finds the first Hidden Single — a digit with exactly one legal position in
   * some house (row, column, or box) — places it, and returns true; returns false
   * if none exists.
   *
   * This is the solver's hottest strategy: it runs on every deduction-loop
   * iteration, so its cost dominates the Basic tier. The naive implementation
   * rescanned the whole grid once per (digit, axis) — 3 × size full O(size²)
   * scans per call. Instead this does a SINGLE pass over the empty cells, tallying
   * for every candidate digit how many positions it has in each of its three
   * houses (into reused, preallocated buffers so nothing is allocated per call).
   * Any tally of exactly 1 is a hidden single. This is the change that brought the
   * Basic tier under its performance target — see AGENTS.md Section 3.
   */
  public findAndPlaceHiddenSingle(): boolean {
    const size = this.size;
    const count = this.hsCount;
    const pos = this.hsPos;
    count.fill(0);

    const boxesPerRow = size / this.boxWidth;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (this.grid[r][c] !== 0) continue;

        const box = Math.floor(r / this.boxHeight) * boxesPerRow + Math.floor(c / this.boxWidth);
        const rowBase = r * size;
        const colBase = (size + c) * size;
        const boxBase = (2 * size + box) * size;
        const cellCode = r * size + c;

        let mask = this.candidates[r][c];
        while (mask !== 0) {
          const lowestBit = mask & -mask;
          const digitIndex = 31 - Math.clz32(lowestBit); // 0-based digit
          const ri = rowBase + digitIndex;
          const ci = colBase + digitIndex;
          const bi = boxBase + digitIndex;
          count[ri]++; pos[ri] = cellCode;
          count[ci]++; pos[ci] = cellCode;
          count[bi]++; pos[bi] = cellCode;
          mask &= mask - 1;
        }
      }
    }

    const totalEntries = this.numHouses * size;
    for (let h = 0; h < totalEntries; h++) {
      if (count[h] === 1) {
        const cellCode = pos[h];
        const digit = (h % size) + 1;
        this.placeNumber(Math.floor(cellCode / size), cellCode % size, digit);
        return true;
      }
    }
    return false;
  }

  public inSameBox(cell1: { r: number, c: number }, cell2: { r: number, c: number }): boolean {
    return Math.floor(cell1.r / this.boxHeight) === Math.floor(cell2.r / this.boxHeight) && Math.floor(cell1.c / this.boxWidth) === Math.floor(cell2.c / this.boxWidth);
  }

  public sees(cell1: { r: number, c: number }, cell2: { r: number, c: number }): boolean {
    if (cell1.r === cell2.r && cell1.c === cell2.c) return false;
    return cell1.r === cell2.r || cell1.c === cell2.c || this.inSameBox(cell1, cell2);
  }

  public getBoxCells(b: number): Cell[] {
    const cells: Cell[] = [];
    const boxesPerRow = this.size / this.boxWidth;
    const startRow = Math.floor(b / boxesPerRow) * this.boxHeight;
    const startCol = (b % boxesPerRow) * this.boxWidth;
    for (let dr = 0; dr < this.boxHeight; dr++) {
      for (let dc = 0; dc < this.boxWidth; dc++) {
        cells.push({ r: startRow + dr, c: startCol + dc });
      }
    }
    return cells;
  }

  public getEmptyCellsInHouse(axis: 'row' | 'col' | 'box', houseIdx: number): Cell[] {
    const cells: Cell[] = [];
    if (axis === 'row') {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[houseIdx][c] === 0 && this.candidates[houseIdx][c] !== 0) {
          cells.push({ r: houseIdx, c });
        }
      }
    } else if (axis === 'col') {
      for (let r = 0; r < this.size; r++) {
        if (this.grid[r][houseIdx] === 0 && this.candidates[r][houseIdx] !== 0) {
          cells.push({ r, c: houseIdx });
        }
      }
    } else {
      for (const { r, c } of this.getBoxCells(houseIdx)) {
        if (this.grid[r][c] === 0 && this.candidates[r][c] !== 0) {
          cells.push({ r, c });
        }
      }
    }
    return cells;
  }

  public buildHousePositions(): Cell[][] {
    const houseCells: Cell[][] = Array.from({ length: this.size * this.numHouses }, () => []);

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] !== 0) continue;
        const boxesPerRow = this.size / this.boxWidth;
        const b = Math.floor(r / this.boxHeight) * boxesPerRow + Math.floor(c / this.boxWidth);
        for (const num of this.candidateList(r, c)) {
          const base = (num - 1) * this.numHouses;
          houseCells[base + r].push({ r, c });
          houseCells[base + this.size + c].push({ r, c });
          houseCells[base + this.size * 2 + b].push({ r, c });
        }
      }
    }

    return houseCells;
  }

  public getConjugatePairs(): Map<number, [Cell, Cell][]> {
    const result = new Map<number, [Cell, Cell][]>();
    for (let num = 1; num <= this.size; num++) result.set(num, []);

    const houseCells = this.buildHousePositions();

    for (let num = 1; num <= this.size; num++) {
      const base = (num - 1) * this.numHouses;
      for (let h = 0; h < this.numHouses; h++) {
        if (houseCells[base + h].length === 2) {
          result.get(num)!.push([houseCells[base + h][0], houseCells[base + h][1]]);
        }
      }
    }

    return result;
  }

  public getCellsWithNCandidates(n: number): CandidateCell[] {
    const cells: CandidateCell[] = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] === 0 && this.candidateCount(r, c) === n) {
          cells.push({ r, c, cands: this.candidateList(r, c) });
        }
      }
    }
    return cells;
  }

  public getCandidatePositions(num: number, axis: 'row' | 'col' | 'box'): Cell[][] {
    const positions: Cell[][] = Array.from({ length: this.size }, () => []);
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] === 0 && this.hasCandidate(r, c, num)) {
          if (axis === 'row') positions[r].push({ r, c });
          else if (axis === 'col') positions[c].push({ r, c });
          else if (axis === 'box') {
            const boxesPerRow = this.size / this.boxWidth;
            const b = Math.floor(r / this.boxHeight) * boxesPerRow + Math.floor(c / this.boxWidth);
            positions[b].push({ r, c });
          }
        }
      }
    }
    return positions;
  }

  public eliminateFromCellsSeeingAll(targets: Cell[], cand: number, excludeCells: Cell[] = []): boolean {
    let changed = false;
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] !== 0) continue;
        if (excludeCells.some(e => e.r === r && e.c === c)) continue;
        if (!this.hasCandidate(r, c, cand)) continue;

        if (targets.every(t => this.sees({ r, c }, t))) {
          this.removeCandidate(r, c, cand);
          changed = true;
        }
      }
    }
    return changed;
  }

  public applyFishOnAxis(num: number, axis: 'row' | 'col', size: number): boolean {
    let changed = false;
    const positions = this.getCandidatePositions(num, axis);
    const getSecondary = (cell: Cell): number => axis === 'row' ? cell.c : cell.r;

    const eligible: number[] = [];
    for (let i = 0; i < this.size; i++) {
      if (positions[i].length >= 2 && positions[i].length <= size) {
        eligible.push(i);
      }
    }

    if (eligible.length < size) return false;

    const combos = this.combinations(eligible, size);
    for (const combo of combos) {
      const secondarySet = new Set<number>();
      for (const pri of combo) {
        for (const cell of positions[pri]) {
          secondarySet.add(getSecondary(cell));
        }
      }

      if (secondarySet.size !== size) continue;

      const fishSet = new Set(combo);
      for (const sec of secondarySet) {
        for (let pri = 0; pri < this.size; pri++) {
          if (fishSet.has(pri)) continue;
          const r = axis === 'row' ? pri : sec;
          const c = axis === 'row' ? sec : pri;
          if (this.removeCandidate(r, c, num)) {
            changed = true;
          }
        }
      }
    }

    return changed;
  }

  public combinations(arr: number[], k: number): number[][] {
    const results: number[][] = [];
    const build = (start: number, combo: number[]) => {
      if (combo.length === k) {
        results.push([...combo]);
        return;
      }
      for (let i = start; i < arr.length; i++) {
        combo.push(arr[i]);
        build(i + 1, combo);
        combo.pop();
      }
    };
    build(0, []);
    return results;
  }

  public applyWingPattern(pivotSize: 2 | 3): boolean {
    let changed = false;
    const bivalues = this.getCellsWithNCandidates(2);
    const pivots = this.getCellsWithNCandidates(pivotSize);

    for (const pivot of pivots) {
      const zCandidates = pivotSize === 2
        ? Array.from({ length: this.size }, (_, i) => i + 1).filter(n => !pivot.cands.includes(n))
        : pivot.cands;

      for (const z of zCandidates) {
        const others = pivot.cands.filter(c => c !== z);
        if (others.length !== 2) continue;

        const [x, y] = others;
        const pincer1Cands = [x, z].sort();
        const pincer2Cands = [y, z].sort();

        const pincer1Options = bivalues.filter(bv =>
          bv.cands[0] === pincer1Cands[0] && bv.cands[1] === pincer1Cands[1] && this.sees(pivot, bv)
        );
        const pincer2Options = bivalues.filter(bv =>
          bv.cands[0] === pincer2Cands[0] && bv.cands[1] === pincer2Cands[1] && this.sees(pivot, bv)
        );

        for (const p1 of pincer1Options) {
          for (const p2 of pincer2Options) {
            if (p1.r === p2.r && p1.c === p2.c) continue;
            if (pivotSize === 2 && this.sees(p1, p2)) continue;

            const targets = pivotSize === 2 ? [p1, p2] : [pivot, p1, p2];
            const exclude = pivotSize === 2 ? [pivot] : [];

            if (this.eliminateFromCellsSeeingAll(targets, z, exclude)) {
              changed = true;
            }
          }
        }
      }
    }

    return changed;
  }

  /**
   * Enumerates every Almost Locked Set (ALS) in the grid — a group of N cells in a
   * house whose combined candidates number exactly N+1.
   *
   * This is by far the most expensive step in the extreme tier, so rather than
   * materialising all C(n, k) cell combinations per house and testing each (the
   * old approach), it walks the subsets as a DFS that carries the running
   * candidate-union as a bitmask. The key prune: a valid ALS of size ≤ maxSubsetSize
   * has ≤ maxSubsetSize+1 candidates, and a subset's union only grows as cells are
   * added — so the moment the union's popcount exceeds that cap, the whole branch is
   * abandoned. This collapses the combinatorial blow-up (a 9-cell house has 511
   * subsets) down to the handful that can actually be ALSes. See AGENTS.md Section 1.
   */
  public enumerateALS(): { cells: Cell[]; mask: number }[] {
    const result: { cells: Cell[]; mask: number }[] = [];
    const maxSubsetSize = 5;
    const candidateCap = maxSubsetSize + 1;

    for (const axis of ['row', 'col', 'box'] as const) {
      for (let houseIdx = 0; houseIdx < this.size; houseIdx++) {
        const emptyCells = this.getEmptyCellsInHouse(axis, houseIdx);
        const chosen: Cell[] = [];

        const dfs = (start: number, unionMask: number) => {
          if (chosen.length >= 1 && popcount(unionMask) === chosen.length + 1) {
            // An ALS: its candidate set is carried as a bitmask so consumers can
            // intersect two ALS in O(1) with a bitwise AND + popcount.
            result.push({ cells: [...chosen], mask: unionMask });
          }
          if (chosen.length === maxSubsetSize) return;

          for (let i = start; i < emptyCells.length; i++) {
            const cell = emptyCells[i];
            const newMask = unionMask | this.candidates[cell.r][cell.c];
            // Prune: the union can only grow, and no ALS of size ≤ maxSubsetSize can
            // have more than maxSubsetSize+1 candidates, so this branch is dead.
            if (popcount(newMask) > candidateCap) continue;
            chosen.push(cell);
            dfs(i + 1, newMask);
            chosen.pop();
          }
        };

        dfs(0, 0);
      }
    }

    return result;
  }

  public combinationsOfCells(arr: Cell[], k: number): Cell[][] {
    const results: Cell[][] = [];
    const build = (start: number, combo: Cell[]) => {
      if (combo.length === k) {
        results.push([...combo]);
        return;
      }
      for (let i = start; i < arr.length; i++) {
        combo.push(arr[i]);
        build(i + 1, combo);
        combo.pop();
      }
    };
    build(0, []);
    return results;
  }

  public placeNumber(r: number, c: number, num: number) {
    this.grid[r][c] = num;
    this.filledCount++;
    this.candidates[r][c] = 0;

    const clearBit = ~(1 << (num - 1));
    for (let i = 0; i < this.size; i++) {
      this.candidates[r][i] &= clearBit;
      this.candidates[i][c] &= clearBit;
    }

    const boxStartR = Math.floor(r / this.boxHeight) * this.boxHeight;
    const boxStartC = Math.floor(c / this.boxWidth) * this.boxWidth;
    for (let dr = 0; dr < this.boxHeight; dr++) {
      for (let dc = 0; dc < this.boxWidth; dc++) {
        this.candidates[boxStartR + dr][boxStartC + dc] &= clearBit;
      }
    }
  }

  public isSolved(): boolean {
    return this.filledCount === this.totalCells;
  }

  /**
   * Runs the deduction loop until the puzzle is solved or no further progress can
   * be made. Strategies are attempted cheapest-first; on any successful
   * elimination or placement the loop restarts from the cheapest strategy
   * (`continue`), so simple ripple effects are always exhausted before an
   * expensive strategy is tried again.
   *
   * @param options.maxTier Caps how expensive the solver is allowed to get:
   *   `'basic'` stops after singles/pairs/pointing-pairs; `'advanced'` adds
   *   X-Wing/Swordfish/Y-Wing/XYZ-Wing; `'extreme'` (default) adds W-Wing/ALS-XZ/AIC.
   *   Advanced and extreme strategies are 9x9-only. Capping the tier is what lets
   *   the generator classify a puzzle by the hardest strategy it truly requires.
   * @returns Whether the puzzle was fully solved, and whether it required any
   *   advanced or extreme strategies (used to rate difficulty during generation).
   */
  public solve(options: { maxTier?: 'basic' | 'advanced' | 'extreme' } = {}): { solved: boolean, requiresAdvanced: boolean, requiresExtreme: boolean } {
    let changed = true;

    while (changed && !this.isSolved()) {
      changed = false;

      if (applyNakedSingle(this)) { changed = true; continue; }
      if (applyHiddenSingle(this)) { changed = true; continue; }
      if (applyNakedPair(this)) { changed = true; continue; }
      if (applyHiddenPair(this)) { changed = true; continue; }
      if (applyPointingPairs(this)) { changed = true; continue; }

      if (options.maxTier === 'basic') break;

      if (this.size === 9) {
        if (applyXWing(this)) { this.usedAdvanced = true; changed = true; continue; }
        if (applySwordfish(this)) { this.usedAdvanced = true; changed = true; continue; }
        if (applyYWing(this)) { this.usedAdvanced = true; changed = true; continue; }
        if (applyXYZWing(this)) { this.usedAdvanced = true; changed = true; continue; }
      }

      if (options.maxTier === 'advanced') break;

      if (this.size === 9) {
        if (applyWWing(this)) { this.usedExtreme = true; changed = true; continue; }
        if (applyALSXZ(this)) { this.usedExtreme = true; changed = true; continue; }
        if (applyAIC(this)) { this.usedExtreme = true; changed = true; continue; }
      }
    }

    return {
      solved: this.isSolved(),
      requiresAdvanced: this.usedAdvanced,
      requiresExtreme: this.usedExtreme
    };
  }
}

/**
 * True only if the grid is fully solvable with logical deduction up to the
 * advanced tier AND genuinely needs at least one advanced strategy. The
 * "requires advanced" clause is what makes a puzzle *rate* as Expert rather than
 * merely being solvable — an easier puzzle that happens to be solvable at the
 * advanced cap would return false here because it never needed an advanced step.
 */
export function canHumanSolveExpert(grid: number[][]): boolean {
  const solver = new HumanSolver(grid);
  const result = solver.solve({ maxTier: 'advanced' });
  return result.solved && result.requiresAdvanced;
}

/**
 * True only if the grid is fully solvable at the extreme tier AND genuinely
 * requires at least one extreme strategy (W-Wing, ALS-XZ, or AIC). Used by the
 * generator to accept a dug grid as a true Extreme puzzle. See
 * {@link canHumanSolveExpert} for why the "requires" clause matters.
 */
export function canHumanSolveExtreme(grid: number[][]): boolean {
  const solver = new HumanSolver(grid);
  const result = solver.solve({ maxTier: 'extreme' });
  return result.solved && result.requiresExtreme;
}
