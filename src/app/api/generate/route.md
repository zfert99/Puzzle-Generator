# API Route: Plain English Pseudocode

This document explains the core logic behind our `route.ts` API endpoint for the `/api/generate` route. It breaks down the TypeScript syntax into plain English to help you understand *what* the code is doing and *why* it does it.

---

## 0. Rate Limiting (the first gate)

**Goal:** Stop a single client from exhausting serverless compute/$ on this unauthenticated,
CPU-heavy route (review finding **H1**).
**Steps:**

1. Derive the caller's IP (`clientIp`, from `x-forwarded-for`/`x-real-ip`).
2. Consume one token from that IP's budget: **10 requests / 60 s** (`rateLimit`, backed by Upstash
   Redis when configured, in-memory otherwise — see [`rate-limit.md`](../../../lib/rate-limit.md)).
3. If the budget is exhausted, return **429 Too Many Requests** with a `Retry-After` header — before
   parsing the body or doing any work.

## 1. Receiving the Request

**Goal:** Intercept the incoming `POST` request from the frontend and figure out exactly what the user wants.
**Steps:**

1. Wait for an incoming network request.
2. Open up the hidden "body" of the request (the data payload sent by the user) and read it as JSON.
3. Extract the following from the JSON payload:
   - `variant`: `'classic'` (default) or `'killer'`.
   - `easy`, `medium`, `hard`, `expert`, `extreme`: How many puzzles of each difficulty. Default to `0`.
   - `gridSize`: The grid size (4, 6, or 9). Defaults to `9`.

---

## 1b. Killer branch

**Goal:** When `variant === 'killer'`, generate a Killer Sudoku booklet instead of classic.
**Steps:**

1. Read `easy`, `medium`, `hard` (Killer v1 is 9×9 and offers only these three graded tiers —
   `gridSize`, `expert`, `extreme` don't apply).
2. Validate they're non-negative integers, the total is ≥ 1, and ≤ the 50 cap (same guards as
   classic; the server is the authoritative boundary).
3. `generateKillerBatch({ easy, medium, hard })` → graded Killer puzzles; `generateKillerPDF` →
   the booklet; return it as a download named `Killer_Sudoku.pdf`.

The classic path (sections 2–5) is unchanged and runs when `variant` is absent/`'classic'`.

## 1c. Kakuro branch (plan slices V3 → E5)

**Goal:** When `variant === 'kakuro'`, generate a Kakuro booklet — every puzzle fresh, unique,
and at exactly the requested tier (E5).
**Steps:**

1. Validate the body with a **Zod schema** (`kakuroRequestSchema`; AGENTS.md §6 "authorize →
   validate → mutate"): `gridSize` is `6 | 7 | 9` (Kakuro's own sizes, D11 — a Sudoku-family
   4 is rejected), each level count a non-negative integer.
2. All counts zero → `400`; total above `MAX_PUZZLES` (50) → `400`; more than `MAX_EXTREME` (5)
   extreme → `400` — the same caps as the other variants, because Kakuro now generates too
   (a 9×9 is ~0.3–0.8 s per tier, extreme the slowest; a full 50-puzzle 9×9 request sits well
   inside `maxDuration`).
3. `generateKakuroBatch(counts, { gridSize })` (in `kakuro.ts` — the Kakuro counterpart of
   `generateKillerBatch`, so the route stays a controller per AGENTS.md §1) →
   `generateKakuroPDF(puzzles)` → the booklet as `Kakuro.pdf`. The batch runs under **one 45 s
   budget** shared fairly by every puzzle in it (inside the 60 s `maxDuration` with the render
   to spare); a request that cannot finish is answered with a **503** that says how many of how
   many were generated and asks for fewer puzzles per PDF (`isKakuroBudgetError` — a request
   too large for this machine's budget, logged as `generation_budget` at warn, not a failure)
   rather than timing out with the PDF half-built or a generic 500 (review follow-up 8). The
   log line carries the five counts under `counts` and the size at the top level, the same
   shape as the other branches.

V3's one-per-level cap and the fixture selector are gone with the generator; the fixtures are
test data only.

---

## 1d. Skyscrapers branch (plan slices V3 → E5)

**Goal:** When `variant === 'skyscrapers'`, render a booklet of **generated** Skyscrapers at exactly
the requested tiers (E5), the Kakuro contract.
**Steps:**

1. Validate the body with a **Zod schema** (`skyscrapersRequestSchema`): `gridSize` is `5 | 6 | 7`
   (Skyscrapers' sizes, D4 — a 9 is rejected, default 6), each level count a non-negative integer.
2. All counts zero → `400`; a total above `MAX_PUZZLES` (50) → `400`; more than `MAX_EXTREME` (5)
   extreme → `400` (the shared cap every generated variant applies — extreme Skyscrapers is cheap,
   but one policy beats two); a count on a level **the size does not offer** (`SKYSCRAPERS_TIERS_BY_SIZE`, D12 — the 5×5 mini tops out at hard, the 7×7
   large starts at medium) → `400` naming the offered list, never a silently substituted puzzle.
3. `generateSkyscrapersBatch(counts, { gridSize })` under one 45 s budget (inside `maxDuration = 60`
   with the PDF render to spare); its budget error is answered with a `503` + `Retry-After` that
   says how many puzzles were done — a request too large for the budget, not a fault — then
   `generateSkyscrapersPDF` → `Skyscrapers.pdf`. The log line carries the counts and the size like
   the other branches.

The V3 one-puzzle cap and `selectSkyscrapersBatch` are gone; the fixtures are test data (and the
sample booklet's content, via `preview-skyscrapers.ts`).

## 2. Input Validation

**Goal:** Reject bad or dangerous requests before doing any heavy lifting. We run five checks in order:
**Steps:**

1. **Type Check:** Are `easy`, `medium`, `hard`, `expert`, and `extreme` all actual numbers? If someone sends a string like `"apple"` instead of a number, immediately return a `400 Bad Request` error.
2. **Negative/Decimal Check:** Are any of the values negative (e.g., `-5`) or non-integer (e.g., `2.7`)? If so, return a `400 Bad Request` error.
3. **Grid Size Check:** Is `gridSize` one of the valid values (4, 6, or 9)? If not, return a `400 Bad Request` error.
4. **Mini Grid Difficulty Check:** If `gridSize` is NOT 9, are `expert` or `extreme` greater than 0? If so, return a `400 Bad Request` error — Expert and Extreme difficulties are only available for 9x9 grids.
5. **Extreme Sub-Count Check:** Is `extreme` greater than `MAX_EXTREME` (5)? If so, return a `400 Bad Request` error. Extreme is the slow path in every variant, so the 50-total cap isn't enough on its own — a request of 50 Extreme puzzles satisfies the total cap but blows the `maxDuration = 60` function budget and 504s. This per-difficulty cap applies to all three variant branches (classic, Killer, Keisan) so no single request can exceed the duration budget.
6. **Zero Check:** Are all five values equal to `0`? If so, return a `400 Bad Request` error with the message: "Please select at least one puzzle to generate".
7. **Overload Check:** Does the total exceed the maximum limit of 50? If so, return a `400 Bad Request` error to prevent server overload.

---

## 3. Generating the Puzzles

**Goal:** Build the raw Sudoku puzzles based on the user's quantities and grid size.
**Steps:**

1. Create an empty list called `puzzles` to hold all of our generated boards.
2. Cast `gridSize` to the `GridSize` type.
3. **For each difficulty level** (Easy, Medium, Hard, Expert, Extreme):
   - Create a loop that runs the requested count of times.
   - Tell our Sudoku Engine to generate a puzzle of that difficulty at the specified `gridSize`.
   - Add it to the `puzzles` list.
4. *Result: We now have a single list containing all the raw, playable Sudoku objects.*

---

## 4. Building the PDF

**Goal:** Hand our list of raw puzzles over to the PDF engine to draw them visually.
**Steps:**

1. Call the `generatePuzzlePDF` function and pass it our full list of `puzzles`.
2. Wait for the PDF engine to finish drawing all the grids, titles, answer keys, and page numbers.
3. The PDF engine returns a raw binary `Buffer` (the actual file data).

---

## 5. Sending the Response

**Goal:** Send the completed PDF file back to the user's browser in a way that forces it to download.
**Steps:**

1. Package the binary PDF `Buffer` into a standard web response.
2. Add a `200 OK` status code.
3. **The Magic Headers:**
   - `Content-Type: application/pdf`: Tells the browser this data is a PDF document.
   - `Content-Disposition: attachment; filename="Sudoku_Puzzles.pdf"`: Forces a download instead of inline display.
4. Send the response back to the user.

---

## 6. Error Handling (The Safety Net)

**Goal:** If anything goes wrong during generation or PDF rendering, catch the error so the server doesn't crash.
**Steps:**

1. The entire process (Steps 1-5) is wrapped in a `try...catch` block.
2. If any function throws an error, the code immediately jumps to the `catch` block.
3. Log the full error message and stack trace **server-side only** via the
   structured Pino logger (`event: 'generation_failure'`), so developers can
   investigate from the logs.
4. Send a **generic** `500 Internal Server Error` response to the frontend — it
   contains only a safe, non-specific message. We deliberately do **not** include
   the error message or stack trace in the HTTP response: leaking internals to the
   client is an information-disclosure weakness (OWASP Security Misconfiguration,
   AGENTS.md Section 6). The stack lives in the server logs, never on the wire.
