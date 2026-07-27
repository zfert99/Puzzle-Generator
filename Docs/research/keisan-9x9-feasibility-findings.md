# Keisan 9×9 Feasibility — Measured Findings (K7 de-risk)

Findings from de-risking **9×9 Keisan (Calcudoku)** generation against the current engine,
plus a recap of the known difficulty issues at the smaller sizes. Written as input for a
research pass: the numbers below say what the engine *does today*, so the open question is
what techniques/levers could change them.

**TL;DR:** 9×9 Keisan generates fine at low difficulty but hits three hard walls at the top
end. (1) Cages of 5+ cells are effectively infeasible — verify time explodes and our solver
grades *none* of them. (2) The logical solver tops out at **Tier 4 (X-Wing)** and in practice
almost everything lands at **Tier 2**, so there is no technique ladder to hang Expert/Extreme
on. (3) **Givens (single-cell cages) are load-bearing** — they are what make a 9×9 board fast
to verify and gradable at all, which means difficulty is driven mostly by *how few givens*
you dare use, and the 0-given end is exactly where the engine struggles.

---

## 1. Method

For each configuration: fill a random 9×9 Latin square, carve cages with
`generateCalcCageShapes`, assign operators (`+ − × ÷`) with `assignCalcCages`, then:

- **Verify** = `CalcSolver.countSolutions(cap 2, 500k-node budget)` — the uniqueness proof the
  generator runs on every candidate. This is the dominant per-attempt cost.
- **Unique** = share of layouts with exactly one solution (what the generator can keep).
- **Gradable** = of the unique ones, the share the `CalcLogicalSolver` can solve by pure logic
  (i.e. actually assignable a difficulty; the rest need guessing and are discarded).
- **Tier reached** = the hardest technique tier the logical solver needed.

Sample sizes 95–120 layouts per row; single-threaded, dev machine. Absolute ms are indicative,
the *ratios between rows* are the real signal.

---

## 2. 9×9 findings

### 2a. Big cages, no givens (`minSize 2`) — the hard-tier regime

| cage cap | verify avg / p95 / max | unique | gradable (of unique) | tiers seen |
|---|---|---|---|---|
| **maxSize 3** | 8.5ms / 28ms / 265ms | 26% | 65% | mostly T2, 1× T4 |
| **maxSize 4** | 114ms / 643ms / 715ms | 17% | 33% | all T2 |
| **maxSize 5** | 428ms / 1004ms / 1273ms | **3%** | **0%** | — (none gradable) |

- **maxSize 5 is a dead end.** Verify is ~50× slower than maxSize 3, only 3% of layouts are
  even unique, and the logical solver grades *zero* of those — they all require guessing. A
  generator here would spend seconds per attempt and reject ~100% of them.
- **maxSize 4 is expensive but not impossible** — 114ms average verify (p95 643ms), 17% unique,
  a third of those gradable. Workable for an **offline daily-cron** board; too slow for
  **interactive client-side `/play`** where a puzzle is generated on demand.
- **No tier spread.** Across all three caps the logical solver almost always finishes at
  **Tier 2** (naked/hidden pairs + cage-combo restriction). It essentially never needs Tier 3
  (line-sum) or Tier 4 (X-Wing) on 9×9.

### 2b. Same shapes but allow single-cell cages / givens (`minSize 1`)

| config | givens/board | verify avg / p95 | unique | gradable (of unique) |
|---|---|---|---|---|
| **maxSize 3** | 15.2 | 0.5ms / 2ms | 44% | **100%** |
| **maxSize 4** | 10.3 | 5.3ms / 18ms | 28% | 91% |

- **Givens rescue everything.** Dropping ~15 single-cell givens onto a maxSize-3 board takes
  verify from 8.5ms → **0.5ms** (17× faster), uniqueness 26% → 44%, gradability 65% → **100%**.
  Even at maxSize 4, ~10 givens make it fast (5.3ms) and 91% gradable.
- This is the crux: **feasibility is a function of givens, and difficulty is the inverse.** The
  easy end (many givens) is trivial for the engine; the hard end (0 givens) is exactly the
  slow, low-uniqueness, low-gradability regime in table 2a.

### 2c. Solver technique ceiling

`CalcLogicalSolver` implements four tiers and nothing above:

| tier | techniques |
|---|---|
| **T1** | cage arithmetic, naked single, hidden single |
| **T2** | naked pair, hidden pair, cage-combo restriction |
| **T3** | line-sum invariant |
| **T4** | X-Wing (rows/columns) |

There is **no T5** (forcing chains / AIC / multi-cage inference / bounded bifurcation). The
levers research (`keisan-difficulty-levers.md` §4) assumed a T5-gated Extreme tier for 9×9;
the solver can't express or detect one. And since real boards concentrate at T2 anyway, even
T3/T4 barely differentiate — the *technique ladder is not a usable difficulty axis on 9×9*.

---

## 3. What this means for a 9×9 ladder

A 5-tier ladder for parity with Classic/Killer **cannot** come from a technique ladder. The
only axes the engine actually offers are:

1. **Givens count** (many → 0) — by far the strongest lever, and the one that governs
   feasibility.
2. **Score band** (the existing `raw × densityFactor` weighted-sum score) — a continuous
   difficulty proxy that works *within* the T2 ceiling; this is already the primary gate at
   4×4/6×6.
3. **Cage cap 3 → 4** — makes top tiers look/feel chunkier, at a real generation-cost premium
   (offline-only for the top tiers).

Three shapes were on the table (none built — paused for research):

- **A — 5 tiers, top two allow maxSize 4.** Full parity ladder separated by givens + score
  band; Easy–Hard at maxSize 3 (interactive-fast), Expert/Extreme at maxSize 4 (daily-cron
  only). "Extreme" honestly means *hardest score-band we can grade*, not T5.
- **B — 5 tiers, all maxSize 3.** Fully interactive everywhere, but Expert/Extreme look less
  distinct from Hard (no big 4-cell cages).
- **C — 3 tiers now (Easy/Medium/Hard, like the minis), defer 5 until a T5 solver exists.**
  Cleanest, but no 5-tier parity with the other 9×9 variants yet.

**The research question A/B/C really turns on:** is there a cheap-enough T5-class technique (or
a *bounded* guess, e.g. ≤2-deep bifurcation counted as its own tier) that would (i) let the
solver grade 0-given / maxSize-4+ boards it currently discards, and (ii) create genuine
tier separation above T2? If yes, a real ladder opens up. If no, difficulty on 9×9 is
givens + score band, full stop, and the choice is A vs B vs C.

---

## 4. Known issues at the smaller sizes (recap)

These are already-shipped 4×4/6×6 behaviours, for context — the same difficulty model and its
limits carry up to 9×9.

- **Difficulty is score-band-primary, not technique-primary.** The logical solver's
  `hardestTier` concentrates at T1/T2 even on 6×6, so the primary tier gate is the two-factor
  **score band** (`raw × densityFactor`, HoDoKu-weighted-sum style), *not* the technique floor.
  The technique-floor gate is applied only lightly (hard only, `> T1`). The 9×9 data above is
  the same story, more extreme. This is the single most important thing to know before
  researching 9×9: **our "difficulty" is a score threshold, not a solve-path guarantee.**
- **6×6 hard has a punishing accept rate.** After stacking the shape + score-band gates, 6×6
  hard accepts only **~0.1%** of attempts. Mitigations already applied: `maxAttempts` raised
  4,000 → **40,000**, and the `minBentRatio` cage-shape gate **removed** (it ~halved yield for
  no measurable difficulty gain). Stable, but it means 6×6 hard generation is doing ~1,000
  rejected attempts per board. 9×9 hard (table 2a) is worse still.
- **Operator variety needs active weighting.** Left unweighted, hard boards drift to almost
  all `×`. Current hard weights `{ mul:3, add:2, sub:3, div:3 }` (A/B-tested) keep `−`/`÷`
  present (24/25 hard boards carry sub or div) while staying *slightly harder* than the old
  `×`-heavy mix — because the score band, not the operator, is what gates difficulty. Expect
  to re-tune these per-size for 9×9.
- **`− / ÷` are 2-cell-only** (multiset semantics for `+ / ×` cages; subtraction/division are
  defined only pairwise). Bigger cages therefore skew toward `+ / ×`, which interacts with the
  operator-variety point above as cage size grows.
- **4×4 is unproblematic** — fast, high accept rate, no special handling.

---

## 5. Open questions for research

1. **Cheap T5-class inference for Calcudoku.** Is there a known technique between "T4 X-Wing"
   and "full bifurcation" that (a) is detectable/implementable and (b) actually fires on
   0-given 9×9 boards? Candidates from the literature: cage/line intersection ("pointing"
   analogues on the Latin square), multi-cage combo elimination, or a *bounded* ≤2-deep
   guess-and-check scored as its own tier (Tatham's `keen` does something like this).
2. **Verify cost at low givens.** Uniqueness proving is the bottleneck at the hard end
   (428ms at maxSize 5). Is there a faster uniqueness check for boxless arithmetic-cage grids
   — better propagation before backtracking, cage-combo pre-filtering, symmetry breaking?
3. **Is maxSize 4 worth it?** It's the only way to make top-tier 9×9 boards look "chunky", but
   costs ~13× verify and drops gradability to ~33% (0-given) / 91% (with givens). Decide
   whether chunkiness is worth restricting those tiers to daily-cron generation.
4. **Givens as the primary difficulty axis.** If the ladder is fundamentally
   givens-count-driven, what givens counts map to which perceived difficulty on a 9×9 boxless
   grid? (Classic-Sudoku givens intuition doesn't transfer — no boxes, and cages already carry
   information.) This is a puzzle-design/playtest question more than an engine one.

---

## 6b. K7b result — bounded recursion works, but is a single step (the K7c fork)

The bounded-recursion "T5" (the keen.c transplant) is now built into `CalcLogicalSolver` (tiers 5/6:
depth-1 Nishio and depth-2), and measured. Result:

- **It works and is sound.** Of unique low-givens 9×9 boards, ~77% solve at T4 and ~23% are T4-stuck.
  **Depth-1 Nishio (T5) solves 100% of the T4-stuck ones, every solution verified correct** against
  the exact solver. Grading costs ~65 ms avg / ~450 ms p95 at maxSize 3.
- **Depth-2 never fires.** Across *both* maxSize-3 and maxSize-4 populations, every T4-stuck board
  that is solvable at all is solvable at depth-1. Not one board needed depth-2. (maxSize-4 T6 grading
  also costs p95 ~7 s — far slower, for no depth-2 payoff.)

**The fork this opens (K7c).** Guess *depth* was the plan's intended Expert↔Extreme separator
(depth-1 = Expert, depth-2 = Extreme). Since depth-2 doesn't occur, depth gives only **two** buckets
among 0-given boards: *needs a Nishio guess* vs *doesn't*. That's enough for **one** guess-gated tier,
not two. Options for a 5-tier 9×9 ladder — needs a decision before K7c builds:

1. **4 tiers, not 5** (the plan's stated contingency): Easy / Medium / Hard / **Expert = needs
   depth-1 Nishio**. Drop Extreme at 9×9. Honest and simple; breaks 5-tier parity with Classic/Killer.
2. **Count Nishio steps as the Extreme axis:** Expert = solvable with 1–k depth-1 guesses, Extreme =
   needs many. A continuous within-depth-1 axis; needs measurement that step-count is monotonic with
   real difficulty (it may just be noise).
3. **Score-band-split the T5 population:** Expert = T5 + lower two-factor score, Extreme = T5 + higher
   — but §2 already showed the score barely discriminates at 9×9, so this is weak.
4. **Add a real intermediate technique** (cage-region intersection / multi-line region-sum from the
   honest-ladder research §Q1) so more boards need *named* T3–T4 work, widening the pre-guess ladder
   and letting Expert/Extreme separate on technique before the Nishio backstop. Most work, most
   honest; effectively a K3 solver expansion.

Recommendation leaning: (1) now (ship a 4-tier 9×9), with (4) as the eventual upgrade if 5-tier
parity is wanted — because (2)/(3) dress up an axis the data says isn't there.

## 6. Reproducing

The measurements were one-off scripts (not committed). To regenerate: fill a Latin square with
`fillGrid`, carve with `generateCalcCageShapes(9, { minSize, maxSize })`, assign with
`assignCalcCages(shapes, sol, { activeOps: ['add','sub','mul','div'] })`, then time
`new CalcSolver(cages, 9).countSolutions(2, 500000)` and check
`new CalcLogicalSolver(cages, 9).solve().solved`. Vary `minSize` (1 vs 2 = givens on/off) and
`maxSize` (3/4/5) to reproduce tables 2a/2b.
