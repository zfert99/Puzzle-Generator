// Represents a basic cell coordinate in the 9x9 grid
export type Cell = { r: number; c: number };

// Represents an empty cell along with its remaining possible candidates
export type CandidateCell = { r: number; c: number; cands: number[] };

/**
 * HumanSolver is a pure logical deduction engine for solving Sudoku puzzles.
 * Unlike backtracking algorithms which use brute-force guessing to quickly find a solution,
 * this solver mimics how a human plays by systematically applying increasingly complex strategies.
 * If this solver can complete the puzzle, it guarantees a human can solve it without guessing.
 */
export class HumanSolver {
  // Current state of the Sudoku grid (0 means empty cell)
  grid: number[][];

  // A 2D array tracking the remaining possible candidates (1-9) for every cell
  candidates: Set<number>[][];

  // Flag indicating if any advanced strategies (X-Wing, Swordfish, etc.) were used during solving
  usedAdvanced: boolean = false;

  // Tracks how many cells have been filled — avoids scanning all 81 cells to check completion
  private filledCount: number = 0;

  // ==========================================
  // HELPER METHODS
  // ==========================================

  /**
   * Checks if two cell coordinates fall inside the exact same 3x3 box.
   * There are 9 boxes in a Sudoku grid, numbered roughly like a phone dial.
   */
  private inSameBox(cell1: { r: number, c: number }, cell2: { r: number, c: number }): boolean {
    return Math.floor(cell1.r / 3) === Math.floor(cell2.r / 3) && Math.floor(cell1.c / 3) === Math.floor(cell2.c / 3);
  }

  /**
   * Checks if two cells "see" each other.
   * In Sudoku, two cells "see" each other if they share the same row, the same column, or the same 3x3 box.
   * A cell cannot see itself.
   */
  private sees(cell1: { r: number, c: number }, cell2: { r: number, c: number }): boolean {
    // A cell does not "see" itself
    if (cell1.r === cell2.r && cell1.c === cell2.c) return false;

    // Return true if cells share the same row, column, or 3x3 box
    return cell1.r === cell2.r || cell1.c === cell2.c || this.inSameBox(cell1, cell2);
  }

  /**
   * Given a box index (0 through 8), returns an array of the 9 cell coordinates within that box.
   * Box 0 is top-left, Box 1 is top-middle, ..., Box 8 is bottom-right.
   */
  private getBoxCells(b: number): Cell[] {
    const cells: Cell[] = [];
    const startRow = Math.floor(b / 3) * 3;
    const startCol = (b % 3) * 3;
    for (let i = 0; i < 9; i++) {
      cells.push({ r: startRow + Math.floor(i / 3), c: startCol + (i % 3) });
    }
    return cells;
  }

  /**
   * Scans the entire grid to find all empty cells that have exactly `n` remaining candidates.
   * Useful for finding singles (n=1), bivalue cells (n=2, useful for Y-Wing/Naked Pairs), or trivalue (n=3).
   */
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

  /**
   * Builds a position map showing exactly where a specific candidate exists along a given axis.
   * If axis = 'row', it returns an array where index `r` is a list of all cells in row `r` containing `num`.
   * If axis = 'col', index `c` is a list of all cells in column `c` containing `num`.
   * If axis = 'box', index `b` is a list of all cells in box `b` containing `num`.
   */
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

  /**
   * Powerful deduction helper: If we logically determine that a specific candidate CANNOT
   * be in any cell that simultaneously "sees" a specific set of target cells, we call this method.
   * It scans the grid, finds all cells that see ALL of the targets, and removes the candidate from them.
   */
  private eliminateFromCellsSeeingAll(targets: Cell[], cand: number, excludeCells: Cell[] = []): boolean {
    let changed = false;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.grid[r][c] !== 0) continue; // Skip filled cells

        // Sometimes a target cell itself (like a pivot in a Y-Wing) should be excluded from elimination
        if (excludeCells.some(e => e.r === r && e.c === c)) continue;

        if (!this.candidates[r][c].has(cand)) continue; // Skip if cell doesn't even have the candidate

        // If this empty cell sees EVERY single target cell, it's in the crossfire—eliminate the candidate
        if (targets.every(t => this.sees({ r, c }, t))) {
          this.candidates[r][c].delete(cand);
          changed = true;
        }
      }
    }
    return changed;
  }

  /**
   * Generic Fish Pattern Detection (X-Wing, Swordfish, Jellyfish, etc.)
   *
   * A "fish" of size N works as follows: find N rows (or columns) where a specific
   * candidate appears in only 2-to-N positions, and ALL those positions fall into
   * exactly N columns (or rows). The candidate can then be eliminated from those
   * N cover columns (or rows) in every other row (or column) not part of the fish.
   *
   * - Size 2 = X-Wing
   * - Size 3 = Swordfish
   * - Size 4 = Jellyfish (future)
   */
  private applyFishOnAxis(num: number, axis: 'row' | 'col', size: number): boolean {
    let changed = false;
    const positions = this.getCandidatePositions(num, axis);
    const getSecondary = (cell: Cell): number => axis === 'row' ? cell.c : cell.r;

    // Find all primary indices that have 2..size positions for this candidate
    const eligible: number[] = [];
    for (let i = 0; i < 9; i++) {
      if (positions[i].length >= 2 && positions[i].length <= size) {
        eligible.push(i);
      }
    }

    // We need at least `size` eligible lines to form a fish
    if (eligible.length < size) return false;

    // Check all combinations of `size` eligible lines
    const combos = this.combinations(eligible, size);
    for (const combo of combos) {
      // Collect all secondary indices used across the selected lines
      const secondarySet = new Set<number>();
      for (const pri of combo) {
        for (const cell of positions[pri]) {
          secondarySet.add(getSecondary(cell));
        }
      }

      // If they align into exactly `size` secondary lines, we found a fish!
      if (secondarySet.size !== size) continue;

      // Eliminate from the cover secondaries in all non-fish primary lines
      const fishSet = new Set(combo);
      for (const sec of secondarySet) {
        for (let pri = 0; pri < 9; pri++) {
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

  /**
   * Generates all k-element combinations from the given array of numbers.
   * Used by the fish pattern detector to enumerate candidate line groupings.
   */
  private combinations(arr: number[], k: number): number[][] {
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

  /**
   * Generic Wing Pattern Detection (Y-Wing, XYZ-Wing)
   *
   * Both patterns follow the same structural skeleton:
   * 1. Find a "pivot" cell (bivalue for Y-Wing, trivalue for XYZ-Wing)
   * 2. Identify a "target" candidate Z to eliminate
   * 3. Find two bivalue "pincer" cells containing Z + one other pivot candidate
   * 4. Eliminate Z from cells in the intersection of the pincers' vision
   *
   * The key insight: in a Y-Wing (pivotSize=2), Z is NOT in the pivot — the pincers
   * introduce it. In an XYZ-Wing (pivotSize=3), Z IS one of the pivot's own candidates.
   * This single difference drives three clean branches:
   * - Z enumeration source (complement vs subset of pivot candidates)
   * - Pincer mutual visibility constraint (Y-Wing requires pincers don't see each other)
   * - Elimination zone (Y-Wing: both pincers; XYZ-Wing: pivot + both pincers)
   *
   * - pivotSize 2 = Y-Wing
   * - pivotSize 3 = XYZ-Wing
   */
  private applyWingPattern(pivotSize: 2 | 3): boolean {
    let changed = false;
    const bivalues = this.getCellsWithNCandidates(2);
    const pivots = this.getCellsWithNCandidates(pivotSize);

    for (const pivot of pivots) {
      // Y-Wing: Z is any candidate NOT in the pivot (the pincers introduce it)
      // XYZ-Wing: Z is any candidate IN the pivot
      const zCandidates = pivotSize === 2
        ? Array.from({ length: 9 }, (_, i) => i + 1).filter(n => !pivot.cands.includes(n))
        : pivot.cands;

      for (const z of zCandidates) {
        // The two non-Z candidates from the pivot form the "wings"
        const others = pivot.cands.filter(c => c !== z);
        if (others.length !== 2) continue;

        const [x, y] = others;
        const pincer1Cands = [x, z].sort();
        const pincer2Cands = [y, z].sort();

        // Find bivalue cells matching the needed candidate pairs that see the pivot
        const pincer1Options = bivalues.filter(bv =>
          bv.cands[0] === pincer1Cands[0] && bv.cands[1] === pincer1Cands[1] && this.sees(pivot, bv)
        );
        const pincer2Options = bivalues.filter(bv =>
          bv.cands[0] === pincer2Cands[0] && bv.cands[1] === pincer2Cands[1] && this.sees(pivot, bv)
        );

        for (const p1 of pincer1Options) {
          for (const p2 of pincer2Options) {
            // A pincer cannot be the same physical cell as the other pincer
            if (p1.r === p2.r && p1.c === p2.c) continue;

            // Y-Wing only: pincers must NOT see each other
            if (pivotSize === 2 && this.sees(p1, p2)) continue;

            // Y-Wing: eliminate Z from cells seeing both pincers (pivot excluded from elimination)
            // XYZ-Wing: eliminate Z from cells seeing all three (pivot + both pincers)
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

  // ==========================================
  // INITIALIZATION AND PLACEMENT
  // ==========================================

  /**
   * Constructor initializes the solver with a given Sudoku grid
   */
  constructor(initialGrid: number[][]) {
    // Deep copy the initial grid so we don't mutate the original array
    this.grid = initialGrid.map(row => [...row]);

    // Initialize candidates for each cell: every cell starts with all 9 numbers possible
    this.candidates = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set<number>([1, 2, 3, 4, 5, 6, 7, 8, 9])));

    // Process the initial grid. For every filled cell, place the number which will
    // automatically trigger the removal of that number from the candidates of its row/col/box.
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.grid[r][c] !== 0) {
          this.placeNumber(r, c, this.grid[r][c]);
        }
      }
    }
  }

  /**
   * Places a number securely in the grid and immediately updates the "pencil marks" (candidates)
   * in the affected row, column, and 3x3 box.
   */
  placeNumber(r: number, c: number, num: number) {
    // Place the number in the grid
    this.grid[r][c] = num;

    // Track filled cell count for O(1) completion checks
    this.filledCount++;

    // The cell itself no longer needs candidates since it is filled
    this.candidates[r][c].clear();

    // Calculate which 3x3 box this cell falls into
    const boxIndex = Math.floor(r / 3) * 3 + Math.floor(c / 3);
    const boxCells = this.getBoxCells(boxIndex);

    // Iterate 9 times to sweep the entire row, column, and box simultaneously
    for (let i = 0; i < 9; i++) {
      // Eliminate this number from all other candidates in the same row
      this.candidates[r][i].delete(num);

      // Eliminate this number from all other candidates in the same column
      this.candidates[i][c].delete(num);

      // Eliminate this number from all other candidates in the same 3x3 box
      const cell = boxCells[i];
      this.candidates[cell.r][cell.c].delete(num);
    }
  }

  /**
   * O(1) check if every cell in the 9x9 grid has been filled.
   * Uses a running counter incremented by placeNumber() instead of scanning all 81 cells.
   */
  isSolved(): boolean {
    return this.filledCount === 81;
  }

  // ==========================================
  // MAIN SOLVING LOOP
  // ==========================================

  /**
   * The core solving routine. It loops continually, trying simple strategies first.
   * If simple strategies fail, it moves to advanced strategies.
   * It stops when the puzzle is solved, or when it gets completely stuck (meaning it
   * requires guessing or a strategy we haven't programmed).
   */
  solve(): { solved: boolean, requiresAdvanced: boolean } {
    let changed = true;

    while (changed && !this.isSolved()) {
      changed = false; // Reset flag at the start of each pass

      // BASIC STRATEGIES: Try to place numbers or make simple eliminations.
      // If any of these succeed, we restart the loop immediately to catch chain reactions.
      if (this.applyNakedSingle()) { changed = true; continue; }
      if (this.applyHiddenSingle()) { changed = true; continue; }
      if (this.applyNakedPair()) { changed = true; continue; }
      if (this.applyHiddenPair()) { changed = true; continue; }
      if (this.applyPointingPairs()) { changed = true; continue; }

      // ADVANCED STRATEGIES: More complex eliminations.
      // We only run these if the basic strategies are stuck.
      // If these succeed, we flag `usedAdvanced` so the engine knows this is an "Expert" puzzle.

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

  // ==========================================
  // BASIC STRATEGIES
  // ==========================================

  /**
   * Naked Single:
   * The simplest strategy. If an empty cell has had all but ONE of its candidates eliminated,
   * then that remaining candidate MUST be the answer for that cell.
   */
  applyNakedSingle(): boolean {
    const singles = this.getCellsWithNCandidates(1);
    if (singles.length > 0) {
      const { r, c, cands } = singles[0];
      this.placeNumber(r, c, cands[0]);
      return true; // Return immediately to let the placeNumber ripple effect trigger more singles
    }
    return false;
  }

  /**
   * Hidden Single:
   * Sometimes a cell has multiple candidates (e.g., it could be 4, 7, or 9).
   * However, if you look at the entire row (or col, or box) and notice that NO OTHER CELL 
   * in that row can possibly be a 7, then the 7 MUST go in this cell. It's a single, just "hidden" 
   * among other possibilities.
   */
  applyHiddenSingle(): boolean {
    // Check every number 1 through 9
    for (let num = 1; num <= 9; num++) {
      // Check its positions across every row, column, and box
      for (const axis of ['row', 'col', 'box'] as const) {
        const positions = this.getCandidatePositions(num, axis);
        for (let i = 0; i < 9; i++) {
          // If the candidate only appears in exactly one cell in this row/col/box
          if (positions[i].length === 1) {
            this.placeNumber(positions[i][0].r, positions[i][0].c, num);
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Naked Pair:
   * If two cells in the same row/col/box have EXACTLY the same two candidates (e.g., both are [2, 5]),
   * then those two numbers must be split between those two cells. No other cell in that row/col/box
   * can be a 2 or a 5. We can eliminate 2 and 5 from all other cells in that zone.
   */
  applyNakedPair(): boolean {
    let changed = false;
    // Get all cells that have exactly 2 candidates (bivalue cells)
    const bivalues = this.getCellsWithNCandidates(2);

    for (let i = 0; i < bivalues.length; i++) {
      for (let j = i + 1; j < bivalues.length; j++) {
        const b1 = bivalues[i];
        const b2 = bivalues[j];

        // Check if these two bivalue cells have the exact same two candidates
        if (b1.cands[0] === b2.cands[0] && b1.cands[1] === b2.cands[1]) {
          const [cand1, cand2] = b1.cands;

          // Shared row: If they are in the same row, eliminate the pair from the rest of the row
          if (b1.r === b2.r) {
            for (let c = 0; c < 9; c++) {
              if (c !== b1.c && c !== b2.c && this.grid[b1.r][c] === 0) {
                if (this.candidates[b1.r][c].has(cand1)) { this.candidates[b1.r][c].delete(cand1); changed = true; }
                if (this.candidates[b1.r][c].has(cand2)) { this.candidates[b1.r][c].delete(cand2); changed = true; }
              }
            }
          }

          // Shared col: If they are in the same column, eliminate the pair from the rest of the column
          if (b1.c === b2.c) {
            for (let r = 0; r < 9; r++) {
              if (r !== b1.r && r !== b2.r && this.grid[r][b1.c] === 0) {
                if (this.candidates[r][b1.c].has(cand1)) { this.candidates[r][b1.c].delete(cand1); changed = true; }
                if (this.candidates[r][b1.c].has(cand2)) { this.candidates[r][b1.c].delete(cand2); changed = true; }
              }
            }
          }

          // Shared box: If they are in the same box, eliminate the pair from the rest of the box
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

  /**
   * Hidden Pair:
   * If two candidates are restricted to the exact same two cells within a row, column, or box,
   * then those two cells must contain those two candidates. All other candidates can be 
   * safely eliminated from those two cells.
   */
  applyHiddenPair(): boolean {
    let changed = false;

    // Check across every row, column, and box
    for (const axis of ['row', 'col', 'box'] as const) {
      
      // Pre-calculate positions for all 9 numbers on this axis
      // positionsByNum[num][zoneIndex] = array of cells
      const positionsByNum: { r: number, c: number }[][][] = [];
      for (let num = 1; num <= 9; num++) {
        positionsByNum[num] = this.getCandidatePositions(num, axis);
      }

      // For each zone index (0-8)
      for (let i = 0; i < 9; i++) {
        // Find all candidates that appear exactly twice in this zone
        const candidatesWithTwoSpots = [];
        for (let num = 1; num <= 9; num++) {
          const cells = positionsByNum[num][i];
          if (cells.length === 2) {
            candidatesWithTwoSpots.push({ num, cells });
          }
        }

        // We need at least two such candidates to form a pair
        if (candidatesWithTwoSpots.length >= 2) {
          for (let a = 0; a < candidatesWithTwoSpots.length; a++) {
            for (let b = a + 1; b < candidatesWithTwoSpots.length; b++) {
              const candA = candidatesWithTwoSpots[a];
              const candB = candidatesWithTwoSpots[b];

              // Check if they occupy the EXACT same two cells
              // (Since they are pushed in grid order, cell 0 and cell 1 will match directly)
              if (
                candA.cells[0].r === candB.cells[0].r && candA.cells[0].c === candB.cells[0].c &&
                candA.cells[1].r === candB.cells[1].r && candA.cells[1].c === candB.cells[1].c
              ) {
                // We found a Hidden Pair!
                // Eliminate all OTHER candidates from these two cells
                for (const cell of candA.cells) {
                  const cellCandidates = this.candidates[cell.r][cell.c];
                  // Only process if it has more than just our pair
                  if (cellCandidates.size > 2) {
                    for (const c of Array.from(cellCandidates)) {
                      if (c !== candA.num && c !== candB.num) {
                        cellCandidates.delete(c);
                        changed = true;
                      }
                    }
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

  /**
   * Pointing Pairs / Pointing Triples (Box-Line Reduction):
   * If a specific candidate within a 3x3 box only appears in one specific row (or column),
   * then we know the final answer for that box MUST fall somewhere in that line.
   * Because of this, that candidate cannot exist anywhere else along that same row (or column) 
   * OUTSIDE of the box. We can safely eliminate it.
   */
  applyPointingPairs(): boolean {
    let changed = false;
    for (let num = 1; num <= 9; num++) {
      // Find all positions of `num` grouped by box
      const boxPositions = this.getCandidatePositions(num, 'box');

      for (let b = 0; b < 9; b++) {
        const cells = boxPositions[b];
        // Only consider if the candidate is restricted to 2 or 3 cells in the box
        if (cells.length === 2 || cells.length === 3) {
          // Check if all those cells share the same row or the same column
          const sameRow = cells.every(cell => cell.r === cells[0].r);
          const sameCol = cells.every(cell => cell.c === cells[0].c);

          if (sameRow) {
            const r = cells[0].r;
            for (let c = 0; c < 9; c++) {
              // Iterate through the whole row. If a cell is NOT in our box (b % 3), eliminate the candidate.
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
              // Iterate through the whole col. If a cell is NOT in our box (Math.floor(b/3)), eliminate.
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

  // ==========================================
  // ADVANCED STRATEGIES
  // ==========================================

  /**
   * X-Wing (Fish Size 2):
   * Look for a specific candidate. If there are exactly TWO rows where this candidate can be placed,
   * AND those placements align in the exact same TWO columns, they form a perfect rectangle (or 'X').
   * Since the candidate must be placed in diagonally opposite corners of this rectangle, it is
   * guaranteed to occupy both of those columns. We can therefore eliminate the candidate from all
   * OTHER rows in those two columns. (And vice versa for column-based X-Wings.)
   *
   * Delegates to the generic applyFishOnAxis helper with size = 2.
   */
  applyXWing(): boolean {
    let changed = false;
    for (let num = 1; num <= 9; num++) {
      if (this.applyFishOnAxis(num, 'row', 2)) changed = true;
      if (this.applyFishOnAxis(num, 'col', 2)) changed = true;
    }
    return changed;
  }

  /**
   * Y-Wing (Wing Pattern, pivotSize 2):
   * Requires three bivalue cells. A "Pivot" cell [A, B], and two "Pincer" cells
   * [A, C] and [B, C] that each see the pivot but NOT each other.
   * Since the pivot must be A or B, one pincer is always forced to C.
   * Any cell seeing BOTH pincers can therefore never be C.
   *
   * Delegates to the generic applyWingPattern helper with pivotSize = 2.
   */
  applyYWing(): boolean {
    return this.applyWingPattern(2);
  }

  /**
   * Swordfish (Fish Size 3):
   * A 3x3 expansion of the X-Wing. We look for a specific candidate. If there are exactly 3 rows
   * where this candidate appears in 2 or 3 spots, AND all those spots fall into exactly 3 columns
   * overall, it forms a closed loop. The candidate MUST occupy those 3 columns in those 3 rows.
   * Therefore, we can eliminate the candidate from all other rows in those 3 columns.
   * (And vice versa for column-based Swordfish.)
   *
   * Delegates to the generic applyFishOnAxis helper with size = 3.
   */
  applySwordfish(): boolean {
    let changed = false;
    for (let num = 1; num <= 9; num++) {
      if (this.applyFishOnAxis(num, 'row', 3)) changed = true;
      if (this.applyFishOnAxis(num, 'col', 3)) changed = true;
    }
    return changed;
  }

  /**
   * XYZ-Wing (Wing Pattern, pivotSize 3):
   * A "Pivot" cell with THREE candidates [A, B, C] and two bivalue "Pincer" cells
   * [A, C] and [B, C] that each see the pivot.
   * Since the pivot must be A, B, or C — in every case, one of the three cells is C.
   * Any cell seeing ALL THREE (pivot + both pincers) can therefore never be C.
   *
   * Delegates to the generic applyWingPattern helper with pivotSize = 3.
   */
  applyXYZWing(): boolean {
    return this.applyWingPattern(3);
  }
}

/**
 * Utility function to quickly test if a puzzle can be solved by the HumanSolver.
 * Returns true only if it is completely solved AND required at least one advanced strategy.
 */
export function canHumanSolveExpert(grid: number[][]): boolean {
  const solver = new HumanSolver(grid);
  const result = solver.solve();
  return result.solved && result.requiresAdvanced;
}
