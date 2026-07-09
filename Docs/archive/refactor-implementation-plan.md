# Architectural Refactoring Implementation Plan

This plan outlines the steps required to execute the structural and architectural refactorings identified in the `Docs/architectural-analysis.md`. This refactor transitions the codebase from a type-based structure to a domain-driven, feature-based architecture utilizing a root `src/` directory.

## User Review Required

> [!WARNING]
> Moving to a `src/` directory requires updating import paths and TypeScript configurations. Please review the proposed `tsconfig.json` changes.
> [!CAUTION]
> Breaking up `PuzzleForm.tsx` and extracting the `usePuzzleGeneration` hook will temporarily disrupt the UI components while we stitch them back together.

## Open Questions

1. **Routing Changes:** Next.js handles the `src/app` directory automatically, but do you want to keep the benchmarking scripts (`scripts/benchmark-human-solver.ts`) at the root, or should I move them directly into `src/features/engine/benchmarks/`? (I have proposed moving them in this plan).
2. **Testing:** Should we move the `tests/` directory into `src/features/` as well, colocating `test-pdfkit.js` into `src/features/pdf-generation/`?

---

## Proposed Changes

### 1. Project Configuration & Directory Restructuring

We will create a `src/` directory and update the core configurations to resolve imports correctly.

#### [MODIFY] [tsconfig.json](file:///Users/morp/Documents/GitHub/Puzzle-Generator/tsconfig.json)

- Update `paths` from `"@/*": ["./*"]` to `"@/*": ["./src/*"]` to ensure alias imports resolve correctly within the new `src/` directory.

#### [NEW] `src/` Directory

- Create the `src/` folder.
- Move `app/` into `src/app/`.
- Move `components/` into `src/components/` (and then into features).
- Move `lib/` into `src/features/` (mapping to `engine/` and `pdf-generation/`).

---

### 2. Puzzle Engine Refactoring (`src/features/engine/`)

We will break apart the monolithic `sudoku.ts` facade and implement JSDoc comments.

#### [MODIFY] [sudoku.ts](file:///Users/morp/Documents/GitHub/Puzzle-Generator/lib/puzzle-engine/sudoku.ts) (Move to `src/features/engine/sudoku.ts`)

- Remove digging logic and basic grid utilities.
- Focus strictly on `generateSudoku` and orchestration.
- Add standard JSDoc `/** @param ... */` blocks.

#### [MODIFY] [human-solver.ts](file:///Users/morp/Documents/GitHub/Puzzle-Generator/lib/puzzle-engine/human-solver.ts) (Move to `src/features/engine/human-solver.ts`)

- Add standard JSDoc `/** @param ... */` blocks to the class and its main `solve` method.

#### [NEW] `src/features/engine/diggers.ts`

- Extract `applyQuotaDigger`, `applyExhaustiveDigger`, and `applyExtremeDigger`.

#### [NEW] `src/features/engine/grid-utils.ts`

- Extract `createEmptyGrid`, `copyGrid`, `isValid`, and `shuffle`.

#### [MODIFY] [scripts/benchmark-human-solver.ts](file:///Users/morp/Documents/GitHub/Puzzle-Generator/scripts/benchmark-human-solver.ts)

- Move to `src/features/engine/benchmarks/benchmark-human-solver.ts` and update internal paths.

---

### 3. API & PDF Generation Refactoring (`src/features/pdf-generation/`)

We will pull the generation loops out of the Next.js API route and split the PDF renderer into testable pure functions.

#### [MODIFY] [route.ts](file:///Users/morp/Documents/GitHub/Puzzle-Generator/app/api/generate/route.ts) (Move to `src/app/api/generate/route.ts`)

- Add `export const runtime = 'nodejs';` to prevent Edge deployment breakages.
- Strip out the synchronous generation loop and delegate it to a new service.

#### [NEW] `src/features/engine/services/generation.service.ts`

- Encapsulate the `while` loop that calls `generateSudoku` to generate the full batch of puzzles.

#### [MODIFY] [generator.ts](file:///Users/morp/Documents/GitHub/Puzzle-Generator/lib/pdf/generator.ts) (Move to `src/features/pdf-generation/services/pdf.service.ts`)

- Break the monolithic `generatePuzzlePDF` closure.
- Extract `drawGrid(doc, grid, x, y, size)`, `titlePage(doc)`, and `drawPuzzles(doc, groupedPuzzles)` into standalone, pure(ish) helper functions outside the Promise block.

---

### 4. UI Component Modularization (`src/features/puzzle-configuration/`)

We will dismantle the massive `PuzzleForm.tsx` file to satisfy the Single Responsibility Principle.

#### [MODIFY] [PuzzleForm.tsx](file:///Users/morp/Documents/GitHub/Puzzle-Generator/components/PuzzleForm.tsx) (Move to `src/features/puzzle-configuration/components/PuzzleForm.tsx`)

- Extract all API `fetch` calls, loading states, and Blob downloading logic into a custom hook.
- Extract the segmented control into a `<GridSizeSelector />` component.
- Extract the difficulty sliders into a `<DifficultyConfigurator />` component.

#### [NEW] `src/features/puzzle-configuration/hooks/usePuzzleGeneration.ts`

- A custom React hook managing `isLoading`, `error`, and `generate(config)` functions.

#### [NEW] `src/features/puzzle-configuration/components/GridSizeSelector.tsx`

- Dumb UI component for selecting 4x4, 6x6, or 9x9 grids.

#### [NEW] `src/features/puzzle-configuration/components/DifficultyConfigurator.tsx`

- Dumb UI component for rendering the 5 difficulty sliders with disabled states.

---

### 5. Modularize HumanSolver & Clean Code Refactoring (`src/features/engine/`)

Based on the architectural best practices research, we will address the massive 1,200+ line `human-solver.ts` file and strictly apply the "Clean Code" commenting philosophy by removing redundant syntax-restating comments. As per previous project preferences, we will **keep `HumanSolver` as a stateful class**, but use a compositional approach where standalone strategy functions operate on the `HumanSolver` instance.

#### [MODIFY] `src/features/engine/sudoku.ts` & `src/features/engine/human-solver.ts`

- Strip redundant "syntax" comments (e.g., `// Place the number in the grid`). Preserve JSDoc blocks, algorithm explanations, and the Markdown pseudocode file.

#### [NEW] `src/features/engine/strategies/basic.ts`

- Extract `applyNakedSingle`, `applyHiddenSingle`, `applyNakedPair`, `applyHiddenPair`, `applyPointingPairs`.

#### [NEW] `src/features/engine/strategies/advanced.ts`

- Extract `applyXWing`, `applySwordfish`, `applyYWing`, `applyXYZWing`.

#### [NEW] `src/features/engine/strategies/extreme.ts`

- Extract `applyWWing`, `applyALSXZ`, `applyAIC`.

#### [MODIFY] `src/features/engine/human-solver.ts`

- Remove the strategy implementations from the class body.
- Update the main `solve()` loop to import and invoke the extracted strategy functions, passing `this` (the solver instance) to them.
- Expose necessary helper methods as `public` so the external strategy modules can utilize them.

## Verification Plan

### Automated Tests

- `npm run lint` to ensure no import paths are broken after the `src/` migration.
- `npx jest` to ensure `route.test.ts` still passes and correctly validates API payloads.
- `npx tsx src/features/engine/benchmarks/benchmark-human-solver.ts` to ensure the puzzle engine retains its speed post-extraction.

### Manual Verification

- Run `npm run dev`.
- Load the webpage and verify that `PuzzleForm` successfully renders.
- Verify the Grid Size selector correctly fades out/disables Expert & Extreme sliders for 4x4 and 6x6 sizes.
- Generate a PDF book to ensure `pdfkit` successfully streams the buffer from the newly extracted drawing functions.
