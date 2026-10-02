# API Route: `/api/puzzle` — Plain English Pseudocode

This document explains `route.ts` for `POST /api/puzzle`, the endpoint that backs
the interactive board (Phase 3). It returns a single playable puzzle as JSON.

## Killer branch

When the body has `variant: 'killer'`, the route validates the difficulty is one of
easy/medium/hard (Killer v1) and returns `generateKillerSudoku(difficulty)` — a `KillerPuzzle`
with `cages`. The classic path (below) runs otherwise.

## Kakuro branch (plan slices E4 → E5)

When the body has `variant: 'kakuro'`, the route validates `difficulty` against `KAKURO_LADDER`
and `gridSize` against `KAKURO_SIZES` (6 / 7 / 9 — Kakuro's own sizes, D11; the full ladder is
open at every size) and returns `generateKakuro(difficulty, { gridSize })` — fresh, unique, and
walked to exactly the requested tier (E5: the classifier is in the generator's objective). The
label is still the classifier's own, so the log line carries `served` beside the requested
`difficulty` as a standing check that they agree. A generation failure throws into the generic
500 like the other variants (measured at 0 in 1,500 puzzles across the sizes). E4's bounded
rejection, its fixture/nearest fallback and the `source` field are gone.

## Skyscrapers branch (plan slice E4 → E5)

When the body has `variant: 'skyscrapers'`, the route validates `difficulty` against
`SKYSCRAPERS_LADDER` and `gridSize` against `SKYSCRAPERS_SIZES` (5 / 6 / 7 — D4, settled by E3)
and returns a fresh, unique puzzle from `generateUniqueSkyscrapers` with the clue removal
**bounded** by the requested tier (`tierOf(difficulty)`): a hard request never serves expert, but
may serve medium, and the label is the classifier's own (D7). A size may have no square at the
requested tier at all (E3: an easy 7×7 floor is a one-in-fifty square), so the bounded attempt
gives up after **12 squares whose fully clued floor sits above the target** (or 40 rounds / 6 s)
and the request is served **unbounded** instead — labelled honestly and logged with
`fallback: true`. Serving exactly the requested tier, and which tiers each size offers, is E5's
job; until then the log line carries `served` and the generator's `stats` (rounds, repair swaps
and restarts, clues kept, ms) beside the request so the gap stays measured. A generation that
runs out of budget on both attempts is a 500 with a retry message (measured at 0 in the gate
run).

## Why this endpoint exists

The interactive board needs a fresh puzzle on demand. Generating it **server-side**
(rather than in the browser) keeps the heavy solver/generator out of the client
JavaScript bundle and off the browser's main thread — which matters for INP
(AGENTS.md Section 3) — and, because nothing is generated during server rendering,
it also sidesteps the `Math.random()` SSR/hydration-mismatch pitfall.

This mirrors the existing `/api/generate` (PDF) route's shape: a thin controller
that validates input, delegates to the engine service, logs a structured wide
event, and returns a **generic** error on failure.

## 0. Rate limiting

**Goal:** stop a single client from exhausting serverless compute on this unauthenticated,
server-side-generation route (review finding **H1**).

1. Derive the caller's IP and consume one token from its budget: **30 requests / 60 s** — generous
   for a real player (one puzzle per game), tight for an abuser. Backed by Upstash Redis when
   configured, in-memory otherwise (see [`rate-limit.md`](../../../lib/rate-limit.md)).
2. If the budget is exhausted, return **429 Too Many Requests** with a `Retry-After` header before
   doing any work.

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
