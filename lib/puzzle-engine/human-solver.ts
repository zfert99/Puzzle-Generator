export type Cell = { r: number; c: number };
export type CandidateCell = { r: number; c: number; cands: number[] };

export class HumanSolver {
  // Current state of the Sudoku grid
  grid: number[][];
  // Candidates for each cell
  candidates: Set<number>[][];
  // Whether advanced strategies were used
  usedAdvanced: boolean = false;

  // Check if two cells are in the same 3x3 box
  private inSameBox(cell1: { r: number, c: number }, cell2: { r: number, c: number }): boolean {
    return Math.floor(cell1.r / 3) === Math.floor(cell2.r / 3) && Math.floor(cell1.c / 3) === Math.floor(cell2.c / 3);
  }

  // Check if two cells "see" each other (share a row, column, or 3x3 box)
  private sees(cell1: { r: number, c: number }, cell2: { r: number, c: number }): boolean {
    // A cell does not "see" itself
    if (cell1.r === cell2.r && cell1.c === cell2.c) return false;
    // Return true if cells share the same row, column, or 3x3 box
    return cell1.r === cell2.r || cell1.c === cell2.c || this.inSameBox(cell1, cell2);
  }

  // Get all cells for a given 3x3 box (0-8)
  private getBoxCells(b: number): Cell[] {
    const cells: Cell[] = [];
    const startRow = Math.floor(b / 3) * 3;
    const startCol = (b % 3) * 3;
    for (let i = 0; i < 9; i++) {
      cells.push({ r: startRow + Math.floor(i / 3), c: startCol + (i % 3) });
    }
    return cells;
  }

  // Get all empty cells with exactly n candidates
  private getCellsWithNCandidates(n: number): CandidateCell[] {
    const cells: CandidateCell[] = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.grid[r][c] === 0 && this.candidates[r][c].size === n) {
          cells.push({ r, c, cands: Array.from(this.candidates[r][c]).sort() });
        }
      }
    }
    return cells;
  }

  // Build a position map for a candidate: for each row/col/box, which cells contain it
  private getCandidatePositions(num: number, axis: 'row' | 'col' | 'box'): Cell[][] {
    const positions: Cell[][] = Array.from({ length: 9 }, () => []);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.grid[r][c] === 0 && this.candidates[r][c].has(num)) {
          if (axis === 'row') positions[r].push({ r, c });
          else if (axis === 'col') positions[c].push({ r, c });
          else if (axis === 'box') {
            const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
            positions[b].push({ r, c });
          }
        }
      }
    }
    return positions;
  }

  // Eliminate a candidate from all empty cells that see every cell in targets
  private eliminateFromCellsSeeingAll(targets: Cell[], cand: number, excludeCells: Cell[] = []): boolean {
    let changed = false;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
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

  // Constructor: initializes the solver with a given Sudoku grid
  constructor(initialGrid: number[][]) {
    // Copy the initial grid
    this.grid = initialGrid.map(row => [...row]);
    // Initialize candidates for each cell
    this.candidates = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set<number>([1, 2, 3, 4, 5, 6, 7, 8, 9])));

    // Initialize candidates
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.grid[r][c] !== 0) {
          this.placeNumber(r, c, this.grid[r][c]);
        }
      }
    }
  }

  // Place a number in the grid and update candidates in the affected row, column, and box
  placeNumber(r: number, c: number, num: number) {
    // Place the number in the grid
    this.grid[r][c] = num;
    // Clear candidates for the placed number
    this.candidates[r][c].clear();

    // Get the cells of the 3x3 box this cell belongs to
    const boxIndex = Math.floor(r / 3) * 3 + Math.floor(c / 3);
    const boxCells = this.getBoxCells(boxIndex);

    for (let i = 0; i < 9; i++) {
      // Remove the number from candidates in the same row
      this.candidates[r][i].delete(num);
      // Remove the number from candidates in the same column
      this.candidates[i][c].delete(num);
      // Remove the number from candidates in the same 3x3 box
      const cell = boxCells[i];
      this.candidates[cell.r][cell.c].delete(num);
    }
  }

  // Check if the Sudoku grid is completely filled
  isSolved(): boolean {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.grid[r][c] === 0) return false;
      }
    }
    return true;
  }

  solve(): { solved: boolean, requiresAdvanced: boolean } {
    let changed = true;

    while (changed && !this.isSolved()) {
      changed = false;

      if (this.applyNakedSingle()) { changed = true; continue; }
      if (this.applyHiddenSingle()) { changed = true; continue; }
      if (this.applyNakedPair()) { changed = true; continue; }
      if (this.applyPointingPairs()) { changed = true; continue; }

      // Advanced Strategies
      if (this.applyXWing()) {
        this.usedAdvanced = true;
        changed = true;
        continue;
      }

      if (this.applySwordfish()) {
        this.usedAdvanced = true;
        changed = true;
        continue;
      }

      if (this.applyYWing()) {
        this.usedAdvanced = true;
        changed = true;
        continue;
      }

      if (this.applyXYZWing()) {
        this.usedAdvanced = true;
        changed = true;
        continue;
      }
    }

    return {
      solved: this.isSolved(),
      requiresAdvanced: this.usedAdvanced
    };
  }

  // Checks every cell for a single candidate and places it if found
  applyNakedSingle(): boolean {
    const singles = this.getCellsWithNCandidates(1);
    if (singles.length > 0) {
      const { r, c, cands } = singles[0];
      this.placeNumber(r, c, cands[0]);
      return true;
    }
    return false;
  }

  // Checks every row, column, and box for a hidden single and places it if found
  applyHiddenSingle(): boolean {
    for (let num = 1; num <= 9; num++) {
      for (const axis of ['row', 'col', 'box'] as const) {
        const positions = this.getCandidatePositions(num, axis);
        for (let i = 0; i < 9; i++) {
          if (positions[i].length === 1) {
            this.placeNumber(positions[i][0].r, positions[i][0].c, num);
            return true;
          }
        }
      }
    }
    return false;
  }

  // Find two cells in the same row/column/box that have the same two candidates
  // If found, remove those candidates from all other cells in that row/column/box
  applyNakedPair(): boolean {
    let changed = false;
    const bivalues = this.getCellsWithNCandidates(2);

    for (let i = 0; i < bivalues.length; i++) {
      for (let j = i + 1; j < bivalues.length; j++) {
        const b1 = bivalues[i];
        const b2 = bivalues[j];
        
        // Only care if they have the exact same two candidates
        if (b1.cands[0] === b2.cands[0] && b1.cands[1] === b2.cands[1]) {
          const [cand1, cand2] = b1.cands;
          
          // Shared row
          if (b1.r === b2.r) {
            for (let c = 0; c < 9; c++) {
              if (c !== b1.c && c !== b2.c && this.grid[b1.r][c] === 0) {
                if (this.candidates[b1.r][c].has(cand1)) { this.candidates[b1.r][c].delete(cand1); changed = true; }
                if (this.candidates[b1.r][c].has(cand2)) { this.candidates[b1.r][c].delete(cand2); changed = true; }
              }
            }
          }
          
          // Shared col
          if (b1.c === b2.c) {
            for (let r = 0; r < 9; r++) {
              if (r !== b1.r && r !== b2.r && this.grid[r][b1.c] === 0) {
                if (this.candidates[r][b1.c].has(cand1)) { this.candidates[r][b1.c].delete(cand1); changed = true; }
                if (this.candidates[r][b1.c].has(cand2)) { this.candidates[r][b1.c].delete(cand2); changed = true; }
              }
            }
          }

          // Shared box
          if (this.inSameBox(b1, b2)) {
            const b1Box = Math.floor(b1.r / 3) * 3 + Math.floor(b1.c / 3);
            for (const { r, c } of this.getBoxCells(b1Box)) {
              if ((r !== b1.r || c !== b1.c) && (r !== b2.r || c !== b2.c) && this.grid[r][c] === 0) {
                if (this.candidates[r][c].has(cand1)) { this.candidates[r][c].delete(cand1); changed = true; }
                if (this.candidates[r][c].has(cand2)) { this.candidates[r][c].delete(cand2); changed = true; }
              }
            }
          }
        }
      }
    }

    return changed;
  }

  applyPointingPairs(): boolean {
    let changed = false;
    for (let num = 1; num <= 9; num++) {
      const boxPositions = this.getCandidatePositions(num, 'box');
      for (let b = 0; b < 9; b++) {
        const cells = boxPositions[b];
        if (cells.length === 2 || cells.length === 3) {
          const sameRow = cells.every(cell => cell.r === cells[0].r);
          const sameCol = cells.every(cell => cell.c === cells[0].c);

          if (sameRow) {
            const r = cells[0].r;
            for (let c = 0; c < 9; c++) {
              if (Math.floor(c / 3) !== b % 3) {
                if (this.candidates[r][c].has(num)) {
                  this.candidates[r][c].delete(num);
                  changed = true;
                }
              }
            }
          } else if (sameCol) {
            const c = cells[0].c;
            for (let r = 0; r < 9; r++) {
              if (Math.floor(r / 3) !== Math.floor(b / 3)) {
                if (this.candidates[r][c].has(num)) {
                  this.candidates[r][c].delete(num);
                  changed = true;
                }
              }
            }
          }
        }
      }
    }
    return changed;
  }

  applyXWing(): boolean {
    let changed = false;
    for (let num = 1; num <= 9; num++) {
      // Row X-Wing
      const rowPositions = this.getCandidatePositions(num, 'row');

      for (let r1 = 0; r1 < 8; r1++) {
        if (rowPositions[r1].length === 2) {
          for (let r2 = r1 + 1; r2 < 9; r2++) {
            if (rowPositions[r2].length === 2 && rowPositions[r1][0].c === rowPositions[r2][0].c && rowPositions[r1][1].c === rowPositions[r2][1].c) {
              const c1 = rowPositions[r1][0].c;
              const c2 = rowPositions[r1][1].c;
              // Remove from cols c1, c2
              for (let r = 0; r < 9; r++) {
                if (r !== r1 && r !== r2) {
                  if (this.candidates[r][c1].has(num)) { this.candidates[r][c1].delete(num); changed = true; }
                  if (this.candidates[r][c2].has(num)) { this.candidates[r][c2].delete(num); changed = true; }
                }
              }
            }
          }
        }
      }
    }
    return changed;
  }

  applyYWing(): boolean {
    let changed = false;
    const bivalues = this.getCellsWithNCandidates(2);

    for (let i = 0; i < bivalues.length; i++) {
      const pivot = bivalues[i];
      const pincerCandidates: CandidateCell[] = [];

      for (let j = 0; j < bivalues.length; j++) {
        if (i === j) continue;
        const pincer = bivalues[j];
        if (this.sees(pivot, pincer)) {
          // Check if they share exactly 1 candidate
          const shared = pivot.cands.filter(c => pincer.cands.includes(c));
          if (shared.length === 1) {
            pincerCandidates.push(pincer);
          }
        }
      }

      // Check pairs of pincers
      for (let a = 0; a < pincerCandidates.length; a++) {
        for (let b = a + 1; b < pincerCandidates.length; b++) {
          const pincer1 = pincerCandidates[a];
          const pincer2 = pincerCandidates[b];
          if (!this.sees(pincer1, pincer2)) {
            // They must share a candidate that is NOT in pivot
            const cand1 = pincer1.cands.find(c => !pivot.cands.includes(c))!;
            const cand2 = pincer2.cands.find(c => !pivot.cands.includes(c))!;

            if (cand1 === cand2) {
              // Any cell that sees BOTH pincers cannot have this candidate
              if (this.eliminateFromCellsSeeingAll([pincer1, pincer2], cand1, [pivot])) {
                changed = true;
              }
            }
          }
        }
      }
    }

    return changed;
  }

  applySwordfish(): boolean {
    let changed = false;
    for (let num = 1; num <= 9; num++) {
      // Row-based Swordfish: find 3 rows where candidate appears in at most 3 columns total
      const rowPositions = this.getCandidatePositions(num, 'row');

      // Find triplets of rows that each have 2-3 positions, all fitting within exactly 3 columns
      for (let r1 = 0; r1 < 7; r1++) {
        if (rowPositions[r1].length < 2 || rowPositions[r1].length > 3) continue;
        for (let r2 = r1 + 1; r2 < 8; r2++) {
          if (rowPositions[r2].length < 2 || rowPositions[r2].length > 3) continue;
          for (let r3 = r2 + 1; r3 < 9; r3++) {
            if (rowPositions[r3].length < 2 || rowPositions[r3].length > 3) continue;

            // Collect all unique columns used across the 3 rows
            const colSet = new Set<number>([
              ...rowPositions[r1].map(x => x.c), 
              ...rowPositions[r2].map(x => x.c), 
              ...rowPositions[r3].map(x => x.c)
            ]);
            if (colSet.size !== 3) continue;

            // Valid Swordfish found — eliminate candidate from these 3 columns in all OTHER rows
            const coverCols = Array.from(colSet);
            for (const c of coverCols) {
              for (let r = 0; r < 9; r++) {
                if (r !== r1 && r !== r2 && r !== r3) {
                  if (this.candidates[r][c].has(num)) {
                    this.candidates[r][c].delete(num);
                    changed = true;
                  }
                }
              }
            }
          }
        }
      }

      // Column-based Swordfish: find 3 columns where candidate appears in at most 3 rows total
      const colPositions = this.getCandidatePositions(num, 'col');

      for (let c1 = 0; c1 < 7; c1++) {
        if (colPositions[c1].length < 2 || colPositions[c1].length > 3) continue;
        for (let c2 = c1 + 1; c2 < 8; c2++) {
          if (colPositions[c2].length < 2 || colPositions[c2].length > 3) continue;
          for (let c3 = c2 + 1; c3 < 9; c3++) {
            if (colPositions[c3].length < 2 || colPositions[c3].length > 3) continue;

            const rowSet = new Set<number>([
              ...colPositions[c1].map(x => x.r), 
              ...colPositions[c2].map(x => x.r), 
              ...colPositions[c3].map(x => x.r)
            ]);
            if (rowSet.size !== 3) continue;

            const coverRows = Array.from(rowSet);
            for (const r of coverRows) {
              for (let c = 0; c < 9; c++) {
                if (c !== c1 && c !== c2 && c !== c3) {
                  if (this.candidates[r][c].has(num)) {
                    this.candidates[r][c].delete(num);
                    changed = true;
                  }
                }
              }
            }
          }
        }
      }
    }
    return changed;
  }

  applyXYZWing(): boolean {
    let changed = false;

    // Collect all bivalue cells (for pincers) and trivalue cells (for pivots)
    const bivalues = this.getCellsWithNCandidates(2);
    const trivalues = this.getCellsWithNCandidates(3);

    // For each trivalue pivot (ABC), find two bivalue pincers (AC, BC) that each see the pivot
    for (const pivot of trivalues) {
      const [a, b, z] = pivot.cands;
      // Try each candidate in the pivot as the "z" (the common elimination candidate)
      const zCandidates = [a, b, z];

      for (const zCand of zCandidates) {
        // The other two candidates form the "split"
        const others = pivot.cands.filter(c => c !== zCand);
        const x = others[0];
        const y = others[1];

        // Pincer1 must have {x, z} and see pivot
        // Pincer2 must have {y, z} and see pivot
        const pincer1Cands = [x, zCand].sort();
        const pincer2Cands = [y, zCand].sort();

        const pincer1Options = bivalues.filter(bv =>
          bv.cands[0] === pincer1Cands[0] && bv.cands[1] === pincer1Cands[1] && this.sees(pivot, bv)
        );
        const pincer2Options = bivalues.filter(bv =>
          bv.cands[0] === pincer2Cands[0] && bv.cands[1] === pincer2Cands[1] && this.sees(pivot, bv)
        );

        for (const p1 of pincer1Options) {
          for (const p2 of pincer2Options) {
            if (p1.r === p2.r && p1.c === p2.c) continue;

            // XYZ-Wing elimination: remove zCand from cells that see ALL THREE (pivot + both pincers)
            if (this.eliminateFromCellsSeeingAll([pivot, p1, p2], zCand)) {
              changed = true;
            }
          }
        }
      }
    }

    return changed;
  }
}

export function canHumanSolveExpert(grid: number[][]): boolean {
  const solver = new HumanSolver(grid);
  const result = solver.solve();
  return result.solved && result.requiresAdvanced;
}
