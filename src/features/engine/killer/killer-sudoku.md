# Killer Sudoku Pipeline (`killer-sudoku.ts`)

`generateKillerSudoku(difficulty, options)` — assembles K1–K4 into a uniquely-solvable,
**difficulty-graded** Killer puzzle. This is the K5 slice, complete.

## The pipeline

```text
solved grid (reuse classic engine's fillGrid)
  → random cage partition (K3 generateCages)
    → uniqueness gate: exact solver countSolutions(2) === 1 ? (K2)      ── generateUniqueKiller
      → difficulty grade: logical solver, capped at target tier (K4)
        → hardestTier === target ? return : retry
```

`generateUniqueKiller(maxSize)` is the ungraded building block (one unique layout); the graded
generator calls it repeatedly and keeps the first puzzle that grades to the requested tier.
Killer has **no givens**, so the returned `grid` is all zeros — the cages carry every clue.

## Difficulties (v1 = three tiers)

| Difficulty | Grading tier | maxSize | Why |
|---|---|---|---|
| easy | 1 (magic cages, singles) | 2 | dense with single-combination cages |
| medium | 2 (consistent-digit, pairs) | 3 | Tier 2 abundant at maxSize 3 |
| hard | 3 (multi-unit 45, pointing) | 3 | Tier 3 abundant at maxSize 3 |

**Why only three.** Measured, the logical solver grades tiers 1–3 abundantly. Tier-4 layouts
that are *solvable* are a thin band (~1% of uniques), and larger cages are dominated by puzzles
**beyond the current technique set** (~86% of maxSize-4 uniques). So expert/extreme are deferred
until more Killer techniques (cage splitting, deeper chains) fill that band. This also lands
Killer on a clean, honest ladder rather than shipping a tier the generator can't reliably hit.

## Speed — two levers that make grading essentially free

1. **Cap the grader at the target tier** (`solve({ maxTier })`). Grading a would-be "medium"
   never runs the expensive Tier-4 strategies (AIC/ALS) — a too-hard candidate just comes back
   `solved: false`, a cheap reject.
2. **Tune `maxSize` per difficulty** so the target tier is common (high yield = few retries).

Result (100-sample, real random grids):

| Difficulty | median | max |
|---|---|---|
| easy | 0.7 ms | 7 ms |
| medium | 11 ms | 55 ms |
| hard | 11 ms | 76 ms |

All far inside the generation budget (< 3 s). A fresh solved grid per attempt (vs. reusing one)
avoids thrashing on an unlucky grid — measured, counterintuitively.

## Determinism

Injectable `rng` / `solution` keep the whole pipeline deterministic for tests (and RNG-driven →
client-side only, AGENTS.md §1).
