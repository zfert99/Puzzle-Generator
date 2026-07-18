/**
 * Cage-outline geometry — the shared, renderer-agnostic computation of a Killer puzzle's dashed
 * cage borders and sum-label positions. Both the PDF (`pdf.service.ts`) and the interactive board
 * consume this, so the (subtle) inner/outer corner logic lives in exactly one tested place.
 *
 * All coordinates are in CELL UNITS: a cell is 1×1, the grid spans `0..size`. Consumers scale —
 * the PDF multiplies by its pixel cell size; the board uses them directly in an SVG `viewBox`.
 *
 * See `cage-geometry.md` for the corner cases.
 */

import type { Cage } from './killer-types';

export interface CageLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface CageSum {
  /** Anchor cell column/row (the cage's lowest-indexed, top-left-most cell). */
  col: number;
  row: number;
  value: number;
}

export interface CageOutline {
  lines: CageLine[];
  sums: CageSum[];
}

/**
 * Compute the dashed cage outlines and sum labels for a set of cages on a `size`×`size` grid.
 *
 * Each cage-boundary edge becomes an inset line; every endpoint is resolved from the in-line
 * neighbour AND the diagonal cell into one of three cases so a cage's border is one continuous
 * shape with correct corners:
 *  - **convex** (in-line neighbour is a different cage) → inset the end;
 *  - **straight** (in-line neighbour same cage, diagonal outside → it continues this border) → run
 *    to the cell edge so segments connect;
 *  - **reflex / inner** corner (in-line neighbour same cage, diagonal *inside*) → run PAST the edge
 *    by `inset` so this line meets the perpendicular border turning the corner (closes L-shapes).
 */
export function computeCageOutline(cages: Cage[], size: number, inset = 0.09): CageOutline {
  const cellCage = new Array<number>(size * size).fill(-1);
  cages.forEach((cage, index) => {
    for (const cell of cage.cells) cellCage[cell] = index;
  });
  const cageAt = (r: number, c: number): number =>
    r < 0 || c < 0 || r >= size || c >= size ? -1 : cellCage[r * size + c];

  const lines: CageLine[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cg = cellCage[r * size + c];
      if (cg < 0) continue; // cell not in any cage (defensive; a valid partition covers all)
      const x = c;
      const y = r;
      const top = cageAt(r - 1, c) !== cg;
      const bottom = cageAt(r + 1, c) !== cg;
      const left = cageAt(r, c - 1) !== cg;
      const right = cageAt(r, c + 1) !== cg;

      if (top) {
        const x1 = left ? x + inset : cageAt(r - 1, c - 1) === cg ? x - inset : x;
        const x2 = right ? x + 1 - inset : cageAt(r - 1, c + 1) === cg ? x + 1 + inset : x + 1;
        lines.push({ x1, y1: y + inset, x2, y2: y + inset });
      }
      if (bottom) {
        const x1 = left ? x + inset : cageAt(r + 1, c - 1) === cg ? x - inset : x;
        const x2 = right ? x + 1 - inset : cageAt(r + 1, c + 1) === cg ? x + 1 + inset : x + 1;
        lines.push({ x1, y1: y + 1 - inset, x2, y2: y + 1 - inset });
      }
      if (left) {
        const y1 = top ? y + inset : cageAt(r - 1, c - 1) === cg ? y - inset : y;
        const y2 = bottom ? y + 1 - inset : cageAt(r + 1, c - 1) === cg ? y + 1 + inset : y + 1;
        lines.push({ x1: x + inset, y1, x2: x + inset, y2 });
      }
      if (right) {
        const y1 = top ? y + inset : cageAt(r - 1, c + 1) === cg ? y - inset : y;
        const y2 = bottom ? y + 1 - inset : cageAt(r + 1, c + 1) === cg ? y + 1 + inset : y + 1;
        lines.push({ x1: x + 1 - inset, y1, x2: x + 1 - inset, y2 });
      }
    }
  }

  const sums: CageSum[] = cages.map((cage) => {
    const anchor = Math.min(...cage.cells);
    return { col: anchor % size, row: Math.floor(anchor / size), value: cage.sum };
  });

  return { lines, sums };
}
