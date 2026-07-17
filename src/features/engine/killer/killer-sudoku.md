# Killer Sudoku Pipeline (`killer-sudoku.ts`)

`generateKillerSudoku(difficulty, options)` — assembles K1–K3 into a uniquely-solvable Killer
puzzle. This is the K5 slice **without grading**; difficulty is provisional (K4 grades).

## The pipeline

```text
solved grid (reuse classic engine's fillGrid)
  → random cage partition (K3 generateCages)
    → uniqueness gate: exact solver countSolutions(2) === 1 ? (K2)
      → yes: return { variant:'killer', grid: all-zero, solution, cages, difficulty }
      → no : retry
```

Killer has **no givens**, so the returned `grid` is all zeros — the cages carry every clue.

## Why a plain regenerate loop is enough

The obvious worry: is a *random* cage partition ever uniquely solvable? Measured, yes — often:

| maxSize | Partitions that are already unique |
|---|---|
| 2 | ~83% |
| 3 | ~61% |
| 4 | ~38% |

So re-rolling the partition converges in ~2–3 attempts; no ambiguity-repair machinery (splitting
cages, adding constraints) is needed. `maxAttempts` (default 100) is a safety net — at 38%
uniqueness the chance of 100 failures is ~1e-21.

## Why a fresh solved grid per attempt (counterintuitive)

The instinct is to generate the solved grid once and only re-roll cages (skip the repeated
`fillGrid`). Measured, that's **slower and higher-variance**: a single unlucky grid whose
partitions are often ambiguous makes the loop thrash on it. `fillGrid` is cheap (~1.5 ms), and
re-rolling the whole grid each attempt avoids getting stuck. Lesson: measure the optimization,
don't assume it.

## Performance (100-sample, maxSize-4)

| Difficulty | median | p95 | max |
|---|---|---|---|
| easy | 0.6 ms | 3 ms | 4 ms |
| medium | 5 ms | 93 ms | 404 ms |
| hard | 7.5 ms | 131 ms | 177 ms |

Medians are excellent; the tail comes from rare slow uniqueness verifies (the maxSize-4 tail
from `killer-solver.md`). All well inside the generation budget (< 3 s easy/medium, < 10 s
hard). A per-verify node budget would clip the tail but isn't needed at these numbers.

## Difficulty is NOT graded yet (K4)

`difficulty` currently only picks the cage-size cap (`MAX_SIZE_BY_DIFFICULTY`) and is stamped
on the puzzle **provisionally** — it is *not* a verified band. Real grading (running a logical
solver and keeping only puzzles whose hardest required technique matches the target) is K4,
after which K5 loops until the graded difficulty matches. Injectable `rng`/`solution` keep the
whole pipeline deterministic for tests (and RNG-driven → client-side only, AGENTS.md §1).
