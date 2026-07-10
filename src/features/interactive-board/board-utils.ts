import type { GridConfig } from '@/features/engine/sudoku';

/**
 * Precomputes, for every cell index (`row * size + col`), the flat indices of its
 * peers — the cells sharing its row, column, or box (excluding itself). Building
 * this once at game start turns pencil-mark auto-stripping into an O(1) lookup
 * instead of recomputing peer unions on every placement (research §4.3).
 */
export function computePeers(config: GridConfig): number[][] {
  const { size, boxWidth, boxHeight } = config;
  const peers: number[][] = [];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const set = new Set<number>();

      for (let cc = 0; cc < size; cc++) if (cc !== c) set.add(r * size + cc);
      for (let rr = 0; rr < size; rr++) if (rr !== r) set.add(rr * size + c);

      const boxR = Math.floor(r / boxHeight) * boxHeight;
      const boxC = Math.floor(c / boxWidth) * boxWidth;
      for (let dr = 0; dr < boxHeight; dr++) {
        for (let dc = 0; dc < boxWidth; dc++) {
          const pr = boxR + dr;
          const pc = boxC + dc;
          if (pr !== r || pc !== c) set.add(pr * size + pc);
        }
      }

      peers[r * size + c] = [...set];
    }
  }

  return peers;
}

/** Pencil marks are stored as a bitmask per cell: bit (digit-1) set = candidate present. */
export function toggleBit(mask: number, digit: number): number {
  return mask ^ (1 << (digit - 1));
}

export function hasBit(mask: number, digit: number): boolean {
  return (mask & (1 << (digit - 1))) !== 0;
}

/** Ascending array of the digits set in a candidate bitmask. */
export function maskToDigits(mask: number): number[] {
  const digits: number[] = [];
  let m = mask;
  while (m !== 0) {
    const lowestBit = m & -m;
    digits.push(31 - Math.clz32(lowestBit) + 1);
    m &= m - 1;
  }
  return digits;
}
