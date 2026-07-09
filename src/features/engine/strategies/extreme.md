# Extreme Strategies: Plain English Pseudocode

This document is a pseudocode companion to [`extreme.ts`](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/features/engine/strategies/extreme.ts).

---

## 1. applyWWing(solver) → boolean

Two identical bivalue cells (both containing candidates {A, B}) that DON'T see each other are connected by a "strong link" (conjugate pair) on candidate A in some house. A conjugate pair means the candidate appears in exactly 2 cells in that house — if one is false, the other MUST be true. The structure looks like: `BV1 {A,B} ---sees-→ [Strong Link on A: cell1 ↔ cell2] ←---sees--- BV2 {A,B}`. Because the strong link guarantees A is "true" in at least one endpoint, at least one bivalue cell is forced away from A and must resolve to B. Therefore, any cell that sees BOTH bivalue cells can safely eliminate B.

```text
bivalues = solver.getCellsWithNCandidates(2)

// 1. Pre-index conjugate pairs (shared helper)
conjugatesByNum = solver.getConjugatePairs()

// 2. Search bivalue pairs
FOR each pair (bv1, bv2) of bivalues:
    IF bv1.cands != bv2.cands → SKIP                 // must be identical
    IF solver.sees(bv1, bv2) → SKIP                           // would be a Naked Pair

    [candA, candB] = bv1.cands

    FOR each linkCand in [candA, candB]:
        elimCand = the OTHER candidate

        FOR each conjugate pair [cp1, cp2] in conjugatesByNum[linkCand]:
            // Check if the conjugate pair "bridges" the two bivalues:
            //   cp1 sees bv1 AND cp2 sees bv2  (or vice versa)
            IF neither bridge orientation works → SKIP
            IF cp1 or cp2 IS one of the bivalue cells → SKIP

            // At least one bivalue cell must be elimCand
            solver.eliminateFromCellsSeeingAll([bv1, bv2], elimCand, [bv1, bv2])
            IF eliminated anything → RETURN true

RETURN false
```

## 2. applyALSXZ(solver) → boolean

An Almost Locked Set (ALS) is a group of N cells within a single house containing exactly N+1 candidates. If two ALS groups share a "Restricted Common Candidate" (RCC) x — meaning ALL cells containing x in Set A see ALL cells containing x in Set B — then x is "locked" between them: it can't be true in both sets simultaneously. This locks the remaining candidates in both sets, allowing any OTHER common candidate z to be eliminated from cells that see all z-locations in BOTH sets. This is one of the most powerful elimination techniques in human Sudoku solving.

```text
// 1. Enumerate all ALS groups
allALS = solver.enumerateALS()

// 2. Check every pair of ALS groups
FOR each pair (alsA, alsB):
    IF they share any cells → SKIP

    commonCands = intersection of alsA.candidates and alsB.candidates
    IF commonCands.length < 2 → SKIP   // need RCC + elimination candidate

    // 3. Find Restricted Common Candidates (RCCs)
    // excludeCells is the same for all candidates in this pair — hoist here
    excludeCells = alsA.cells + alsB.cells

    FOR each x in commonCands:
        xInA = cells in alsA containing x
        xInB = cells in alsB containing x
        IF NOT every cell in xInA sees every cell in xInB → SKIP  // not restricted

        // x is a valid RCC → check other common candidates for elimination
        FOR each z in commonCands where z != x:
            zInA = cells in alsA containing z
            zInB = cells in alsB containing z
            allZLocations = zInA + zInB

            // Eliminate z from cells seeing ALL z-locations (excluding ALS cells)
            IF solver.eliminateFromCellsSeeingAll(allZLocations, z, excludeCells):
                RETURN true

RETURN false
```

## 3. applyAIC(solver) → boolean

Alternating Inference Chains are the most general elimination technique in human Sudoku solving. An AIC is a chain of (cell, candidate) nodes connected by strictly alternating strong and weak links. A **strong link** means the candidate appears in exactly 2 cells in a house (a conjugate pair) — if one is false, the other MUST be true. A **weak link** connects two candidates in the same cell, or two cells in the same house with the same candidate — if one is true, the other MUST be false.

The method builds a full inference graph of all candidates, then searches for chains using BFS with strict alternation. Two chain types yield eliminations:

- **Type 2** (strong→...→strong): At least one endpoint is true. If both endpoints have the same candidate, eliminate it from cells seeing both endpoints.
- **Type 1** (weak→...→weak): Both endpoints must be false. If both endpoints are the same candidate in cells that see each other, eliminate from both.

Max chain depth is capped at 12 nodes to prevent unbounded search.

```text
MAX_CHAIN_DEPTH = 12

// ---- BUILD THE INFERENCE GRAPH ----

Each node = "r,c,num" (a specific candidate in a specific cell)

Collect active nodes AND Weak links Type A (same cell, different candidates):
    FOR each empty cell:
        FOR each candidate in that cell:
            push node to active graph
        FOR each pair of candidates in that cell:
            add bidirectional weak link

Strong links + Weak links Type B from single scan:
    housePositions = solver.buildHousePositions()   // one scan for both link types
    FOR num = 1..9:
        FOR h = 0..26:
            cells = housePositions[(num-1)*27 + h]
            IF cells.length == 2:
                add bidirectional strong link (conjugate pair)
            ELSE IF cells.length > 2:
                add bidirectional weak link between all pairs
    Note: All strong links are ALSO added as weak links.

// ---- BFS FOR ALTERNATING CHAINS ----

FOR each startNode in the graph:
    parse startNode into {r, c, num}
    FOR each startLinkType in [strong, weak]:
        Initialize BFS queue from startNode

        WHILE queue is not empty:
            pop { node, lastLink, depth, path }
            IF depth > MAX_CHAIN_DEPTH → SKIP

            IF depth >= 4:
                parse end node into {r, c, num}

                // TYPE 2 CHAIN: strong → ... → strong
                // At least one endpoint is true
                IF startLinkType=='strong' AND lastLink=='strong':
                    IF both endpoints have the same candidate:
                        eliminate that candidate from cells seeing BOTH endpoints
                        IF eliminated → RETURN true

                // TYPE 1 CHAIN: weak → ... → weak
                // Both endpoints must be false
                ELSE IF startLinkType=='weak' AND lastLink=='weak':
                    IF same cell, same candidate (Continuous Nice Loop):
                        self-contradiction → delete the candidate → RETURN true
                    IF same candidate AND endpoints see each other:
                        delete from BOTH endpoints → RETURN true

            // Extend chain with the OPPOSITE link type (strict alternation)
            nextLinkType = opposite of lastLink
            FOR each neighbor via nextLinkType:
                IF not already in path (except start for cycle detection):
                    add to queue with depth+1

RETURN false
```
