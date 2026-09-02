import { HumanSolver } from '@/features/engine/human-solver';
import { listDeductions, type Deduction } from '@/features/engine/deductions';

/**
 * The one puzzle the MCP server serves when no grid is supplied. Generated once
 * with `generateSudoku('hard', 9, mulberry32(101))` and frozen here so the demo
 * does not drift when the generator changes. Row-major, `0` = empty.
 */
export const DEFAULT_PUZZLE =
  '067000090352400700800000000084000000200060005000003180000030504000801000016024000';

/** Sizes the tools accept, keyed by the length of a flat grid string. */
const SIZE_BY_LENGTH: Record<number, number> = { 16: 4, 36: 6, 81: 9 };

/**
 * Parses a flat digit string into a grid. Length picks the size (16 → 4×4,
 * 36 → 6×6, 81 → 9×9); any digit above the size, or any other character, is
 * rejected so a malformed state fails loudly instead of solving as nonsense.
 */
export function parseGrid(flat: string): number[][] {
  const size = SIZE_BY_LENGTH[flat.length];
  if (!size) throw new Error(`Grid string must be 16, 36 or 81 digits, got ${flat.length}`);
  const grid: number[][] = [];
  for (let r = 0; r < size; r++) {
    const row: number[] = [];
    for (let c = 0; c < size; c++) {
      const ch = flat[r * size + c];
      const digit = ch === '.' ? 0 : Number(ch);
      if (!Number.isInteger(digit) || digit < 0 || digit > size) {
        throw new Error(`Bad character '${ch}' at row ${r + 1}, col ${c + 1}`);
      }
      row.push(digit);
    }
    grid.push(row);
  }
  return grid;
}

/** Flattens a grid back to the string form the tools accept. */
export function gridToString(grid: number[][]): string {
  return grid.flat().join('');
}

/** 1-indexed cell label in the notation solvers use, e.g. `r3c7`. */
export function cellLabel(r: number, c: number): string {
  return `r${r + 1}c${c + 1}`;
}

/**
 * Renders the grid for a model to read. Rows are 1-indexed and boxes are
 * separated so the model can see house boundaries; candidates for every empty
 * cell follow, because a hint about a technique is meaningless without them.
 */
export function describeGridState(solver: HumanSolver): string {
  const lines: string[] = [];
  const { size, boxWidth, boxHeight } = solver;
  lines.push(`${size}x${size} grid, ${solver.totalCells - countFilled(solver)} empty cells. '.' = empty.`);
  for (let r = 0; r < size; r++) {
    if (r > 0 && r % boxHeight === 0) lines.push('  ' + '-'.repeat(size * 2 + Math.floor(size / boxWidth) - 1));
    const cells: string[] = [];
    for (let c = 0; c < size; c++) {
      if (c > 0 && c % boxWidth === 0) cells.push('|');
      cells.push(solver.grid[r][c] === 0 ? '.' : String(solver.grid[r][c]));
    }
    lines.push(`${r + 1} ${cells.join(' ')}`);
  }
  lines.push('');
  lines.push('Candidates (cell: digits still possible):');
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (solver.grid[r][c] !== 0) continue;
      lines.push(`${cellLabel(r, c)}: ${solver.candidateList(r, c).join('')}`);
    }
  }
  return lines.join('\n');
}

/** Deduction in the 1-indexed shape returned to clients. */
export interface DeductionReport {
  strategy: string;
  tier: Deduction['tier'];
  placements: { cell: string; digit: number }[];
  eliminations: { cell: string; digit: number }[];
  house?: string;
}

/** Converts engine deductions (0-indexed) to the client-facing report shape. */
export function reportDeductions(deductions: Deduction[]): DeductionReport[] {
  return deductions.map(d => ({
    strategy: d.strategy,
    tier: d.tier,
    placements: d.placements.map(p => ({ cell: cellLabel(p.r, p.c), digit: p.digit })),
    eliminations: d.eliminations.map(e => ({ cell: cellLabel(e.r, e.c), digit: e.digit })),
    ...(d.house ? { house: d.house } : {}),
  }));
}

/** Names and descriptions shared by every transport, so the model always sees one tool contract. */
export const HINT_TOOL_DEFINITIONS = {
  get_grid_state: {
    title: 'Get grid state',
    description:
      'Returns the current Sudoku grid (rows 1-indexed, "." for empty) and the remaining candidates for every empty cell.',
  },
  list_available_deductions: {
    title: 'List available deductions',
    description:
      'Returns every logical deduction available in the current grid state, each labelled with the strategy that justifies it (Naked Single, Hidden Single, Naked Pair, X-Wing, ...). Placements give a cell and the digit that must go there; eliminations give a cell and a digit that cannot go there. An empty list means no known technique applies.',
  },
} as const;

export type HintToolName = keyof typeof HINT_TOOL_DEFINITIONS;

/**
 * The two tool bodies, independent of transport. The MCP server exposes them
 * over stdio; the eval harness can call them in-process against the same
 * solver, so what the agent sees and what the grader sees are one code path.
 */
export function createHintTools(solver: HumanSolver) {
  return {
    getGridState: () => describeGridState(solver),
    listAvailableDeductions: () => reportDeductions(listDeductions(solver)),
  };
}

function countFilled(solver: HumanSolver): number {
  let filled = 0;
  for (const row of solver.grid) for (const v of row) if (v !== 0) filled++;
  return filled;
}
