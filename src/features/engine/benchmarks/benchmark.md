# Benchmark Script: Plain English Pseudocode

This document explains the core logic behind our `benchmark.ts` script. It breaks down the TypeScript syntax into plain English to help you understand *what* the code is doing and *why* it does it.

---

## 1. Setup & Imports

**Goal:** Load the puzzle generator engine so we can test its speed.

**Steps:**

1. Import the `generateSudoku` function from our puzzle engine (`../sudoku.ts`).

---

## 2. The Main Execution Loop

**Goal:** Generate multiple Expert puzzles and precisely measure how long each one takes to create.

**Steps:**

1. Define a `main` function to run the benchmark.
2. Create an empty list called `times` to store the duration of each generation attempt.
3. Start a loop that runs 10 times. For each iteration:
   - Record the exact start time using `Date.now()`.
   - Call `generateSudoku('expert')` to generate a single Expert puzzle.
   - Record the exact end time immediately after generation finishes.
   - Calculate the duration by subtracting the start time from the end time.
   - Add this duration to the `times` list and print it to the console so we can see progress.

---

## 3. Results Calculation

**Goal:** Calculate the overall average time to give us a clear performance metric.

**Steps:**

1. Add up all 10 durations from the `times` list to get the `total` time.
2. Divide the `total` by 10 (the number of puzzles) to calculate the `average` time.
3. Print the total time and the average time (formatted to 2 decimal places) to the console.
4. Finally, execute the `main()` function at the bottom of the script so it actually runs when we execute the file.

---

## 4. Result Logging

**Goal:** Keep a commit-stamped history so a slow run can be compared against previous ones instead
of being judged in isolation.

**Steps:**

1. Read the current short git commit hash and the current timestamp, so each row identifies exactly
   which version of the engine produced it.
2. Build one markdown table row for the Expert pipeline average and one for the Extreme average.
3. Hand both rows to the shared [`benchmark-log.ts`](benchmark-log.md) writer, which appends them to
   `benchmark-logs.md` and creates that file's header if it does not exist yet.
4. Wrap the whole logging step in error handling — a failure to write the log should report itself
   but must never discard the benchmark numbers already printed to the console.

---

## 5. October 2026: what the numbers mean now

Two digger changes moved both rows in the same session (`diggers.md` has the detail):

- **Expert went up, on purpose — ~17 ms → ~95 ms.** The Expert digger now retries until the
  puzzle genuinely needs an advanced strategy (it used to be basic-solvable ~90% of the time), so a
  puzzle costs ~10 dig passes instead of one. Each pass got ~2× cheaper from the uniqueness gate.
- **Extreme went down — ~880 ms → ~150 ms.** The uniqueness gate rejects non-unique digs with
  `countSolutions` before `HumanSolver` grinds through ALS/AIC on them; a seeded per-pass comparison
  measured 12× with byte-identical output.

## Known gaps

- **Five Extreme samples, unseeded.** Each run draws fresh `Math.random` puzzles, and Extreme
  generation is retry-heavy, so its average swings a lot between runs. Recommended (left for a
  deliberate change so the logged history stays comparable): seed with `mulberry32`, raise the
  sample, and log the **median and p90** next to the mean.
- The script times with `Date.now()` (1 ms resolution); `performance.now()` would match the other
  benchmarks.
