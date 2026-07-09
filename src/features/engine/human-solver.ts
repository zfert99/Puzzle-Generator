import { applyNakedSingle, applyHiddenSingle, applyNakedPair, applyHiddenPair, applyPointingPairs } from './strategies/basic';
import { applyXWing, applySwordfish, applyYWing, applyXYZWing } from './strategies/advanced';
import { applyWWing, applyALSXZ, applyAIC } from './strategies/extreme';

export type Cell = { r: number; c: number };
export type CandidateCell = { r: number; c: number; cands: number[] };

/**
 * HumanSolver is a pure logical deduction engine for solving Sudoku puzzles.
 * Unlike backtracking algorithms which use brute-force guessing to quickly find a solution,
 * this solver mimics how a human plays by systematically applying increasingly complex strategies.
 * If this solver can complete the puzzle, it guarantees a human can solve it without guessing.
 */
export class HumanSolver {
  grid: number[][];
  candidates: Set<number>[][];
  readonly size: number;
  readonly boxWidth: number;
  readonly boxHeight: number;
  readonly numBoxes: number;
  readonly numHouses: number;
  readonly totalCells: number;
  usedAdvanced: boolean = false;
  usedExtreme: boolean = false;
  private filledCount: number = 0;

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

    const allCands = Array.from({ length: this.size }, (_, i) => i + 1);
    this.candidates = Array.from({ length: this.size }, () => Array.from({ length: this.size }, () => new Set<number>(allCands)));

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] !== 0) {
          this.placeNumber(r, c, this.grid[r][c]);
        }
      }
    }
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
        if (this.grid[houseIdx][c] === 0 && this.candidates[houseIdx][c].size > 0) {
          cells.push({ r: houseIdx, c });
        }
      }
    } else if (axis === 'col') {
      for (let r = 0; r < this.size; r++) {
        if (this.grid[r][houseIdx] === 0 && this.candidates[r][houseIdx].size > 0) {
          cells.push({ r, c: houseIdx });
        }
      }
    } else {
      for (const { r, c } of this.getBoxCells(houseIdx)) {
        if (this.grid[r][c] === 0 && this.candidates[r][c].size > 0) {
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
        for (const num of this.candidates[r][c]) {
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
        if (this.grid[r][c] === 0 && this.candidates[r][c].size === n) {
          cells.push({ r, c, cands: Array.from(this.candidates[r][c]).sort() });
        }
      }
    }
    return cells;
  }

  public getCandidatePositions(num: number, axis: 'row' | 'col' | 'box'): Cell[][] {
    const positions: Cell[][] = Array.from({ length: this.size }, () => []);
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.grid[r][c] === 0 && this.candidates[r][c].has(num)) {
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
        if (!this.candidates[r][c].has(cand)) continue;

        if (targets.every(t => this.sees({ r, c }, t))) {
          this.candidates[r][c].delete(cand);
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
          if (this.candidates[r][c].has(num)) {
            this.candidates[r][c].delete(num);
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

  public enumerateALS(): { cells: Cell[]; candidates: Set<number> }[] {
    const result: { cells: Cell[]; candidates: Set<number> }[] = [];
    const maxSubsetSize = 5;

    for (const axis of ['row', 'col', 'box'] as const) {
      for (let houseIdx = 0; houseIdx < this.size; houseIdx++) {
        const emptyCells = this.getEmptyCellsInHouse(axis, houseIdx);

        for (let size = 1; size <= Math.min(maxSubsetSize, emptyCells.length); size++) {
          const subsets = this.combinationsOfCells(emptyCells, size);
          for (const subset of subsets) {
            const unionCands = new Set<number>();
            for (const cell of subset) {
              for (const cand of this.candidates[cell.r][cell.c]) {
                unionCands.add(cand);
              }
            }

            if (unionCands.size === subset.length + 1) {
              result.push({ cells: [...subset], candidates: unionCands });
            }
          }
        }
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
    this.candidates[r][c].clear();

    for (let i = 0; i < this.size; i++) {
      this.candidates[r][i].delete(num);
      this.candidates[i][c].delete(num);
    }

    const boxStartR = Math.floor(r / this.boxHeight) * this.boxHeight;
    const boxStartC = Math.floor(c / this.boxWidth) * this.boxWidth;
    for (let dr = 0; dr < this.boxHeight; dr++) {
      for (let dc = 0; dc < this.boxWidth; dc++) {
        this.candidates[boxStartR + dr][boxStartC + dc].delete(num);
      }
    }
  }

  public isSolved(): boolean {
    return this.filledCount === this.totalCells;
  }

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

export function canHumanSolveExpert(grid: number[][]): boolean {
  const solver = new HumanSolver(grid);
  const result = solver.solve({ maxTier: 'advanced' });
  return result.solved && result.requiresAdvanced;
}

export function canHumanSolveExtreme(grid: number[][]): boolean {
  const solver = new HumanSolver(grid);
  const result = solver.solve({ maxTier: 'extreme' });
  return result.solved && result.requiresExtreme;
}
