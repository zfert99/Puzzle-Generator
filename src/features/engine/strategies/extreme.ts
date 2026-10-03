import type { HumanSolver, Cell } from '../human-solver';
import { popcount } from '../grid-utils';

/**
 * W-Wing:
 * Two identical bivalue cells (both containing candidates {A, B}) that DON'T see each other
 * are connected by a "strong link" (conjugate pair) on candidate A in some house.
 * This means at least one of the bivalue cells must resolve to B.
 * Any cell that sees BOTH bivalue cells can therefore eliminate B.
 */
export function applyWWing(solver: HumanSolver): boolean {
  const bivalues = solver.getCellsWithNCandidates(2);
  const conjugatesByNum = solver.getConjugatePairs();

  for (let i = 0; i < bivalues.length; i++) {
    for (let j = i + 1; j < bivalues.length; j++) {
      const bv1 = bivalues[i];
      const bv2 = bivalues[j];

      if (bv1.cands[0] !== bv2.cands[0] || bv1.cands[1] !== bv2.cands[1]) continue;
      if (solver.sees(bv1, bv2)) continue;

      const [candA, candB] = bv1.cands;

      for (const linkCand of [candA, candB]) {
        const elimCand = linkCand === candA ? candB : candA;

        for (const [cp1, cp2] of conjugatesByNum.get(linkCand)!) {
          if (!(solver.sees(cp1, bv1) && solver.sees(cp2, bv2)) &&
              !(solver.sees(cp1, bv2) && solver.sees(cp2, bv1))) continue;

          if ((cp1.r === bv1.r && cp1.c === bv1.c) || (cp1.r === bv2.r && cp1.c === bv2.c)) continue;
          if ((cp2.r === bv1.r && cp2.c === bv1.c) || (cp2.r === bv2.r && cp2.c === bv2.c)) continue;

          if (solver.eliminateFromCellsSeeingAll([bv1, bv2], elimCand, [bv1, bv2])) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * ALS-XZ (Almost Locked Sets — Doubly Linked):
 * An ALS is a group of N cells within a single house containing exactly N+1 candidates.
 * If two ALS groups share a "Restricted Common Candidate" (RCC) x — meaning all cells
 * containing x in set A see all cells containing x in set B — then x is "locked" between them.
 * Any OTHER common candidate z can be eliminated from cells that see all z-locations in BOTH sets.
 */
export function applyALSXZ(solver: HumanSolver): boolean {
  const allALS = solver.enumerateALS();
  const size = solver.size;

  // Precompute, per ALS, which of its cells hold each candidate digit. Done once so
  // an ALS's cells are not re-filtered for every one of its ~N partner ALS — that
  // repeated filtering was the bulk of the old per-call cost.
  const cellsByDigit: Map<number, Cell[]>[] = allALS.map((als) => {
    const map = new Map<number, Cell[]>();
    for (const cell of als.cells) {
      let m = solver.candidates[cell.r][cell.c];
      while (m !== 0) {
        const lowestBit = m & -m;
        const digit = 31 - Math.clz32(lowestBit) + 1;
        const list = map.get(digit);
        if (list) list.push(cell);
        else map.set(digit, [cell]);
        m &= m - 1;
      }
    }
    return map;
  });

  // Precompute grid-wide: the empty cells holding each candidate digit, in row-major
  // order, so an elimination scans only cells that actually contain the digit rather
  // than all size×size cells.
  const emptyCellsByDigit: Cell[][] = Array.from({ length: size + 1 }, () => []);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (solver.grid[r][c] !== 0) continue;
      let m = solver.candidates[r][c];
      while (m !== 0) {
        const lowestBit = m & -m;
        const digit = 31 - Math.clz32(lowestBit) + 1;
        emptyCellsByDigit[digit].push({ r, c });
        m &= m - 1;
      }
    }
  }

  // Allocation-free ALS-cell exclusion: tag the current pair's ALS cells with a
  // monotonically increasing marker rather than building a Set (and clearing it)
  // per pair.
  const excludedMark = new Int32Array(size * size);
  let pairTag = 0;

  for (let i = 0; i < allALS.length; i++) {
    const alsA = allALS[i];
    const byA = cellsByDigit[i];
    for (let j = i + 1; j < allALS.length; j++) {
      const alsB = allALS[j];

      // Cheap O(1) reject: ALS-XZ requires at least two shared candidates.
      const commonMask = alsA.mask & alsB.mask;
      if (popcount(commonMask) < 2) continue;

      // Skip overlapping ALS (sharing a cell).
      if (alsA.cells.some((a: Cell) => alsB.cells.some((b: Cell) => a.r === b.r && a.c === b.c))) continue;

      const byB = cellsByDigit[j];

      // Expand the shared candidate bitmask into the actual digit list.
      const commonCands: number[] = [];
      let m = commonMask;
      while (m !== 0) {
        const lowestBit = m & -m;
        commonCands.push(31 - Math.clz32(lowestBit) + 1);
        m &= m - 1;
      }

      // Mark this pair's ALS cells as excluded elimination targets.
      pairTag++;
      for (const cell of alsA.cells) excludedMark[cell.r * size + cell.c] = pairTag;
      for (const cell of alsB.cells) excludedMark[cell.r * size + cell.c] = pairTag;

      for (const x of commonCands) {
        const xInA = byA.get(x) ?? [];
        const xInB = byB.get(x) ?? [];
        if (xInA.length === 0 || xInB.length === 0) continue;

        // Restricted Common Candidate: every x-cell in A sees every x-cell in B.
        let restricted = true;
        for (const a of xInA) {
          for (const b of xInB) {
            if (!solver.sees(a, b)) { restricted = false; break; }
          }
          if (!restricted) break;
        }
        if (!restricted) continue;

        for (const z of commonCands) {
          if (z === x) continue;
          const zInA = byA.get(z) ?? [];
          const zInB = byB.get(z) ?? [];
          if (zInA.length === 0 || zInB.length === 0) continue;

          // Eliminate z from every cell that sees all z-locations in BOTH ALS,
          // excluding the ALS cells themselves.
          let changed = false;
          for (const cell of emptyCellsByDigit[z]) {
            if (excludedMark[cell.r * size + cell.c] === pairTag) continue;

            let seesAll = true;
            for (const t of zInA) { if (!solver.sees(cell, t)) { seesAll = false; break; } }
            if (seesAll) {
              for (const t of zInB) { if (!solver.sees(cell, t)) { seesAll = false; break; } }
            }
            if (seesAll) {
              solver.removeCandidate(cell.r, cell.c, z);
              changed = true;
            }
          }
          if (changed) return true;
        }
      }
    }
  }

  return false;
}

/**
 * Alternating Inference Chains (AICs):
 * Chains of (cell, candidate) nodes connected by strictly alternating strong and weak links.
 */
export function applyAIC(solver: HumanSolver): boolean {
  const MAX_CHAIN_DEPTH = 12;
  const size = solver.size;
  const nodeCount = size * size * size;

  // Numeric node ids — `(r * size + c) * size + (num - 1)` — in place of "r,c,num" strings
  // (October 2026). The string form cost a `split`/`map(Number)` parse on every dequeue, a Map
  // lookup per neighbour list, a full `path` array copy per enqueue plus `path.includes` per
  // candidate neighbour, and `queue.shift()` (O(n)) per dequeue; profiled at 23 % of Killer
  // extreme generation, with the chain's own closures on top. Adjacency is per-node arrays built
  // in EXACTLY the order the string version inserted them, the queue is an index over typed
  // arrays with parent pointers (ancestry walked instead of copied), and visited is a stamped
  // Int32Array — so the BFS visits the same states in the same order and finds the same first
  // elimination. The 40-puzzle before/after capture is identical.
  const strongAdj: number[][] = new Array(nodeCount);
  const weakAdj: number[][] = new Array(nodeCount);
  for (let i = 0; i < nodeCount; i++) {
    strongAdj[i] = [];
    weakAdj[i] = [];
  }
  /** Strong-link sources in first-insertion order (the Map's iteration order in the old form). */
  const strongOrder: number[] = [];
  const addStrong = (from: number, to: number) => {
    if (strongAdj[from].length === 0) strongOrder.push(from);
    strongAdj[from].push(to);
  };

  const allNodes: number[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (solver.grid[r][c] !== 0) continue;
      const cands = solver.candidateList(r, c);
      const cellBase = (r * size + c) * size;
      for (const num of cands) allNodes.push(cellBase + num - 1);
      for (let a = 0; a < cands.length; a++) {
        for (let b = a + 1; b < cands.length; b++) {
          const idA = cellBase + cands[a] - 1;
          const idB = cellBase + cands[b] - 1;
          weakAdj[idA].push(idB);
          weakAdj[idB].push(idA);
        }
      }
    }
  }

  const housePositions = solver.buildHousePositions();
  for (let num = 1; num <= size; num++) {
    const base = (num - 1) * solver.numHouses;
    for (let h = 0; h < solver.numHouses; h++) {
      const cells = housePositions[base + h];
      if (cells.length === 2) {
        const idA = (cells[0].r * size + cells[0].c) * size + num - 1;
        const idB = (cells[1].r * size + cells[1].c) * size + num - 1;
        addStrong(idA, idB);
        addStrong(idB, idA);
      } else if (cells.length > 2) {
        for (let a = 0; a < cells.length; a++) {
          for (let b = a + 1; b < cells.length; b++) {
            const idA = (cells[a].r * size + cells[a].c) * size + num - 1;
            const idB = (cells[b].r * size + cells[b].c) * size + num - 1;
            weakAdj[idA].push(idB);
            weakAdj[idB].push(idA);
          }
        }
      }
    }
  }
  // Every strong link is also a weak link, appended after the weak ones (the old Map order).
  for (const from of strongOrder) {
    for (const to of strongAdj[from]) weakAdj[from].push(to);
  }

  // BFS state: one slot per (node, lastLink) pair, at most 2 × nodeCount entries per search.
  const capacity = nodeCount * 2 + 1;
  const qNode = new Int32Array(capacity);
  const qLink = new Uint8Array(capacity); // 0 = weak, 1 = strong
  const qDepth = new Int32Array(capacity);
  const qParent = new Int32Array(capacity);
  const visited = new Int32Array(capacity);
  let stamp = 0;

  /** Is `candidate` already on the path leading to queue entry `at`? (The old `path.includes`.) */
  const onPath = (at: number, candidate: number): boolean => {
    for (let i = at; i !== -1; i = qParent[i]) if (qNode[i] === candidate) return true;
    return false;
  };

  for (const startNode of allNodes) {
    const startNum = (startNode % size) + 1;
    const startCellIndex = (startNode - (startNum - 1)) / size;
    const startCell = { r: Math.floor(startCellIndex / size), c: startCellIndex % size };

    for (let startLink = 1; startLink >= 0; startLink--) {
      // 1 = strong first, then 0 = weak — the old ['strong', 'weak'] order.
      stamp++;
      let head = 0;
      let tail = 0;

      const firstLinks = startLink === 1 ? strongAdj[startNode] : weakAdj[startNode];
      for (const next of firstLinks) {
        if (next === startNode) continue;
        const state = next * 2 + startLink;
        if (visited[state] !== stamp) {
          visited[state] = stamp;
          qNode[tail] = next;
          qLink[tail] = startLink;
          qDepth[tail] = 2;
          qParent[tail] = -1; // the start node is implicit: it is exempt from the path check anyway
          tail++;
        }
      }

      while (head < tail) {
        const at = head++;
        const node = qNode[at];
        const lastLink = qLink[at];
        const depth = qDepth[at];

        if (depth > MAX_CHAIN_DEPTH) continue;

        if (depth >= 4) {
          const endNum = (node % size) + 1;
          const endCellIndex = (node - (endNum - 1)) / size;
          const endCell = { r: Math.floor(endCellIndex / size), c: endCellIndex % size };

          if (startLink === 1 && lastLink === 1) {
            if (startNum === endNum) {
              const endpoints = [startCell, endCell];
              if (solver.eliminateFromCellsSeeingAll(endpoints, startNum, endpoints)) return true;
            }
          } else if (startLink === 0 && lastLink === 0) {
            // Discontinuous loop back to the start node: assuming it true forces it false, so it
            // is false. (A weak-ended chain between two DIFFERENT same-digit cells only proves
            // they are not both true — no elimination; see extreme.md.)
            if (node === startNode) {
              if (solver.removeCandidate(startCell.r, startCell.c, startNum)) return true;
            }
          }
        }

        const nextLink = lastLink === 1 ? 0 : 1;
        const nextLinks = nextLink === 1 ? strongAdj[node] : weakAdj[node];
        for (const next of nextLinks) {
          if (next !== startNode && onPath(at, next)) continue;
          const state = next * 2 + nextLink;
          if (visited[state] !== stamp) {
            visited[state] = stamp;
            qNode[tail] = next;
            qLink[tail] = nextLink;
            qDepth[tail] = depth + 1;
            qParent[tail] = at;
            tail++;
          }
        }
      }
    }
  }

  return false;
}
