# Impossible Difficulty: Implementation Plan

> [!NOTE]
> This is a **future plan** — not yet approved for implementation. It documents the design for adding a new "Impossible" difficulty tier that requires extreme logical strategies to solve.

---

## Overview

Add a new `impossible` difficulty level to the Sudoku generator that produces puzzles requiring **W-Wing**, **Almost Locked Sets (ALS)**, and **Alternating Inference Chains (AICs)** to solve. These are the most computationally expensive human strategies and sit well beyond our current Expert tier.

The "Impossible" label is tongue-in-cheek — the puzzles ARE solvable by a human, but only by the most elite solvers who understand deep Boolean inference and graph-theoretic chain logic.

---

## New Strategies Required

### 1. W-Wing
**Research Reference:** Expert Sudoku Strategies Document, Section "W-Wing"

**What it does:** Two identical bivalue cells (both containing candidates A, B) that don't see each other are connected by a strong link (conjugate pair) on candidate A elsewhere on the grid. This guarantees at least one of the bivalue cells must resolve to B. Any cell that sees BOTH bivalue cells can eliminate B.

**Implementation Complexity:** Medium
- Requires scanning for conjugate pairs across all houses
- Must cross-reference with matching bivalue cells that are bridged by the conjugate pair
- Research notes W-Wings should be processed BEFORE broader chain strategies for efficiency

### 2. Almost Locked Sets (ALS-XZ)
**Research Reference:** Expert Sudoku Strategies Document, Section "Almost Locked Sets"

**What it does:** An ALS is N cells in a single unit containing exactly N+1 candidates. Two ALS groups sharing a Restricted Common Candidate (RCC) create a weak link. If they also share an unrestricted common candidate Z, then Z must be true in one of the two sets. Any cell seeing all Z locations across both sets can eliminate Z.

**Implementation Complexity:** High
- Must enumerate all possible ALS groups (subsets of cells within each house)
- For each pair of ALS groups, must identify RCCs and unrestricted commons
- Combinatorial explosion: a 9-cell house has 2^9 - 1 = 511 possible subsets to check
- Optimization: only check subsets where |candidates| = |cells| + 1

### 3. Alternating Inference Chains (AICs)
**Research Reference:** Expert Sudoku Strategies Document, Section "Graph Traversal via AICs"

**What it does:** Chains of cells connected by strictly alternating strong and weak links. The two endpoints of the chain constrain each other:
- **Type 1 (Weak-to-Weak):** Both endpoints must be false → eliminate the candidate at both ends
- **Type 2 (Strong-to-Strong):** At least one endpoint must be true → eliminate the candidate from any cell that sees both ends

**Implementation Complexity:** Very High
- Requires building a full inference graph with strong/weak link edges
- Must implement BFS/DFS pathfinding with strict alternation constraints
- Chain length is unbounded — need a max-depth cutoff to prevent infinite search
- Grouped AICs (treating cell clusters as single nodes) would further expand the graph

---

## Proposed Changes

### Difficulty System

#### [MODIFY] [sudoku.ts](file:///c:/Users/user/Documents/BiscuittArcade/Puzzle-Generator/lib/puzzle-engine/sudoku.ts)
- Add `'impossible'` to the `Difficulty` type union
- Add a new `applyImpossibleDigger` function that works like `applyExhaustiveDigger` but validates against a solver that includes W-Wing, ALS, and AIC strategies
- The impossible digger should try to dig MORE aggressively than expert (targeting 20-22 clues remaining)

### Human Solver

#### [MODIFY] [human-solver.ts](file:///c:/Users/user/Documents/BiscuittArcade/Puzzle-Generator/lib/puzzle-engine/human-solver.ts)
- Add `applyWWing()` method
- Add `applyALSXZ()` method
- Add `applyAIC()` method with configurable max chain length (recommend: 12 nodes)
- Add a new `usedImpossible` flag to track whether these extreme strategies were needed
- Update `solve()` loop to include these strategies after existing advanced ones
- Create new export: `canHumanSolveImpossible(grid)` that checks `solved && usedImpossible`

### UI

#### [MODIFY] [PuzzleForm.tsx](file:///c:/Users/user/Documents/BiscuittArcade/Puzzle-Generator/components/PuzzleForm.tsx)
- Add `impossible` to the difficulty selector with a count defaulting to `0`
- Add a red warning message: "Impossible puzzles require extreme logical strategies (W-Wing, ALS, AICs) and may take up to 60 seconds to generate."
- Consider adding a skull/fire emoji to the label for personality 💀🔥

### API Route

#### [MODIFY] [route.ts](file:///c:/Users/user/Documents/BiscuittArcade/Puzzle-Generator/app/api/generate/route.ts)
- Add `impossible` to the destructured body params
- Add validation for the new field
- Include `impossible` in the total puzzle count check

### Documentation
- Create `human-solver.md` entries for W-Wing, ALS-XZ, and AIC
- Update `sudoku.md` with impossible digger docs
- Update `PuzzleForm.md` with new UI elements

---

## Performance Concerns

> [!WARNING]
> AIC pathfinding is the primary bottleneck. Without careful depth limits, a single AIC search across a dense candidate graph could take seconds. The max chain length MUST be capped (12-16 nodes recommended). ALS enumeration also has combinatorial cost — subset generation should be pruned aggressively.

**Estimated generation time per Impossible puzzle:** 2-10 seconds (vs ~26ms for Expert)

---

## Verification Plan

### Automated Tests
- `npx jest` — all existing tests must continue to pass
- Add a new test: generate 1 impossible puzzle, verify it returns 200
- Add a timeout of 120 seconds for the impossible test

### Benchmark
- `npx tsx scripts/benchmark.ts` — update to include an impossible tier
- Target: < 10 seconds average per puzzle

---

## Design Decisions

1. **Grouped AICs:** Yes — implement full Grouped AICs. Treating cell clusters as single logical nodes dramatically expands solving power and is necessary for the hardest possible puzzles.
2. **Full ALS Chains:** Yes — implement full ALS Chains (3+ sets), not just ALS-XZ. This allows the solver to thread multiple Almost Locked Sets together for extreme multi-digit eliminations.
3. **PDF Section Header:** Yes — Impossible puzzles get their own section header in the PDF outline, alongside Easy/Medium/Hard/Expert. Update the `generator.ts` grouped record and outline logic to include `impossible`.
