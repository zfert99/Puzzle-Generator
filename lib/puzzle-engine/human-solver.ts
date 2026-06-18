export type Cell = { r: number; c: number };

export class HumanSolver {
  grid: number[][];
  candidates: Set<number>[][];
  usedAdvanced: boolean = false;

  // Check if two cells "see" each other (share a row, column, or 3x3 box)
  private sees(cell1: { r: number, c: number }, cell2: { r: number, c: number }): boolean {
    if (cell1.r === cell2.r && cell1.c === cell2.c) return false;
    return cell1.r === cell2.r || cell1.c === cell2.c || (Math.floor(cell1.r / 3) === Math.floor(cell2.r / 3) && Math.floor(cell1.c / 3) === Math.floor(cell2.c / 3));
  }

  constructor(initialGrid: number[][]) {
    this.grid = initialGrid.map(row => [...row]);
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

  placeNumber(r: number, c: number, num: number) {
    this.grid[r][c] = num;
    this.candidates[r][c].clear();

    const startRow = Math.floor(r / 3) * 3;
    const startCol = Math.floor(c / 3) * 3;

    for (let i = 0; i < 9; i++) {
      this.candidates[r][i].delete(num);
      this.candidates[i][c].delete(num);
      const br = startRow + Math.floor(i / 3);
      const bc = startCol + (i % 3);
      this.candidates[br][bc].delete(num);
    }
  }

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

  applyNakedSingle(): boolean {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.grid[r][c] === 0 && this.candidates[r][c].size === 1) {
          const num = Array.from(this.candidates[r][c])[0];
          this.placeNumber(r, c, num);
          return true;
        }
      }
    }
    return false;
  }

  applyHiddenSingle(): boolean {
    for (let num = 1; num <= 9; num++) {
      // Check rows
      for (let r = 0; r < 9; r++) {
        let possibleCols = [];
        for (let c = 0; c < 9; c++) {
          if (this.grid[r][c] === 0 && this.candidates[r][c].has(num)) possibleCols.push(c);
        }
        if (possibleCols.length === 1) {
          this.placeNumber(r, possibleCols[0], num);
          return true;
        }
      }
      // Check cols
      for (let c = 0; c < 9; c++) {
        let possibleRows = [];
        for (let r = 0; r < 9; r++) {
          if (this.grid[r][c] === 0 && this.candidates[r][c].has(num)) possibleRows.push(r);
        }
        if (possibleRows.length === 1) {
          this.placeNumber(possibleRows[0], c, num);
          return true;
        }
      }
      // Check boxes
      for (let b = 0; b < 9; b++) {
        let possibleCells = [];
        const startRow = Math.floor(b / 3) * 3;
        const startCol = (b % 3) * 3;
        for (let i = 0; i < 9; i++) {
          const r = startRow + Math.floor(i / 3);
          const c = startCol + (i % 3);
          if (this.grid[r][c] === 0 && this.candidates[r][c].has(num)) {
            possibleCells.push({ r, c });
          }
        }
        if (possibleCells.length === 1) {
          this.placeNumber(possibleCells[0].r, possibleCells[0].c, num);
          return true;
        }
      }
    }
    return false;
  }

  applyNakedPair(): boolean {
    let changed = false;

    // Check rows
    for (let r = 0; r < 9; r++) {
      const bivalues: { idx: number, cands: number[] }[] = [];
      for (let c = 0; c < 9; c++) {
        if (this.grid[r][c] === 0 && this.candidates[r][c].size === 2) {
          bivalues.push({ idx: c, cands: Array.from(this.candidates[r][c]).sort() });
        }
      }
      for (let i = 0; i < bivalues.length; i++) {
        for (let j = i + 1; j < bivalues.length; j++) {
          if (bivalues[i].cands[0] === bivalues[j].cands[0] && bivalues[i].cands[1] === bivalues[j].cands[1]) {
            const [cand1, cand2] = bivalues[i].cands;
            for (let c = 0; c < 9; c++) {
              if (c !== bivalues[i].idx && c !== bivalues[j].idx && this.grid[r][c] === 0) {
                if (this.candidates[r][c].has(cand1)) { this.candidates[r][c].delete(cand1); changed = true; }
                if (this.candidates[r][c].has(cand2)) { this.candidates[r][c].delete(cand2); changed = true; }
              }
            }
          }
        }
      }
    }

    // Check columns
    for (let c = 0; c < 9; c++) {
      const bivalues: { idx: number, cands: number[] }[] = [];
      for (let r = 0; r < 9; r++) {
        if (this.grid[r][c] === 0 && this.candidates[r][c].size === 2) {
          bivalues.push({ idx: r, cands: Array.from(this.candidates[r][c]).sort() });
        }
      }
      for (let i = 0; i < bivalues.length; i++) {
        for (let j = i + 1; j < bivalues.length; j++) {
          if (bivalues[i].cands[0] === bivalues[j].cands[0] && bivalues[i].cands[1] === bivalues[j].cands[1]) {
            const [cand1, cand2] = bivalues[i].cands;
            for (let r = 0; r < 9; r++) {
              if (r !== bivalues[i].idx && r !== bivalues[j].idx && this.grid[r][c] === 0) {
                if (this.candidates[r][c].has(cand1)) { this.candidates[r][c].delete(cand1); changed = true; }
                if (this.candidates[r][c].has(cand2)) { this.candidates[r][c].delete(cand2); changed = true; }
              }
            }
          }
        }
      }
    }

    // Check boxes
    for (let b = 0; b < 9; b++) {
      const startRow = Math.floor(b / 3) * 3;
      const startCol = (b % 3) * 3;
      const bivalues: { r: number, c: number, cands: number[] }[] = [];
      for (let i = 0; i < 9; i++) {
        const r = startRow + Math.floor(i / 3);
        const c = startCol + (i % 3);
        if (this.grid[r][c] === 0 && this.candidates[r][c].size === 2) {
          bivalues.push({ r, c, cands: Array.from(this.candidates[r][c]).sort() });
        }
      }
      for (let i = 0; i < bivalues.length; i++) {
        for (let j = i + 1; j < bivalues.length; j++) {
          if (bivalues[i].cands[0] === bivalues[j].cands[0] && bivalues[i].cands[1] === bivalues[j].cands[1]) {
            const [cand1, cand2] = bivalues[i].cands;
            for (let k = 0; k < 9; k++) {
              const r = startRow + Math.floor(k / 3);
              const c = startCol + (k % 3);
              if ((r !== bivalues[i].r || c !== bivalues[i].c) && (r !== bivalues[j].r || c !== bivalues[j].c) && this.grid[r][c] === 0) {
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
    for (let b = 0; b < 9; b++) {
      const startRow = Math.floor(b / 3) * 3;
      const startCol = (b % 3) * 3;
      for (let num = 1; num <= 9; num++) {
        const cells: Cell[] = [];
        for (let i = 0; i < 9; i++) {
          const r = startRow + Math.floor(i / 3);
          const c = startCol + (i % 3);
          if (this.grid[r][c] === 0 && this.candidates[r][c].has(num)) {
            cells.push({ r, c });
          }
        }
        if (cells.length === 2 || cells.length === 3) {
          const sameRow = cells.every(cell => cell.r === cells[0].r);
          const sameCol = cells.every(cell => cell.c === cells[0].c);

          if (sameRow) {
            const r = cells[0].r;
            for (let c = 0; c < 9; c++) {
              if (Math.floor(c / 3) !== Math.floor(startCol / 3)) {
                if (this.candidates[r][c].has(num)) {
                  this.candidates[r][c].delete(num);
                  changed = true;
                }
              }
            }
          } else if (sameCol) {
            const c = cells[0].c;
            for (let r = 0; r < 9; r++) {
              if (Math.floor(r / 3) !== Math.floor(startRow / 3)) {
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
      const rowPositions: number[][] = Array.from({ length: 9 }, () => []);
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (this.grid[r][c] === 0 && this.candidates[r][c].has(num)) {
            rowPositions[r].push(c);
          }
        }
      }

      for (let r1 = 0; r1 < 8; r1++) {
        if (rowPositions[r1].length === 2) {
          for (let r2 = r1 + 1; r2 < 9; r2++) {
            if (rowPositions[r2].length === 2 && rowPositions[r1][0] === rowPositions[r2][0] && rowPositions[r1][1] === rowPositions[r2][1]) {
              const c1 = rowPositions[r1][0];
              const c2 = rowPositions[r1][1];
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
    const bivalues: { r: number, c: number, cands: number[] }[] = [];

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.grid[r][c] === 0 && this.candidates[r][c].size === 2) {
          bivalues.push({ r, c, cands: Array.from(this.candidates[r][c]).sort() });
        }
      }
    }

    for (let i = 0; i < bivalues.length; i++) {
      const pivot = bivalues[i];
      const pincerCandidates: { r: number, c: number, cands: number[] }[] = [];

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
              const targetCand = cand1;
              // Any cell that sees BOTH pincers cannot have targetCand
              for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                  if (this.grid[r][c] === 0 && this.sees({ r, c }, pincer1) && this.sees({ r, c }, pincer2) && (r !== pivot.r || c !== pivot.c)) {
                    if (this.candidates[r][c].has(targetCand)) {
                      this.candidates[r][c].delete(targetCand);
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

    return changed;
  }

  applySwordfish(): boolean {
    let changed = false;
    for (let num = 1; num <= 9; num++) {
      // Row-based Swordfish: find 3 rows where candidate appears in at most 3 columns total
      const rowPositions: number[][] = Array.from({ length: 9 }, () => []);
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (this.grid[r][c] === 0 && this.candidates[r][c].has(num)) {
            rowPositions[r].push(c);
          }
        }
      }

      // Find triplets of rows that each have 2-3 positions, all fitting within exactly 3 columns
      for (let r1 = 0; r1 < 7; r1++) {
        if (rowPositions[r1].length < 2 || rowPositions[r1].length > 3) continue;
        for (let r2 = r1 + 1; r2 < 8; r2++) {
          if (rowPositions[r2].length < 2 || rowPositions[r2].length > 3) continue;
          for (let r3 = r2 + 1; r3 < 9; r3++) {
            if (rowPositions[r3].length < 2 || rowPositions[r3].length > 3) continue;

            // Collect all unique columns used across the 3 rows
            const colSet = new Set<number>([...rowPositions[r1], ...rowPositions[r2], ...rowPositions[r3]]);
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
      const colPositions: number[][] = Array.from({ length: 9 }, () => []);
      for (let c = 0; c < 9; c++) {
        for (let r = 0; r < 9; r++) {
          if (this.grid[r][c] === 0 && this.candidates[r][c].has(num)) {
            colPositions[c].push(r);
          }
        }
      }

      for (let c1 = 0; c1 < 7; c1++) {
        if (colPositions[c1].length < 2 || colPositions[c1].length > 3) continue;
        for (let c2 = c1 + 1; c2 < 8; c2++) {
          if (colPositions[c2].length < 2 || colPositions[c2].length > 3) continue;
          for (let c3 = c2 + 1; c3 < 9; c3++) {
            if (colPositions[c3].length < 2 || colPositions[c3].length > 3) continue;

            const rowSet = new Set<number>([...colPositions[c1], ...colPositions[c2], ...colPositions[c3]]);
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

    // Collect all bivalue cells (for pincers)
    const bivalues: { r: number, c: number, cands: number[] }[] = [];
    // Collect all trivalue cells (for pivots)
    const trivalues: { r: number, c: number, cands: number[] }[] = [];

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.grid[r][c] !== 0) continue;
        if (this.candidates[r][c].size === 2) {
          bivalues.push({ r, c, cands: Array.from(this.candidates[r][c]).sort() });
        } else if (this.candidates[r][c].size === 3) {
          trivalues.push({ r, c, cands: Array.from(this.candidates[r][c]).sort() });
        }
      }
    }

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
            for (let r = 0; r < 9; r++) {
              for (let c = 0; c < 9; c++) {
                if (this.grid[r][c] !== 0) continue;
                if (r === pivot.r && c === pivot.c) continue;
                if (r === p1.r && c === p1.c) continue;
                if (r === p2.r && c === p2.c) continue;

                if (this.sees({ r, c }, pivot) && this.sees({ r, c }, p1) && this.sees({ r, c }, p2)) {
                  if (this.candidates[r][c].has(zCand)) {
                    this.candidates[r][c].delete(zCand);
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
}

export function canHumanSolveExpert(grid: number[][]): boolean {
  const solver = new HumanSolver(grid);
  const result = solver.solve();
  return result.solved && result.requiresAdvanced;
}
