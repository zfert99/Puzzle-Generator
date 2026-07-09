# Apply Enterprise Architecture Best Practices

This plan details how we will integrate the insights from the enterprise architecture research into our Next.js application to improve testing, observability, and benchmarking.

## Proposed Changes

---

### Tests & Configuration

To enable behavioral testing of our React components, we need to update our Jest configuration to use `jsdom` (simulating a browser). We will also completely remove the legacy global `tests/` directory to adhere to strict colocation rules.

#### [MODIFY] [jest.config.js](file:///Users/morp/Documents/GitHub/Puzzle-Generator/jest.config.js)

- Update to use `next/jest` to automatically handle Next.js specific compiler transforms (e.g., SWC, aliases).
- Change `testEnvironment` from `node` to `jsdom`.

#### [DELETE] [tests/test-direct.ts](file:///Users/morp/Documents/GitHub/Puzzle-Generator/tests/test-direct.ts)

#### [DELETE] [tests/test-api.js](file:///Users/morp/Documents/GitHub/Puzzle-Generator/tests/test-api.js)

---

### Features: Engine

The solver tests and benchmarks will be updated to follow the new rules. The benchmark will be randomized to prevent V8 Just-In-Time (JIT) from artificially caching and over-optimizing the loop.

#### [NEW] [solver.test.ts](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/features/engine/solver.test.ts)

- Port the functionality of the old `test-direct.ts` into a proper Jest test suite colocated with the engine.

#### [MODIFY] [benchmark-human-solver.ts](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/features/engine/benchmarks/benchmark-human-solver.ts)

- Refactor the benchmark to run against a dynamically generated pool of slightly varying puzzles or rotated versions of grids instead of running the exact same grid repetitively, avoiding V8 cache priming and dead code elimination traps.

---

### Features: Puzzle Configuration (UI Testing)

We will implement behavioral testing for the PuzzleForm using the Arrange, Act, Assert pattern and React Testing Library.

#### [NEW] [PuzzleForm.test.tsx](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/features/puzzle-configuration/components/PuzzleForm.test.tsx)

- Create a behavioral test simulating a user filling out the form and clicking generate.
- Use accessibility-first queries (`getByRole`, `getByLabelText`).
- Mock the `usePuzzleGeneration` hook (boundary mocking).

---

### Telemetry (Structured Logging)

We will implement Pino for structured JSON logging to replace standard `console.log`, providing high-performance observability. We will also use `pino-pretty` for local development.

#### [NEW] [logger.ts](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/lib/logger.ts)

- Initialize the global `pino` logger instance.

#### [NEW] [instrumentation.ts](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/instrumentation.ts)

- Add Next.js instrumentation file to catch unhandled errors and initialize telemetry at application boot.

#### [MODIFY] [route.ts](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/app/api/generate/route.ts)

- Refactor the generation API to use `logger.info()` and emit "wide event" JSON objects upon success or failure instead of flat strings.

## Verification Plan

### Automated Tests

- Run `npm install pino @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom pino-pretty`
- Run `npx jest` to verify the colocated engine tests, API tests, and new PuzzleForm behavioral tests all pass under `jsdom`.
- Run the benchmark script to confirm it correctly executes the randomized grids without crashing.

### Manual Verification

- Review the terminal output of `npm run dev` to see the new structured JSON logs when triggering a puzzle generation.
