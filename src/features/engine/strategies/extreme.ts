import type { HumanSolver, Cell } from '../human-solver';

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
          if ((cp2.r === bv1.r && cp1.c === bv1.c) || (cp2.r === bv2.r && cp2.c === bv2.c)) continue;

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

  for (let i = 0; i < allALS.length; i++) {
    for (let j = i + 1; j < allALS.length; j++) {
      const alsA = allALS[i];
      const alsB = allALS[j];

      if (alsA.cells.some((a: Cell) => alsB.cells.some((b: Cell) => a.r === b.r && a.c === b.c))) continue;

      const commonCands: number[] = [];
      for (const cand of alsA.candidates) {
        if (alsB.candidates.has(cand)) commonCands.push(cand);
      }
      if (commonCands.length < 2) continue;

      const excludeCells = [...alsA.cells, ...alsB.cells];

      for (const x of commonCands) {
        const xInA = alsA.cells.filter((c: Cell) => solver.candidates[c.r][c.c].has(x));
        const xInB = alsB.cells.filter((c: Cell) => solver.candidates[c.r][c.c].has(x));

        if (xInA.length === 0 || xInB.length === 0) continue;

        const isRestricted = xInA.every((a: Cell) => xInB.every((b: Cell) => solver.sees(a, b)));
        if (!isRestricted) continue;

        for (const z of commonCands) {
          if (z === x) continue;

          const zInA = alsA.cells.filter((c: Cell) => solver.candidates[c.r][c.c].has(z));
          const zInB = alsB.cells.filter((c: Cell) => solver.candidates[c.r][c.c].has(z));

          if (zInA.length === 0 || zInB.length === 0) continue;

          const allZLocations = [...zInA, ...zInB];

          if (solver.eliminateFromCellsSeeingAll(allZLocations, z, excludeCells)) {
            return true;
          }
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

  const strongLinks = new Map<string, string[]>();
  const weakLinks = new Map<string, string[]>();

  const nodeKey = (r: number, c: number, num: number) => `${r},${c},${num}`;
  const parseKey = (key: string): { r: number; c: number; num: number } => {
    const [r, c, num] = key.split(',').map(Number);
    return { r, c, num };
  };

  const addLink = (map: Map<string, string[]>, from: string, to: string) => {
    if (!map.has(from)) map.set(from, []);
    map.get(from)!.push(to);
  };

  const allNodes: string[] = [];
  for (let r = 0; r < solver.size; r++) {
    for (let c = 0; c < solver.size; c++) {
      if (solver.grid[r][c] !== 0) continue;
      const cands = Array.from(solver.candidates[r][c]);

      for (const num of cands) {
        allNodes.push(nodeKey(r, c, num));
      }

      for (let a = 0; a < cands.length; a++) {
        for (let b = a + 1; b < cands.length; b++) {
          const keyA = nodeKey(r, c, cands[a]);
          const keyB = nodeKey(r, c, cands[b]);
          addLink(weakLinks, keyA, keyB);
          addLink(weakLinks, keyB, keyA);
        }
      }
    }
  }

  const housePositions = solver.buildHousePositions();

  for (let num = 1; num <= solver.size; num++) {
    const base = (num - 1) * solver.numHouses;
    for (let h = 0; h < solver.numHouses; h++) {
      const cells = housePositions[base + h];
      if (cells.length === 2) {
        const keyA = nodeKey(cells[0].r, cells[0].c, num);
        const keyB = nodeKey(cells[1].r, cells[1].c, num);
        addLink(strongLinks, keyA, keyB);
        addLink(strongLinks, keyB, keyA);
      } else if (cells.length > 2) {
        for (let a = 0; a < cells.length; a++) {
          for (let b = a + 1; b < cells.length; b++) {
            const keyA = nodeKey(cells[a].r, cells[a].c, num);
            const keyB = nodeKey(cells[b].r, cells[b].c, num);
            addLink(weakLinks, keyA, keyB);
            addLink(weakLinks, keyB, keyA);
          }
        }
      }
    }
  }

  for (const [from, tos] of strongLinks) {
    for (const to of tos) {
      addLink(weakLinks, from, to);
    }
  }

  for (const startNode of allNodes) {
    const startParsed = parseKey(startNode);
    const startCell = { r: startParsed.r, c: startParsed.c };

    for (const startLinkType of ['strong', 'weak'] as const) {
      const queue: { node: string; lastLink: 'strong' | 'weak'; depth: number; path: string[] }[] = [];
      const visited = new Set<string>();

      const firstLinks = startLinkType === 'strong'
        ? (strongLinks.get(startNode) || [])
        : (weakLinks.get(startNode) || []);

      for (const next of firstLinks) {
        if (next === startNode) continue;
        const stateKey = `${next}:${startLinkType}`;
        if (!visited.has(stateKey)) {
          visited.add(stateKey);
          queue.push({ node: next, lastLink: startLinkType, depth: 2, path: [startNode, next] });
        }
      }

      while (queue.length > 0) {
        const { node, lastLink, depth, path } = queue.shift()!;

        if (depth > MAX_CHAIN_DEPTH) continue;

        if (depth >= 4) {
          const endParsed = parseKey(node);
          const endCell = { r: endParsed.r, c: endParsed.c };

          if (startLinkType === 'strong' && lastLink === 'strong') {
            if (startParsed.num === endParsed.num) {
              const endpoints = [startCell, endCell];
              const elim = solver.eliminateFromCellsSeeingAll(endpoints, startParsed.num, endpoints);
              if (elim) return true;
            }
          } else if (startLinkType === 'weak' && lastLink === 'weak') {
            if (startParsed.num === endParsed.num &&
                startCell.r === endCell.r && startCell.c === endCell.c) {
              if (solver.candidates[startCell.r][startCell.c].has(startParsed.num)) {
                solver.candidates[startCell.r][startCell.c].delete(startParsed.num);
                return true;
              }
            }

            if (startParsed.num === endParsed.num && solver.sees(startCell, endCell)) {
              let elim = false;
              if (solver.candidates[startCell.r][startCell.c].has(startParsed.num)) {
                solver.candidates[startCell.r][startCell.c].delete(startParsed.num);
                elim = true;
              }
              if (solver.candidates[endCell.r][endCell.c].has(endParsed.num)) {
                solver.candidates[endCell.r][endCell.c].delete(endParsed.num);
                elim = true;
              }
              if (elim) return true;
            }
          }
        }

        const nextLinkType: 'strong' | 'weak' = lastLink === 'strong' ? 'weak' : 'strong';
        const nextLinks = nextLinkType === 'strong'
          ? (strongLinks.get(node) || [])
          : (weakLinks.get(node) || []);

        for (const next of nextLinks) {
          if (path.includes(next) && next !== startNode) continue;

          const stateKey = `${next}:${nextLinkType}`;
          if (!visited.has(stateKey)) {
            visited.add(stateKey);
            queue.push({ node: next, lastLink: nextLinkType, depth: depth + 1, path: [...path, next] });
          }
        }
      }
    }
  }

  return false;
}
