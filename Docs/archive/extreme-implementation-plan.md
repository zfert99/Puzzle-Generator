# Phase 1 — Extreme Difficulty 💀🔥

Add a new `extreme` difficulty tier to the Sudoku generator. This extends the `HumanSolver` with three elite strategies (W-Wing, Almost Locked Sets, Alternating Inference Chains), adds a new digger function, and wires the new difficulty through the entire pipeline (API → UI → PDF).

---

## Proposed Changes

### 🧮 Puzzle Engine — HumanSolver

#### [MODIFY] [human-solver.ts](file:///c:/Users/user/Documents/BiscuittArcade/Puzzle-Generator/lib/puzzle-engine/human-solver.ts)

Add three new strategy methods and integrate them into the solve loop:

**1. `applyWWing(): boolean`** (Medium complexity)

- Scan all rows, columns, and boxes for **conjugate pairs** (a candidate that appears in exactly 2 cells in a house → strong link).
- Find all **bivalue cells** (cells with exactly 2 candidates).
- For each pair of bivalue cells with identical candidate sets `{A, B}` that do NOT see each other:
  - Check if a conjugate pair on candidate `A` **bridges** them — i.e., one endpoint of the strong link sees bivalue cell 1, the other endpoint sees bivalue cell 2.
  - If so, at least one bivalue cell must resolve to `B`. Eliminate `B` from any cell that sees **both** bivalue cells.
- Runs **before** ALS and AIC (cheapest of the three).

**2. `applyALSXZ(): boolean`** (High complexity)

- **ALS enumeration**: For each house (row/col/box), enumerate all subsets of empty cells where `|candidates| = |cells| + 1`. This is an ALS (Almost Locked Set).
  - Prune aggressively: skip subsets that don't satisfy the N+1 constraint immediately.
  - Cache ALS groups per house to avoid re-enumeration within a single solve pass.
- **ALS-XZ rule**: For each pair of ALS groups (A and B):
  - Identify the **Restricted Common Candidate (RCC)** `x` — a candidate common to both sets where all cells containing `x` in A see all cells containing `x` in B.
  - Identify any **unrestricted common candidate** `z` (common to both sets, but NOT restricted).
  - Eliminate `z` from any cell that sees ALL `z`-locations in both A and B.
- Start with ALS-XZ (2 sets). Full ALS Chains (3+ threaded sets) deferred to a follow-up.

> [!IMPORTANT]
> **Combinatorial explosion mitigation**: A 9-cell house has 511 subsets. We ONLY check subsets where `|union of candidates| = |cells| + 1`. Additionally, we skip subsets larger than 5 cells. This keeps the per-house cost manageable.

**3. `applyAIC(): boolean`** (Very High complexity)

- **Build inference graph**: Create a graph where each node is a `(cell, candidate)` pair. Edges are:
  - **Strong link**: The candidate appears in exactly 2 cells in a house → conjugate pair.
  - **Weak link**: Two candidates in the same cell, or two cells in the same house with the same candidate.
- **BFS chain search**: From each node, search for chains with strictly alternating strong→weak→strong→… links.
  - **Type 1 (weak-weak endpoints)**: Eliminate the candidate at both endpoints.
  - **Type 2 (strong-strong endpoints)**: Eliminate the candidate from any cell seeing both endpoints.
- **Max chain depth: 12 nodes** (configurable).
- Grouped AICs deferred to a follow-up.

**Solve loop changes**:

- Add a new `usedExtreme: boolean` flag (mirrors `usedAdvanced`).
- After all existing advanced strategies fail, try in order: W-Wing → ALS-XZ → AIC.
- If any extreme strategy succeeds, set `usedExtreme = true` and restart the loop.
- Update `solve()` return type to include `requiresExtreme`.

**New export**:

- `canHumanSolveExtreme(grid: number[][]): boolean` — returns `true` if `solved && usedExtreme`.

---

### 🧮 Puzzle Engine — Generator

#### [MODIFY] [sudoku.ts](file:///c:/Users/user/Documents/BiscuittArcade/Puzzle-Generator/lib/puzzle-engine/sudoku.ts)

- Add `'extreme'` to the `Difficulty` type union.
- Add `canHumanSolveExtreme` import from `human-solver.ts`.
- Add new `applyExtremeDigger(grid: number[][]): void` function.
- Update `generateSudoku()` to route `'extreme'` to `applyExtremeDigger`.

---

### 🎨 Frontend — UI

#### [MODIFY] [PuzzleForm.tsx](file:///c:/Users/user/Documents/BiscuittArcade/Puzzle-Generator/components/PuzzleForm.tsx)

- Add `extreme: 0` to the initial `counts` state.
- Add `'extreme'` to the difficulty mapping array.
- Custom label for extreme: `"Extreme 💀🔥"`.
- Red warning message when `counts.extreme > 0`.

---

### 🗄️ API Route

#### [MODIFY] [route.ts](file:///c:/Users/user/Documents/BiscuittArcade/Puzzle-Generator/app/api/generate/route.ts)

- Add `extreme = 0` to the destructured body params.
- Add `extreme` to all validation checks.
- Add the extreme puzzle generation loop after expert.

---

### 📄 PDF Generator

#### [MODIFY] [generator.ts](file:///c:/Users/user/Documents/BiscuittArcade/Puzzle-Generator/lib/pdf/generator.ts)

- Add `extreme: []` to the `grouped` record.
- Add `'extreme'` to the difficulty iteration array.

---

### 📝 Documentation — Update all `.md` counterparts

---

## Verification Plan

### Automated Tests

- `npx jest` — all existing tests pass (zero regressions).
- New test: generate 1 extreme puzzle, verify 200 (120s timeout).

### Benchmarks

- Update benchmark script with extreme tier.
- Target: < 10 seconds average per extreme puzzle.

### Manual Verification

- Generate PDF with 1 extreme puzzle, inspect rendering.
- Verify PDF outline includes "Extreme" section.
- Verify UI warning appears when extreme count > 0.
