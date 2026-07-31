# Killer 4×4 Feasibility — De-Risk Findings

> **Status:** ✅ De-risk complete (2026-07-31). **Decision: build 4×4 Killer at *easy only*.**
> Written per the AGENTS.md Roadblock & Research rule, because the measured result contradicts a
> plan assumption (that "build Killer 4×4" would make Killer eligible for *every* 4×4 mini slot).
> The durable record of *why* Killer minis are easy-only.

## What we planned

The daily restructure ([daily-redesign-plan.md](../daily-redesign-plan.md)) needs a mini set with
one slot per puzzle type. Minis are 3-tier (easy/medium/hard) with **size following difficulty**:
easy → 4×4, medium → 4×4, hard → random(4×4 / 6×6). The current registry has **no Killer 4×4**
(Killer minis are 6×6-only). The plan assumed we'd *build* a 4×4 Killer generator so Killer could
fill any 4×4 mini slot — "shouldn't be very difficult," since the engine is size-generic.

Before building, we ran a de-risk spike to confirm 4×4 Killer produces uniquely-solvable puzzles
that **grade into distinct tiers**.

## What we measured

Spike: 4000 attempts per cage-config, digits 1–4, no injected givens beyond cage singles. For each
generated cage partition we ran the exact solver's `countSolutions(2)` (uniqueness) and, for unique
layouts, the `KillerLogicalSolver` to find the minimum tier that solves it. (The combinatorics and
exact solver already support 4-digit grids — `cage-combinations.ts` ships a `[4, 6, 9]` table set
and the exact solver is size-generic — so only the spike itself was throwaway.)

| minSize–maxSize | ms/attempt | unique-solution rate | of uniques, logically solvable | min-tier split (of solvable) | singles/puzzle (median) | score (median) |
|---|---|---|---|---|---|---|
| 1–2 | 0.088 | 72.3% | 100.0% | **t1 100%**, t2 0%, t3 0% | 6 | 3.0 |
| 1–3 | 0.059 | 45.8% | 100.0% | **t1 99.2%**, t2 0.3%, t3 0.5% | 4 | 3.7 |
| 2–2 | 0.035 | 14.5% | 88.5% | **t1 100%**, t2 0%, t3 0% | 0 | 4.4 |
| 2–3 | 0.039 | 27.9% | 99.7% | **t1 96.9%**, t2 0.7%, t3 2.4% | 1 | 5.4 |

**Tiers 4 and 5 were zero in every configuration.** Tier 2/3 combined never exceeded ~3%, and the
two-factor score range is narrow (medians 3–5; max ~16 in the loosest config).

## Why it doesn't work (as a 3-tier ladder)

Killer's only clue is the **cage sum** — there are no givens. On a 16-cell grid with digits 1–4,
the arithmetic constraints alone pin almost every uniquely-solvable layout down to trivial tier-1
logic (magic cages / singles). There simply isn't enough room for the higher techniques
(consistent-digit, combo-restriction, X-Wing, …) to become *necessary*. This is structural, not a
tuning miss: it mirrors why the 6×6 Killer ladder already stops at hard and the full 5-tier ladder
is 9×9-only.

Contrast with the other two types at 4×4, which **do** keep three tiers — because they have a lever
Killer lacks:

- **Classic Sudoku 4×4** grades via *givens* (remove givens → force techniques). Registry:
  `mini4-easy/medium/hard`.
- **Keisan (Calcudoku) 4×4** grades substantially via the **operator palette**: easy = `+ − ÷`
  only (× is gated out because it forces prime-factorization reasoning); medium/hard open all four
  `+ − × ÷`, plus operator-mix weighting and fewer givens. Registry: `calc4-easy/medium/hard`
  (`DIFFICULTY_CONFIG_4` in `calc-sudoku.ts`). **This is the operations-graded arithmetic 4×4
  puzzle** — so that niche is already filled, by Keisan, not Killer.

## Options considered

1. **Build 4×4 Killer easy-only + eligibility-constrained mini roller.** ✅ **Chosen.** Honest
   difficulty, least work (one tier). Killer is eligible for the easy-4×4 mini slot and any 6×6
   mini slot, but not medium-4×4 or hard-4×4; the roller (which already must respect eligibility)
   assigns a valid type→slot matching each day — one always exists because classic/Keisan cover
   medium/hard-4×4.
2. **Manufacture a 4×4 Killer "medium".** Rejected. The tier-2/3 band is <3% with heavy score
   overlap, so it would mean slow rejection-sampling for a "medium" barely distinguishable from
   easy — fragile and dishonest.
3. **Don't build 4×4 Killer at all.** Rejected. Killer minis would stay 6×6-only, so Killer would
   get a mini slot only when *hard* rolls 6×6 — "one mini per type" would break most days.

## Decision & how it folds into the plan

- **Build `DIFFICULTY_CONFIG_4` for Killer with `easy` only** (mirroring how 6×6 omits
  expert/extreme and 9×9-only tiers are gated). Generation is trivially cheap (~0.04–0.09 ms/
  attempt, double-digit % unique yield), so no yield/perf concern.
- **Mini eligibility:** Killer ∈ {easy-4×4, any 6×6 e/m/h}; classic & Keisan ∈ {all 4×4 e/m/h, all
  6×6 e/m/h}. The mini roller picks a random *valid* type→difficulty assignment respecting this.
- Add the `(killer, 4, easy)` profile row (`minSolveMs` / `botTimeMs`) to the reshaped registry.
- Owner confirmed easy-only on 2026-07-31.

## Open follow-ups

- If a future puzzle type (types 4–5) also can't tier at 4×4, the same constrained-roller approach
  absorbs it — no new mechanism needed.
- Revisit only if we ever add real 4×4 Killer techniques (unlikely to be worth it for a mini).
