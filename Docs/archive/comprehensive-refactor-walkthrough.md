<!-- markdownlint-disable MD013 -->

# Comprehensive Refactoring Walkthrough: Architecture & Enterprise Standards

This document is a thorough, file-by-file walkthrough of the two major architectural refactors applied to the Puzzle Generator codebase. It covers every new file, every extracted module, every configuration change, and the enterprise best practices that motivated each decision. It is intended to serve as both a historical record and a reference guide for future contributors.

**Reference Documents:**

- [Refactor Implementation Plan](file:///Users/morp/Documents/GitHub/Puzzle-Generator/Docs/archive/refactor-implementation-plan.md) — The original blueprint for the domain-driven restructuring.
- [Refactor Walkthrough](file:///Users/morp/Documents/GitHub/Puzzle-Generator/Docs/archive/refactor-walkthrough.md) — Summary of the first refactor's results.
- [Enterprise Implementation Plan](file:///Users/morp/Documents/GitHub/Puzzle-Generator/Docs/archive/enterprise-implementation-plan.md) — The blueprint for testing, telemetry, and benchmarking improvements.
- [Enterprise Walkthrough](file:///Users/morp/Documents/GitHub/Puzzle-Generator/Docs/archive/enterprise-walkthrough.md) — Summary of the enterprise refactor's results.
- [Enterprise Architecture Research](file:///Users/morp/Documents/GitHub/Puzzle-Generator/Docs/research/enterprise-architecture.md) — The research paper that informed the enterprise decisions.
- [Web Security Research](file:///Users/morp/Documents/GitHub/Puzzle-Generator/Docs/research/web-security-mitigation.md) — The security research that informed our new AGENTS.md rules.

---

## Part 1: The Domain-Driven Architecture Refactor

### 1.1 The Problem

Before the refactor, the codebase had a flat, type-based directory structure. All puzzle logic lived in a single `lib/puzzle-engine/` folder. The `human-solver.ts` file alone was over 1,200 lines, containing the core constraint-satisfaction engine, every solving strategy from Naked Singles to Alternating Inference Chains, and all the helper methods they relied on. This is the classic **"God Object" anti-pattern** — a single class that knows too much and does too much.

The consequences were concrete:

- **Navigability:** A developer looking for the X-Wing algorithm had to scroll through 1,200 lines of unrelated code to find it.
- **Testability:** It was impossible to unit-test a single strategy in isolation because everything was entangled inside one class.
- **Change Risk:** Modifying the AIC chain-building code risked accidentally breaking the Naked Single logic because they shared the same file scope and class body.

### 1.2 The Best Practice: Feature-Sliced Architecture

The guiding principle was **Domain-Driven Design (DDD)** combined with the **Single Responsibility Principle (SRP)**: group files by the business domain they serve, not by their technical type. A class should have exactly one reason to change.

Our architecture research explicitly warned against AI-generated monoliths:

> *"AI tools often violate the principle of colocation by conflating routing mechanisms with business logic, creating monolithic files that obscure security boundaries."* — [Security Research](file:///Users/morp/Documents/GitHub/Puzzle-Generator/Docs/research/web-security-mitigation.md)

### 1.3 The `src/` Migration

**What changed:** All application code was moved under a new root `src/` directory. The TypeScript path alias was updated in `tsconfig.json` from `"@/*": ["./*"]` to `"@/*": ["./src/*"]`.

**Why:** This creates a clear boundary between application source code and project configuration files (`package.json`, `jest.config.js`, etc.). It also aligns with Next.js conventions where `src/app/` is automatically recognized as the App Router root.

### 1.4 Engine Decomposition — Breaking Apart the Monolith

The old `lib/puzzle-engine/sudoku.ts` was a 500+ line file that handled grid creation, validation, backtracking, clue-digging, and puzzle generation. We split it into four focused modules:

---

#### [sudoku.ts](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/features/engine/sudoku.ts) — The Orchestrator

**Role:** Exports the public `generateSudoku()` function and domain types (`GridConfig`, `GridSize`, `Difficulty`, `SudokuPuzzle`). It delegates all actual work to the specialized modules below.

**Why this matters:** Any external consumer (the API route, the benchmark script, tests) only needs to import from `sudoku.ts`. The internal decomposition is hidden behind this clean facade. If we later rewrite the digger algorithm, no external code changes.

---

#### [grid-utils.ts](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/features/engine/grid-utils.ts) — Pure Utility Functions

**Role:** Contains stateless, reusable grid operations: `createEmptyGrid`, `copyGrid`, `isValid`, `shuffle`, and `fillGrid`.

**Key code — the Fisher-Yates shuffle:**

```typescript
// From grid-utils.ts — ensures every generated puzzle is unique
export function shuffle(array: number[]): number[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
```

**Why extract it:** These functions are used by both the generator (`fillGrid`) and the diggers (`countSolutions`). Extracting them eliminates code duplication and makes each function independently testable.

---

#### [diggers.ts](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/features/engine/diggers.ts) — Clue Removal Algorithms

**Role:** Contains three clue-removal strategies that transform a fully solved grid into a playable puzzle:

1. **`applyQuotaDigger`** — Removes a fixed number of clues based on a difficulty-specific quota table. Uses brute-force `countSolutions` to verify uniqueness. Used for Easy, Medium, and Hard puzzles.
2. **`applyExhaustiveDigger`** — Removes as many clues as possible while verifying the `HumanSolver` can still solve it logically. Used for Expert puzzles.
3. **`applyExtremeDigger`** — Same as exhaustive, but validates the puzzle actually *requires* extreme strategies. Retries with fresh grids up to 50 times if the result is only expert-level.

**Key code — the Expert digger's logic:**

```typescript
// From diggers.ts — the core "can a human solve this?" check
export function applyExhaustiveDigger(grid: number[][], config: GridConfig): void {
  const positions = shuffle(Array.from({ length: config.totalCells }, (_, i) => i));
  
  for (const pos of positions) {
    const row = Math.floor(pos / config.size);
    const col = pos % config.size;
    const backup = grid[row][col];
    if (backup === 0) continue;
    
    grid[row][col] = 0; // Tentatively remove the clue

    // Verify a human can still solve it WITHOUT guessing
    const solver = new HumanSolver(copyGrid(grid));
    const res = solver.solve({ maxTier: 'advanced' });
    
    if (!res.solved) {
      grid[row][col] = backup; // Put it back — removal broke solvability
    }
  }
}
```

**Why this design:** The digger's separation from the solver is critical. The digger asks "is this puzzle solvable?" while the solver answers. They are separate concerns with separate reasons to change.

---

#### [generation.service.ts](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/features/engine/services/generation.service.ts) — The Batch Orchestrator

**Role:** Contains `generatePuzzleBatch()`, which loops through the requested difficulty counts and calls `generateSudoku` for each one.

```typescript
// From generation.service.ts
export function generatePuzzleBatch(request: GenerationRequest): SudokuPuzzle[] {
  const { easy = 0, medium = 0, hard = 0, expert = 0, extreme = 0, gridSize = 9 } = request;
  const puzzles: SudokuPuzzle[] = [];
  const size = gridSize as GridSize;

  for (let i = 0; i < easy; i++) puzzles.push(generateSudoku('easy', size));
  for (let i = 0; i < medium; i++) puzzles.push(generateSudoku('medium', size));
  // ... hard, expert, extreme
  return puzzles;
}
```

**Why extract it:** This loop was previously embedded directly inside the Next.js API route handler. Extracting it into a service means the API route ([route.ts](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/app/api/generate/route.ts)) acts purely as a thin HTTP controller — parsing requests, validating inputs, and delegating to services. This is the **Controller-Service pattern**, a core enterprise architecture principle.

---

### 1.5 Strategy Extraction — The HumanSolver Refactor

This was the most impactful change. We extracted every solving strategy from the `HumanSolver` class body into standalone, pure functions organized by difficulty tier.

#### The Three Strategy Modules

##### [basic.ts](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/features/engine/strategies/basic.ts) — 5 Functions, 194 Lines

Contains the foundational strategies that solve Easy, Medium, and Hard puzzles:

| Function | What It Does |
| --- | --- |
| `applyNakedSingle(solver)` | If a cell has only 1 candidate left, place it. |
| `applyHiddenSingle(solver)` | If a number can only go in one cell within a house, place it. |
| `applyNakedPair(solver)` | Two cells with identical 2-candidate sets lock those candidates out of the rest of the house. |
| `applyHiddenPair(solver)` | Two candidates restricted to the same two cells — eliminate all other candidates from those cells. |
| `applyPointingPairs(solver)` | If a candidate in a box is confined to one row/column, eliminate it from that row/column outside the box. |

**Key code — the Naked Single, the simplest strategy:**

```typescript
// From basic.ts
export function applyNakedSingle(solver: HumanSolver): boolean {
  const singles = solver.getCellsWithNCandidates(1);
  if (singles.length > 0) {
    const { r, c, cands } = singles[0];
    solver.placeNumber(r, c, cands[0]);
    return true; // Return immediately to let the placeNumber ripple effect trigger more singles
  }
  return false;
}
```

**Why the early return matters:** When `placeNumber` is called, it eliminates the placed number from all peers in the same row, column, and box. This cascade frequently creates *new* naked singles. By returning `true` immediately, the `solve()` loop restarts from the top and catches those cascading singles before trying more expensive strategies.

##### [advanced.ts](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/features/engine/strategies/advanced.ts) — 4 Functions, 66 Lines

Contains strategies required for Expert-level puzzles:

| Function | Delegates To |
| --- | --- |
| `applyXWing(solver)` | `solver.applyFishOnAxis(num, axis, 2)` — a generalized "fish" pattern finder |
| `applySwordfish(solver)` | `solver.applyFishOnAxis(num, axis, 3)` — same algorithm, size 3 |
| `applyYWing(solver)` | `solver.applyWingPattern(2)` — a generalized "wing" pattern finder |
| `applyXYZWing(solver)` | `solver.applyWingPattern(3)` — same algorithm, pivot size 3 |

**Design decision — Delegation to solver helpers:** The advanced strategies delegate to generalized helper methods (`applyFishOnAxis`, `applyWingPattern`) that still live on the `HumanSolver` class. This is intentional: these helpers need deep access to the solver's candidate grid and are parameterized by size, making them reusable across multiple strategies. The strategy functions themselves are thin wrappers that encode *which* specific pattern to search for.

```typescript
// From advanced.ts — thin wrapper around the generalized fish finder
export function applyXWing(solver: HumanSolver): boolean {
  let changed = false;
  for (let num = 1; num <= solver.size; num++) {
    if (solver.applyFishOnAxis(num, 'row', 2)) changed = true;
    if (solver.applyFishOnAxis(num, 'col', 2)) changed = true;
  }
  return changed;
}
```

##### [extreme.ts](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/features/engine/strategies/extreme.ts) — 3 Functions, 252 Lines

Contains the most algorithmically complex strategies:

| Function | Algorithmic Complexity |
| --- | --- |
| `applyWWing(solver)` | O(n² × conjugate pairs) — scans all bivalue cell pairs for conjugate-pair bridges |
| `applyALSXZ(solver)` | O(ALS² × candidates²) — enumerates Almost Locked Sets and finds Restricted Common Candidates |
| `applyAIC(solver)` | O(nodes × MAX_DEPTH) — BFS through an inference graph with alternating strong/weak link chains |

**Key code — the AIC chain builder (most complex algorithm in the codebase):**

```typescript
// From extreme.ts — building the inference graph
const strongLinks = new Map<string, string[]>();
const weakLinks = new Map<string, string[]>();

const nodeKey = (r: number, c: number, num: number) => `${r},${c},${num}`;

// Strong links: exactly 2 positions for a candidate in a house
// Weak links: same cell with different candidates, or >2 positions for a candidate
for (let num = 1; num <= solver.size; num++) {
  const base = (num - 1) * solver.numHouses;
  for (let h = 0; h < solver.numHouses; h++) {
    const cells = housePositions[base + h];
    if (cells.length === 2) {
      // Strong link — if one is false, the other MUST be true
      addLink(strongLinks, keyA, keyB);
      addLink(strongLinks, keyB, keyA);
    } else if (cells.length > 2) {
      // Weak link — if one is true, the others MUST be false
      // ... pairwise weak links between all positions
    }
  }
}
```

**The MAX_CHAIN_DEPTH = 12 guard:** Without this limit, the BFS could explore exponentially long chains. The research paper warned about this:

> *"AI-generated code frequently produces performance inefficiencies... leading to a significantly expanded attack surface for Denial of Service (DoS) attacks."* — [Security Research](file:///Users/morp/Documents/GitHub/Puzzle-Generator/Docs/research/web-security-mitigation.md)

#### The Documentation Mirror

Per our [AGENTS.md](file:///Users/morp/Documents/GitHub/Puzzle-Generator/AGENTS.md) rules, every `.ts` file in the engine has a corresponding `.md` pseudocode companion:

- [basic.md](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/features/engine/strategies/basic.md)
- [advanced.md](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/features/engine/strategies/advanced.md)
- [extreme.md](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/features/engine/strategies/extreme.md)

These explain the *why* behind each algorithm in plain English, not just restating the code.

---

#### The Refactored `solve()` Method

The payoff of the entire extraction is visible in the [solve() method](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/features/engine/human-solver.ts#L357-L392):

```typescript
// From human-solver.ts — the orchestrator pattern in action
solve(options: { maxTier?: 'basic' | 'advanced' | 'extreme' } = {}) {
  let changed = true;

  while (changed && !this.isSolved()) {
    changed = false;

    // Basic tier — always attempted first (cheapest strategies)
    if (applyNakedSingle(this)) { changed = true; continue; }
    if (applyHiddenSingle(this)) { changed = true; continue; }
    if (applyNakedPair(this)) { changed = true; continue; }
    if (applyHiddenPair(this)) { changed = true; continue; }
    if (applyPointingPairs(this)) { changed = true; continue; }

    if (options.maxTier === 'basic') break; // Stop here for Easy/Medium/Hard

    // Advanced tier — only for 9x9 grids
    if (this.size === 9) {
      if (applyXWing(this)) { this.usedAdvanced = true; changed = true; continue; }
      if (applySwordfish(this)) { this.usedAdvanced = true; changed = true; continue; }
      if (applyYWing(this)) { this.usedAdvanced = true; changed = true; continue; }
      if (applyXYZWing(this)) { this.usedAdvanced = true; changed = true; continue; }
    }

    if (options.maxTier === 'advanced') break; // Stop here for Expert

    // Extreme tier — the heavy artillery
    if (this.size === 9) {
      if (applyWWing(this)) { this.usedExtreme = true; changed = true; continue; }
      if (applyALSXZ(this)) { this.usedExtreme = true; changed = true; continue; }
      if (applyAIC(this)) { this.usedExtreme = true; changed = true; continue; }
    }
  }

  return { solved: this.isSolved(), requiresAdvanced: this.usedAdvanced, requiresExtreme: this.usedExtreme };
}
```

**Why this is better:** The method now reads like a table of contents. Each strategy is a named, imported function. The tiered `break` statements make the difficulty progression explicit. The `this.usedAdvanced` / `this.usedExtreme` flags allow the diggers to verify that a puzzle genuinely *required* those strategies.

#### Visibility Change: `private` → `public`

When strategies lived inside the class, they could access `private` helper methods directly. Once extracted to separate files, those helpers needed to become `public` so the standalone functions could call `solver.getCellsWithNCandidates(2)`, `solver.sees(cell1, cell2)`, etc. This is a deliberate trade-off: we sacrifice encapsulation at the class level to gain modularity at the module level.

---

### 1.6 UI Component Decomposition

The same SRP principle was applied to the frontend. The monolithic `PuzzleForm.tsx` was split into:

#### [usePuzzleGeneration.ts](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/features/puzzle-configuration/hooks/usePuzzleGeneration.ts) — Custom Hook

**Extracted:** All `fetch` calls, loading state, error handling, and Blob download logic.

```typescript
// From usePuzzleGeneration.ts — the complete hook
export function usePuzzleGeneration() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async (config: GenerationConfig) => {
    setError('');
    // Client-side validation
    const total = config.easy + config.medium + config.hard + config.expert + config.extreme;
    if (total === 0) { setError('Please select at least one puzzle to generate.'); return false; }
    if (total > 50) { setError('Too many puzzles. Maximum is 50 per request.'); return false; }

    setLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (!res.ok) { /* error handling */ }
      // Download the PDF blob
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      // ... trigger download ...
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, generate };
}
```

**Why extract it:** The `PuzzleForm` component should only know about *rendering* the form. It should not know about HTTP requests, Blob URLs, or DOM manipulation for downloads. By extracting the hook, the component becomes a pure function of its props and state — trivially testable by mocking this single hook.

#### Additional UI Components

- **`GridSizeSelector.tsx`** — Dumb component rendering the 4×4 / 6×6 / 9×9 segmented control.
- **`DifficultyConfigurator.tsx`** — Dumb component rendering the five difficulty sliders with disabled states for mini grids.

---

### 1.7 The API Route — Controller Pattern

[route.ts](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/app/api/generate/route.ts) was stripped down to a thin controller:

1. **Parse** the JSON body (with safe error handling for malformed requests)
2. **Validate** inputs (type checks, range checks, grid size restrictions, max puzzle limit)
3. **Delegate** to `generatePuzzleBatch()` for puzzle generation
4. **Delegate** to `generatePuzzlePDF()` for PDF rendering
5. **Return** the binary response with correct headers

The critical line `export const runtime = 'nodejs';` prevents Next.js from deploying this route to the Edge runtime, which lacks the native `fs` and `stream` modules that `pdfkit` requires.

---

## Part 2: The Enterprise Architecture Refactor

With the structural decomposition complete, we turned to three pillars of enterprise software quality: **Observability**, **Testing**, and **Performance Profiling**.

### 2.1 Structured Logging with Pino

#### The Problem

The API route used `console.log` for output. In production, these produce unstructured strings that are nearly impossible to parse, filter, or alert on. Our research paper stated:

> *"Traditional string-based logging is a critical anti-pattern. Engineering teams must adopt structured logging, where every event is output as a machine-readable JSON object containing essential contextual attributes."* — [Enterprise Architecture Research](file:///Users/morp/Documents/GitHub/Puzzle-Generator/Docs/research/enterprise-architecture.md)

#### The Solution: Pino + pino-pretty

**New file: [logger.ts](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/lib/logger.ts)**

```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
      },
    },
  }),
});
```

**Why Pino specifically:** Pino is the fastest JSON logger for Node.js. It achieves this by offloading serialization to a worker thread and writing directly to stdout. In production, the output is raw JSON — perfect for ingestion by Datadog, Splunk, or CloudWatch. In development, `pino-pretty` pipes the JSON through a human-readable formatter with colors and timestamps.

**Why the conditional transport:** The spread syntax `...(process.env.NODE_ENV !== 'production' && { transport: ... })` ensures that `pino-pretty` is only loaded in development. In production, Pino skips the pretty-printing overhead entirely.

---

**New file: [instrumentation.ts](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/instrumentation.ts)**

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { logger } = await import('./lib/logger');
    logger.info({ event: 'app_start', runtime: process.env.NEXT_RUNTIME }, 'Application initialized');
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error({ event: 'unhandled_rejection', reason, promise }, 'Unhandled Rejection at Promise');
    });

    process.on('uncaughtException', (error) => {
      logger.error({ event: 'uncaught_exception', error }, 'Uncaught Exception thrown');
    });
  }
}
```

**Why this file exists:** Next.js automatically calls `register()` from `src/instrumentation.ts` when the server boots. This is the official mechanism for initializing telemetry, APM agents, or global error handlers. Without it, unhandled promise rejections would silently crash the Node.js process with no log output.

**Why the runtime guard:** `instrumentation.ts` can run in both Node.js and Edge runtimes. The `if (process.env.NEXT_RUNTIME === 'nodejs')` guard ensures we only attach `process.on` handlers in Node.js — these APIs don't exist in the Edge runtime.

---

**Modified file: [route.ts](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/app/api/generate/route.ts) — "Wide Event" Logging**

The API route now emits structured JSON on both success and failure:

```typescript
// Success — a single JSON object with ALL relevant context
logger.info(
  { 
    event: 'generation_success', 
    counts: { easy, medium, hard, expert, extreme }, 
    gridSize, 
    durationMs: Math.round(performance.now() - startTime) 
  }, 
  'Successfully generated puzzles and PDF'
);

// Failure — captures the full error with stack trace
logger.error(
  { 
    event: 'generation_failure', 
    error: err.message, 
    stack: err.stack,
    durationMs: Math.round(performance.now() - startTime)
  }, 
  'Failed to generate PDF'
);
```

**Why "wide events":** Instead of scattering multiple `console.log` calls throughout the function, a single wide event captures *everything* — the requested configuration, the grid size, the execution time, and the outcome — in one atomic JSON object. This is invaluable for production debugging: a single log line tells the complete story of a request.

---

### 2.2 Testing Modernization

#### 2.2.1 Strict Colocation

**What changed:** Deleted the legacy global `tests/` directory. All tests now sit immediately adjacent to the code they test:

| Test File | Location | Tests |
| --- | --- | --- |
| [solver.test.ts](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/features/engine/solver.test.ts) | Next to `human-solver.ts` | Engine solving correctness |
| [PuzzleForm.test.tsx](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/features/puzzle-configuration/components/PuzzleForm.test.tsx) | Next to `PuzzleForm.tsx` | UI behavioral testing |
| [route.test.ts](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/app/api/generate/route.test.ts) | Next to `route.ts` | API validation and integration |

**Why colocation matters:** When a developer modifies `PuzzleForm.tsx`, the test file is *right there*. There's no guessing where the tests live, no hunting through a distant `tests/` tree. Our enterprise research emphasized:

> *"Files that change together should be stored together."* — [AGENTS.md](file:///Users/morp/Documents/GitHub/Puzzle-Generator/AGENTS.md)

#### 2.2.2 The Hybrid Environment Solution

**The problem we hit:** Jest's `testEnvironment` is global. Setting it to `jsdom` (needed for React component testing) broke the API route tests because `NextRequest` extends the Web API `Request` class, which collides with `jsdom`'s polyfilled `Request`. Setting it to `node` (needed for API/PDF tests) broke the React tests because `document` and `window` don't exist.

**The solution:** We set the global environment to `node` in [jest.config.js](file:///Users/morp/Documents/GitHub/Puzzle-Generator/jest.config.js) and use per-file pragmas to opt UI tests into `jsdom`:

```javascript
// jest.config.js — global default is Node
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'node',  // Safe default for API and engine tests
  preset: 'ts-jest',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
};
```

```typescript
// PuzzleForm.test.tsx — opts into jsdom for this file only
/** @jest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
```

```typescript
// solver.test.ts — explicitly stays in node
/** @jest-environment node */
import { HumanSolver } from './human-solver';
```

The [jest.setup.js](file:///Users/morp/Documents/GitHub/Puzzle-Generator/jest.setup.js) file conditionally loads `@testing-library/jest-dom` only when running in a browser-like environment:

```javascript
if (typeof window !== 'undefined') {
  require('@testing-library/jest-dom');
}
```

**Why this guard:** `@testing-library/jest-dom` adds custom matchers like `toBeInTheDocument()` that depend on DOM APIs. Loading it in a Node environment would fail. The `typeof window` check elegantly solves this.

#### 2.2.3 Behavioral UI Testing (AAA Pattern)

**New file: [PuzzleForm.test.tsx](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/features/puzzle-configuration/components/PuzzleForm.test.tsx)**

This test suite follows the **Arrange, Act, Assert** pattern with **accessibility-first queries**:

```tsx
// Mock the hook at the module boundary — not the internal implementation
jest.mock('../hooks/usePuzzleGeneration');
const mockUsePuzzleGeneration = usePuzzleGeneration as jest.MockedFunction<typeof usePuzzleGeneration>;

describe('PuzzleForm Component', () => {
  const mockGenerate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePuzzleGeneration.mockReturnValue({
      loading: false, error: '', generate: mockGenerate,
    });
  });

  it('calls generate with correct configuration when submitted', async () => {
    // ARRANGE
    const user = userEvent.setup();
    render(<PuzzleForm />);

    // ACT — simulate what a real user would do
    const generateBtn = screen.getByRole('button', { name: /generate pdf/i });
    await user.click(generateBtn);

    // ASSERT — verify the hook was called with the expected config
    expect(mockGenerate).toHaveBeenCalledWith({
      gridSize: 9, easy: 2, medium: 2, hard: 2, expert: 0, extreme: 0
    });
  });

  it('displays loading state correctly', () => {
    // ARRANGE — mock the hook to return loading=true
    mockUsePuzzleGeneration.mockReturnValue({ loading: true, error: '', generate: mockGenerate });

    // ACT
    render(<PuzzleForm />);
    
    // ASSERT — the button should be disabled and show "Generating..."
    const generateBtn = screen.getByRole('button', { name: /generating/i });
    expect(generateBtn).toBeDisabled();
  });
});
```

**Why `getByRole` instead of `getByTestId`:** Using `getByRole('button', { name: /generate pdf/i })` tests the component the way a user (or screen reader) experiences it. If someone changes the button's `data-testid` but keeps the label, the test still passes. If someone removes the button's accessible name, the test correctly fails — catching a real accessibility regression.

**Why mock at the hook boundary:** We mock `usePuzzleGeneration` rather than mocking `fetch` directly. This isolates the test to the component's behavior (does it call `generate` with the right config?) without coupling it to the HTTP layer.

#### 2.2.4 API Route Testing

**Modified file: [route.test.ts](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/app/api/generate/route.test.ts)**

The API tests use a lightweight mock approach instead of constructing real `NextRequest` objects:

```typescript
// Mock NextRequest with just the .json() method — that's all route.ts uses
function buildRequest(body: Record<string, unknown>): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

function buildEmptyRequest(): NextRequest {
  return { json: async () => { throw new Error('Invalid JSON'); } } as unknown as NextRequest;
}
```

**Why this mock approach:** Constructing a real `NextRequest` in a test environment requires polyfilling the entire Web Streams API, `Request`, `Response`, `Headers`, and `TextEncoder`. Each polyfill introduces version conflicts with Next.js internals. By mocking only the `.json()` method (the only method our route actually calls), we sidestep all polyfill issues entirely.

The test suite covers both **happy paths** (valid requests returning 200 with correct headers and valid PDF binary) and **sad paths** (zero puzzles, overload protection, type coercion attacks, negative numbers, missing body):

```typescript
test('Response body starts with a valid PDF header (%PDF)', async () => {
  const res = await POST(buildRequest({ easy: 1 }));
  const buffer = Buffer.from(await res.arrayBuffer());
  const header = buffer.subarray(0, 4).toString('ascii');
  expect(header).toBe('%PDF'); // The magic bytes that identify a valid PDF
}, 30_000);

test('The Overload: requesting more than 50 total puzzles returns 400', async () => {
  const res = await POST(buildRequest({ easy: 20, medium: 20, hard: 20 }));
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body.error).toMatch(/maximum|limit|too many/i);
});
```

---

### 2.3 V8 Benchmark Hardening

#### The Benchmarking Problem

The original [benchmark-human-solver.ts](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/features/engine/benchmarks/benchmark-human-solver.ts) ran a `for` loop over the **exact same grid object** thousands of times. The V8 JavaScript engine's JIT compiler detects this pattern and applies aggressive optimizations:

- **Hidden Class Caching:** V8 notices the `HumanSolver` object always has the same shape and caches the property lookups.
- **Dead Code Elimination:** If V8 detects the loop result is never used, it may skip computation entirely.
- **Inline Caching:** Repeated calls to the same methods with the same argument types get inlined.

The result: artificially fast benchmarks that don't reflect real-world performance.

#### The Solution: Randomized Grid Pool

```typescript
// From benchmark-human-solver.ts — pre-generate diverse inputs
function generatePuzzlePool(size: number) {
  console.log(`Pre-generating pool of ${size} unique expert puzzles to thwart V8 JIT caching...`);
  const pool = [];
  for (let i = 0; i < size; i++) {
    pool.push(generateSudoku('expert').grid);
  }
  return pool;
}

// ... in the benchmark loop ...
const puzzlePool = generatePuzzlePool(50);

for (let i = 0; i < iterations; i++) {
  const grid = puzzlePool[i % puzzlePool.length]; // Cycle through 50 different grids
  const solver = new HumanSolver(grid);
  solver.solve({ maxTier });
}
```

**Why 50 grids:** Each grid produces a different candidate state, different strategy activation paths, and different object shapes. This prevents V8 from caching any single execution path. The pool is generated *before* the timer starts, so the generation cost doesn't pollute the benchmark measurement.

**Why the pool is pre-generated:** If we generated a new puzzle *inside* the timed loop, we'd be benchmarking `generateSudoku + HumanSolver.solve` combined, making it impossible to isolate the solver's performance.

**Validated results:** After this change, the benchmark correctly measures ~1,700 solves/second for the expert tier — a realistic, reproducible metric.

---

## Part 3: Security Rules Integration

Based on the [Web Security Research](file:///Users/morp/Documents/GitHub/Puzzle-Generator/Docs/research/web-security-mitigation.md), we added a new **"Section 6: Security & Infrastructure"** to [AGENTS.md](file:///Users/morp/Documents/GitHub/Puzzle-Generator/AGENTS.md) and updated the [Roadmap Phase 4](file:///Users/morp/Documents/GitHub/Puzzle-Generator/Docs/roadmap.md) to enforce these practices when we build authentication and database integration:

| Rule | Rationale |
| --- | --- |
| **Argon2id or bcrypt (with SHA-256 pre-hash)** for passwords | Memory-hard algorithms defeat GPU brute-forcing. bcrypt's 72-byte limit requires pre-hashing. |
| **HttpOnly, Secure, SameSite=Strict cookies** for sessions | Prevents XSS exfiltration of tokens from `localStorage`. |
| **BOLA prevention** via ownership checks | Stops attackers from enumerating IDs to access other users' data. |
| **Parameterized queries** via type-safe ORM | Eliminates SQL injection by design. |

---

## Conclusion

These two refactors transformed the codebase from a functional prototype into a modular, observable, testable, and security-conscious application:

- **18 tests** pass across 3 suites (engine, UI, API) with a hybrid jsdom/node environment.
- **Structured JSON telemetry** captures every generation event with full context.
- **Benchmarks** produce realistic, V8-hardened performance metrics.
- **Security rules** are codified and ready for Phase 4 implementation.

The foundation is now prepared for the next phase of development: **Phase 3 — The Interactive React Sudoku Board**.
