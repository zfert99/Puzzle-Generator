// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { computePeers, toggleBit, hasBit, maskToDigits } from './board-utils';
import { getGridConfig } from '@/features/engine/sudoku';

describe('computePeers', () => {
  it('gives every 9x9 cell exactly 20 peers', () => {
    const peers = computePeers(getGridConfig(9));
    expect(peers).toHaveLength(81);
    expect(peers.every(p => p.length === 20)).toBe(true);
  });

  it('includes row, column, and box peers but never the cell itself', () => {
    const peers = computePeers(getGridConfig(9));
    const cell = 0; // r0,c0
    expect(peers[cell]).not.toContain(0);
    expect(peers[cell]).toContain(1);   // same row (r0,c1)
    expect(peers[cell]).toContain(9);   // same column (r1,c0)
    expect(peers[cell]).toContain(10);  // same box (r1,c1)
    expect(peers[cell]).toContain(4);   // r0,c4 — same row -> peer
    expect(peers[cell]).not.toContain(13); // r1,c4 — different row, col, and box -> not a peer
  });

  it('scales to mini grids (4x4 -> 7 peers each)', () => {
    const peers = computePeers(getGridConfig(4));
    expect(peers).toHaveLength(16);
    // 3 row + 3 col - overlap + box (2x2): 4x4 cell has 3+3+1 unique = 7 peers
    expect(peers.every(p => p.length === 7)).toBe(true);
  });
});

describe('bitmask helpers', () => {
  it('toggles and tests candidate bits', () => {
    let mask = 0;
    mask = toggleBit(mask, 3);
    mask = toggleBit(mask, 7);
    expect(hasBit(mask, 3)).toBe(true);
    expect(hasBit(mask, 7)).toBe(true);
    expect(hasBit(mask, 5)).toBe(false);
    mask = toggleBit(mask, 3); // toggle off
    expect(hasBit(mask, 3)).toBe(false);
  });

  it('expands a mask to ascending digits', () => {
    const mask = (1 << 0) | (1 << 4) | (1 << 8); // digits 1,5,9
    expect(maskToDigits(mask)).toEqual([1, 5, 9]);
    expect(maskToDigits(0)).toEqual([]);
  });
});
