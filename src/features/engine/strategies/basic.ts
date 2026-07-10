import type { HumanSolver } from '../human-solver';

/**
 * Naked Single:
 * The simplest strategy. If an empty cell has had all but ONE of its candidates eliminated,
 * then that remaining candidate MUST be the answer for that cell.
 */
export function applyNakedSingle(solver: HumanSolver): boolean {
  const singles = solver.getCellsWithNCandidates(1);
  if (singles.length > 0) {
    const { r, c, cands } = singles[0];
    solver.placeNumber(r, c, cands[0]);
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
export function applyHiddenSingle(solver: HumanSolver): boolean {
  // Delegates to the solver's single-pass, allocation-free implementation. This
  // is the hottest strategy in the deduction loop; see
  // HumanSolver.findAndPlaceHiddenSingle for why it is not implemented as the
  // naive per-(digit, axis) grid scan.
  return solver.findAndPlaceHiddenSingle();
}

/**
 * Naked Pair:
 * If two cells in the same row/col/box have EXACTLY the same two candidates (e.g., both are [2, 5]),
 * then those two numbers must be split between those two cells. No other cell in that row/col/box
 * can be a 2 or a 5. We can eliminate 2 and 5 from all other cells in that zone.
 */
export function applyNakedPair(solver: HumanSolver): boolean {
  let changed = false;
  const bivalues = solver.getCellsWithNCandidates(2);

  for (let i = 0; i < bivalues.length; i++) {
    for (let j = i + 1; j < bivalues.length; j++) {
      const b1 = bivalues[i];
      const b2 = bivalues[j];

      if (b1.cands[0] === b2.cands[0] && b1.cands[1] === b2.cands[1]) {
        const [cand1, cand2] = b1.cands;

        if (b1.r === b2.r) {
          for (let c = 0; c < solver.size; c++) {
            if (c !== b1.c && c !== b2.c && solver.grid[b1.r][c] === 0) {
              if (solver.removeCandidate(b1.r, c, cand1)) changed = true;
              if (solver.removeCandidate(b1.r, c, cand2)) changed = true;
            }
          }
        }

        if (b1.c === b2.c) {
          for (let r = 0; r < solver.size; r++) {
            if (r !== b1.r && r !== b2.r && solver.grid[r][b1.c] === 0) {
              if (solver.removeCandidate(r, b1.c, cand1)) changed = true;
              if (solver.removeCandidate(r, b1.c, cand2)) changed = true;
            }
          }
        }

        if (solver.inSameBox(b1, b2)) {
          const boxesPerRow = solver.size / solver.boxWidth;
          const b1Box = Math.floor(b1.r / solver.boxHeight) * boxesPerRow + Math.floor(b1.c / solver.boxWidth);
          for (const { r, c } of solver.getBoxCells(b1Box)) {
            if ((r !== b1.r || c !== b1.c) && (r !== b2.r || c !== b2.c) && solver.grid[r][c] === 0) {
              if (solver.removeCandidate(r, c, cand1)) changed = true;
              if (solver.removeCandidate(r, c, cand2)) changed = true;
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
export function applyHiddenPair(solver: HumanSolver): boolean {
  let changed = false;

  for (const axis of ['row', 'col', 'box'] as const) {
    const positionsByNum: { r: number, c: number }[][][] = [];
    for (let num = 1; num <= solver.size; num++) {
      positionsByNum[num] = solver.getCandidatePositions(num, axis);
    }

    for (let i = 0; i < solver.size; i++) {
      const candidatesWithTwoSpots = [];
      for (let num = 1; num <= solver.size; num++) {
        const cells = positionsByNum[num][i];
        if (cells.length === 2) {
          candidatesWithTwoSpots.push({ num, cells });
        }
      }

      if (candidatesWithTwoSpots.length >= 2) {
        for (let a = 0; a < candidatesWithTwoSpots.length; a++) {
          for (let b = a + 1; b < candidatesWithTwoSpots.length; b++) {
            const candA = candidatesWithTwoSpots[a];
            const candB = candidatesWithTwoSpots[b];

            if (
              candA.cells[0].r === candB.cells[0].r && candA.cells[0].c === candB.cells[0].c &&
              candA.cells[1].r === candB.cells[1].r && candA.cells[1].c === candB.cells[1].c
            ) {
              for (const cell of candA.cells) {
                if (solver.candidateCount(cell.r, cell.c) > 2) {
                  for (const c of solver.candidateList(cell.r, cell.c)) {
                    if (c !== candA.num && c !== candB.num) {
                      solver.removeCandidate(cell.r, cell.c, c);
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
export function applyPointingPairs(solver: HumanSolver): boolean {
  let changed = false;
  for (let num = 1; num <= solver.size; num++) {
    const boxPositions = solver.getCandidatePositions(num, 'box');

    for (let b = 0; b < solver.numBoxes; b++) {
      const cells = boxPositions[b];
      if (cells.length === 2 || cells.length === 3) {
        const sameRow = cells.every(cell => cell.r === cells[0].r);
        const sameCol = cells.every(cell => cell.c === cells[0].c);

        if (sameRow) {
          const r = cells[0].r;
          const boxesPerRow = solver.size / solver.boxWidth;
          for (let c = 0; c < solver.size; c++) {
            if (Math.floor(c / solver.boxWidth) !== b % boxesPerRow) {
              if (solver.removeCandidate(r, c, num)) {
                changed = true;
              }
            }
          }
        } else if (sameCol) {
          const c = cells[0].c;
          const boxesPerRow = solver.size / solver.boxWidth;
          for (let r = 0; r < solver.size; r++) {
            if (Math.floor(r / solver.boxHeight) !== Math.floor(b / boxesPerRow)) {
              if (solver.removeCandidate(r, c, num)) {
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
