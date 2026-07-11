# API Route: `/api/puzzle` — Plain English Pseudocode

This document explains `route.ts` for `POST /api/puzzle`, the endpoint that backs
the interactive board (Phase 3). It returns a single playable puzzle as JSON.

## Why this endpoint exists

The interactive board needs a fresh puzzle on demand. Generating it **server-side**
(rather than in the browser) keeps the heavy solver/generator out of the client
JavaScript bundle and off the browser's main thread — which matters for INP
(AGENTS.md Section 3) — and, because nothing is generated during server rendering,
it also sidesteps the `Math.random()` SSR/hydration-mismatch pitfall.

This mirrors the existing `/api/generate` (PDF) route's shape: a thin controller
that validates input, delegates to the engine service, logs a structured wide
event, and returns a **generic** error on failure.

## 1. Receiving the request

**Goal:** read what puzzle the client wants.

1. Await the request; parse its JSON body. If parsing throws, return `400`.
2. Extract `difficulty` and `gridSize` (defaulting `gridSize` to `9`).

## 2. Validation

**Goal:** reject bad input before doing expensive work.

1. `difficulty` must be one of `easy | medium | hard | expert | extreme`, else `400`.
2. `gridSize` must be `4`, `6`, or `9`, else `400`.
3. Expert and Extreme are 9x9-only (they need strategies that don't exist on mini
   grids) — reject them for `gridSize !== 9` with `400`.

## 3. Generation and response

**Goal:** produce the puzzle and hand it back.

1. Call `generateSinglePuzzle(difficulty, gridSize)` from the engine service.
2. Log a `puzzle_success` wide event (difficulty, gridSize, durationMs) via Pino.
3. Return `{ grid, solution, difficulty, gridSize }` as JSON with `200`. The
   `solution` is included so the client can drive the optional real-time
   error-checking feature.

## 4. Error handling

**Goal:** fail safely without leaking internals.

1. Any thrown error is caught, and its message + stack are logged **server-side
   only** (`puzzle_failure` event).
2. The client receives a **generic** `500` with no message or stack — leaking those
   is an information-disclosure weakness (OWASP Security Misconfiguration; AGENTS.md
   Section 6).
