# Phase 2: Mini Puzzles (4x4 & 6x6)

This plan outlines the architecture for parameterizing our puzzle generation pipeline to support smaller grids, as specified in the roadmap for Phase 2.

> [!WARNING]
> This refactor touches the most sensitive parts of the codebase (the backtracking generator and the `HumanSolver`). We must ensure we don't break the heavily-optimized 9x9 logic while generalizing the dimensions.

## Design Decisions (Resolved)

1. **Difficulty Availability:**
   - **4x4 Grids:** Restricted to `Easy`, `Medium`, and `Hard`. (Expert/Extreme are impossible/unnecessary).
   - **6x6 Grids:** Restricted to `Easy`, `Medium`, and `Hard`.
2. **Clue Quotas (Based on Research Guide):**
   - **4x4 (16 cells):**
     - Easy: 9 givens (removes 7)
     - Medium: 6 givens (removes 10)
     - Hard: 4 givens (removes 12) *Note: 4 is the mathematical minimum for a unique 4x4.*
   - **6x6 (36 cells):**
     - Easy: 20 givens (removes 16)
     - Medium: 16 givens (removes 20)
     - Hard: 10 givens (removes 26) *Note: 8 is the mathematical minimum, but 10 is standard for hard.*
3. **PDF Layout:**
   - As requested, 4x4 and 6x6 grids will be scaled up to fill the same 9x9 bounding box on the PDF to keep the layout consistent and readable.

## Proposed Changes

---

### Engine & Solver (`lib/puzzle-engine/`)

#### [MODIFY] [sudoku.ts](file:///Users/morp/Documents/GitHub/Puzzle-Generator/lib/puzzle-engine/sudoku.ts)

- Add a new `type GridSize = 4 | 6 | 9`.
- Refactor `createEmptyGrid`, `isValid`, `fillGrid`, and `countSolutions` to accept `size`, `boxWidth`, and `boxHeight`.
- For `applyQuotaDigger`, calculate the `cluesToRemove` dynamically based on the total cells (`size * size`) and the target clue quotas discussed above.

#### [MODIFY] [human-solver.ts](file:///Users/morp/Documents/GitHub/Puzzle-Generator/lib/puzzle-engine/human-solver.ts)

- Modify the constructor to infer `size` from the incoming grid's length.
- Calculate `boxWidth` and `boxHeight`:
  - Size 4: `2x2`
  - Size 6: `3 (width) x 2 (height)`
  - Size 9: `3x3`
- Replace all hardcoded `9`s with `this.size`, and `27` with `this.size * 3` (for houses).
- Update the initialization of candidates to be `1..size` instead of `1..9`.

#### [MODIFY] `sudoku.md` and `human-solver.md`

- Synchronize pseudocode to reflect the dynamic `SIZE`, `BOX_WIDTH`, and `BOX_HEIGHT` variables.

---

### API & Frontend (`app/` & `components/`)

#### [MODIFY] [route.ts](file:///Users/morp/Documents/GitHub/Puzzle-Generator/app/api/generate/route.ts)

- Update the request schema to accept an optional `gridSize` parameter.
- Pass `gridSize` down to the PDF generation function.

#### [MODIFY] [PuzzleForm.tsx](file:///Users/morp/Documents/GitHub/Puzzle-Generator/components/PuzzleForm.tsx)

- Add a UI toggle (Radio Group or segmented control) to select Grid Size: `4x4`, `6x6`, `9x9`.
- If `4x4` or `6x6` is selected, dynamically disable the `Expert` and `Extreme` difficulty sliders.

---

### PDF Renderer (`lib/pdf/`)

#### [MODIFY] [generator.ts](file:///Users/morp/Documents/GitHub/Puzzle-Generator/lib/pdf/generator.ts)

- Refactor `drawGrid` to accept `gridSize`, `boxWidth`, and `boxHeight`.
- Calculate `cellSize = gridWidth / gridSize`.
- Adjust the thick box borders to draw at `boxWidth` intervals for columns, and `boxHeight` intervals for rows.

#### [MODIFY] `generator.md`

- Update the pseudocode documentation to reflect the dynamic PDF drawing logic.

## Verification Plan

### Automated Tests

- Run `npm test` to ensure `route.test.ts` still passes for 9x9 puzzles.
- Run `npx tsx scripts/benchmark-human-solver.ts` to ensure the parameterization hasn't regressed 9x9 solver performance (it shouldn't, as the V8 engine is very good at optimizing dynamic array bounds if they remain constant per-run).

### Manual Verification

- Generate a 4x4 PDF and a 6x6 PDF via the frontend UI.
- Verify visually that the grid borders are drawn correctly (e.g. 6x6 has 3 boxes across and 2 boxes down).
- Verify that the puzzles are solvable and valid.
