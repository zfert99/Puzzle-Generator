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
            IF cp1 or cp2 IS one of the bivalue cells → SKIP   // compare row AND column of the same cell

            // At least one bivalue cell must be elimCand
            solver.eliminateFromCellsSeeingAll([bv1, bv2], elimCand, [bv1, bv2])
            IF eliminated anything → RETURN true

RETURN false
```

**The endpoint-exclusion check (fixed October 2026).** The "cp2 is a bivalue cell" test compared
`cp2`'s row with `cp1`'s column — a typo that could both skip valid bridges and, worse, *keep* a
"bridge" whose conjugate cell is `bv1` itself. That degenerate case proves nothing about `bv2`, so
eliminating B from their common peers was not justified. Both halves now compare the same cell.

## 2. applyALSXZ(solver) → boolean

An Almost Locked Set (ALS) is a group of N cells within a single house containing exactly N+1 candidates. If two ALS groups share a "Restricted Common Candidate" (RCC) x — meaning ALL cells containing x in Set A see ALL cells containing x in Set B — then x is "locked" between them: it can't be true in both sets simultaneously. This locks the remaining candidates in both sets, allowing any OTHER common candidate z to be eliminated from cells that see all z-locations in BOTH sets. This is one of the most powerful elimination techniques in human Sudoku solving.

**Performance:** this is the single most expensive strategy in the engine — it runs an O(numALS²) pairwise scan every time the cheaper strategies stall (measured at ~234 ALS per call → ~55k pairs). Four things keep it in check, and none of them change *which* eliminations are found (solver strength is byte-for-byte identical — verified against a frozen fingerprint of `{solved, requiresExtreme}` over a fixed pool):

1. `enumerateALS` carries each ALS's candidate set as a **bitmask**, so the pair loop's first test is a one-instruction reject — `popcount(alsA.mask & alsB.mask) < 2` — discarding most pairs before any real work.
2. **Per-ALS `digit → cells` maps are precomputed once.** The old code re-filtered an ALS's cells (`cells.filter(has digit)`) for every one of its ~234 partners; now each ALS's cells-per-digit are looked up.
3. **Eliminations scan only relevant cells.** Instead of walking all size×size cells and testing `hasCandidate(z)`, a grid-wide `digit → empty cells` list is precomputed once, so the z-elimination iterates only the ~10–25 cells that actually hold z.
4. **ALS-cell exclusion is allocation-free**, via a tagged `Int32Array` marker per pair rather than building/clearing a Set.

Together these took the extreme tier from ~18.7 ms to ~10 ms/solve on a frozen pool (−46%), with an identical solve fingerprint.

**Bitsets and a de-duplicated ALS list (October 2026).** Two more, again without changing which
elimination is found first. (5) `enumerateALS` emitted the same cell set once per house it lay in —
every bivalue cell three times, a pair inside one box-row twice — so the O(n²) pair loop was
inflated by duplicates that could only repeat work; it now keeps the first occurrence of each cell
set, and because any pair of duplicates has an equal-or-earlier pair of originals in the (i, j)
order, the first elimination is unchanged. (6) Cell sets are **3 × 32-bit words**: each ALS's
cells, each ALS's cells per digit, and every cell's peers (built once per call from the box
geometry). "Do these two ALS overlap", "does every x-cell of A see every x-cell of B" and "does
this cell see every z-cell of A ∪ B and lie outside both" are each a few ANDs, where they were an
O(|A|·|B|) nested `some`, an O(|xA|·|xB|) `sees()` loop and a tagged-marker scan. The pair order,
the digit order and the row-major elimination scan are unchanged; 40 seeded expert/extreme
puzzles solve to the same grids and flags, Killer's 40 grade identically, and `extreme.test.ts`
pins eight solves. Measured on the seeded `benchmark-human-solver.ts` Extreme row — see the
pre-merge log entry.

```text
// 1. Enumerate all ALS groups (each carries a candidate bitmask)
allALS = solver.enumerateALS()

// Precompute ONCE:
//   cellsByDigit[als][digit]      → that ALS's cells containing the digit
//   emptyCellsByDigit[digit]      → all empty grid cells containing the digit
//   excludedMark (Int32Array)     → per-pair allocation-free exclusion tags

// 2. Check every pair of ALS groups
FOR each pair (alsA, alsB):
    commonMask = alsA.mask AND alsB.mask          // bitwise
    IF popcount(commonMask) < 2 → SKIP            // cheap O(1) reject, need RCC + elim candidate
    IF they share any cells → SKIP

    commonCands = the digits set in commonMask
    tag alsA.cells and alsB.cells in excludedMark for this pair

    FOR each x in commonCands:
        xInA / xInB = cellsByDigit lookups (no re-filtering)
        IF NOT every cell in xInA sees every cell in xInB → SKIP  // not a restricted RCC

        FOR each z in commonCands where z != x:
            zInA / zInB = cellsByDigit lookups
            // scan only emptyCellsByDigit[z], skip tagged ALS cells
            FOR each candidate cell that sees ALL of zInA and ALL of zInB:
                remove z from it
            IF any removed → RETURN true

RETURN false
```

## 3. applyAIC(solver) → boolean

Alternating Inference Chains are the most general elimination technique in human Sudoku solving. An AIC is a chain of (cell, candidate) nodes connected by strictly alternating strong and weak links. A **strong link** means the candidate appears in exactly 2 cells in a house (a conjugate pair) — if one is false, the other MUST be true. A **weak link** connects two candidates in the same cell, or two cells in the same house with the same candidate — if one is true, the other MUST be false.

The method builds a full inference graph of all candidates, then searches for chains using BFS with strict alternation. Two chain types yield eliminations:

- **Type 2** (strong→...→strong): At least one endpoint is true. If both endpoints have the same candidate, eliminate it from cells seeing both endpoints.
- **Discontinuous loop** (weak→...→weak back to the start node): assuming the start true forces it false, so it is false — delete it.

**A deleted branch, and why it was wrong (October 2026).** A weak→...→weak chain between two
*different* cells holding the same digit used to delete that digit from **both** endpoints when
the cells saw each other. That is unsound: such a chain only proves the two endpoints are not both
true — which their shared house already says. Counterexample: r1c1 = {5,7}, 7 conjugate between
r1c1 and r1c9; the chain (r1c1,5)–(r1c1,7)=(r1c9,7)–(r1c9,5) would have deleted the 5 from both
cells, although one of them must hold it. It never fired only because the BFS `visited` set marks
the end node as reached on the very first (direct, weak) step, so the chain could never arrive at
it again — an accident of the search, not a guarantee. The branch was removed outright rather than
"fixed"; `extreme.test.ts` pins the counterexample.

Max chain depth is capped at 12 nodes to prevent unbounded search.

**Numeric graph (October 2026).** The search is the same; its data structures are not. Nodes
were `"r,c,num"` strings: every dequeue parsed one (`split` + `map(Number)`), every neighbour
list was a `Map` lookup, every enqueue copied the whole `path` array and every candidate neighbour
ran `path.includes`, and the queue was `shift()` (O(n) per dequeue). Profiled at 23 % of Killer
extreme generation, plus its closures. A node is now the integer `(r·size + c)·size + (num − 1)`;
adjacency is one array per node, filled in **exactly the order the Map version inserted** (same
cell pairs, then house pairs digit by digit, then every strong link appended to the weak lists in
first-insertion order); the queue is an index over typed arrays with a **parent pointer** per
entry, so "is this node already on the path?" walks ≤ 12 ancestors instead of copying; and
`visited` is a stamped `Int32Array` over (node, link-type) states. Because insertion order,
dequeue order and the visited rule are unchanged, the BFS finds the *same first elimination*: 40
seeded expert/extreme puzzles solved to the same grids and flags before and after, and Killer's
40 graded identically through it. `extreme.test.ts` pins eight of those solves.

```text
MAX_CHAIN_DEPTH = 12

// ---- BUILD THE INFERENCE GRAPH ----

Each node = (r·size + c)·size + (num − 1)   (an integer id for a candidate in a cell;
                                             it used to be the string "r,c,num")

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

                // weak → ... → weak back to the start node
                ELSE IF startLinkType=='weak' AND lastLink=='weak':
                    IF same cell, same candidate (Discontinuous Nice Loop):
                        self-contradiction → delete the candidate → RETURN true

            // Extend chain with the OPPOSITE link type (strict alternation)
            nextLinkType = opposite of lastLink
            FOR each neighbor via nextLinkType:
                IF not already in path (except start for cycle detection):
                    add to queue with depth+1

RETURN false
```
