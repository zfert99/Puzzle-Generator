# Keisan (Calcudoku) — Implementation Plan

> **Status:** 🚧 In Progress — engine K0–K4 + core surfaces K5 shipped + a measured difficulty
> rebalance + Keisan minis in the daily rotation. Next up **K7 (9×9)**, then **K6 (No-Op / Mystery)**
> — order swapped so No-Op lands on top of the finished 9×9 tiers. K7 is itself **re-sliced** after
> a 9×9 de-risk measurement (see K7 below): **K7a ✅** (3-tier 9×9) → **K7b ✅** (bounded-recursion
> "T5" — built; measured that depth-2 never fires, so depth is one step, not a ladder) → **K7c ⏸**
> (Expert/Extreme ladder — blocked on a tier-shape decision, see K7c). Build log:
> [calcudoku/keisan walkthrough](keisan-walkthrough.md).
> **Research:** [kenken-engine-reference.md](research/kenken-engine-reference.md) ·
> [puzzle-grid-size-landscape.md](research/puzzle-grid-size-landscape.md) ·
> [kenken-plan-review.md](research/kenken-plan-review.md) (external review of THIS plan —
> verdict: GREEN) · [kenken-difficulty-calibration.md](research/kenken-difficulty-calibration.md)
> (keen.c/KSudoku/billabob difficulty levers — drove the difficulty rebalance) ·
> [keisan-difficulty-levers.md](research/keisan-difficulty-levers.md) (per-size lever tables) ·
> [keisan-9x9-feasibility-findings.md](research/keisan-9x9-feasibility-findings.md) (our measured
> 9×9 de-risk — three walls) · [9×9 honest-ladder research](research/compass_artifact_wf-feb5af89-67a1-51e8-bf2f-f348f76adfdd_text_markdown.md)
> (keen.c bounded-recursion "T5", uniqueness speedups, constructive generation — drove the K7 re-slice)
> **Pattern source:** the Killer plans — this plan reuses their slice/gate discipline and,
> deliberately, large parts of their code.

Keisan (this plan's older drafts call it "KenKen" / "Calcudoku"; same puzzle): fill an N×N **Latin
square** (1..N once per row and column — **no boxes**) partitioned into cages, each showing a target
and an operator (+, −, ×, ÷). **Naming decided:** the puzzle is displayed as **Keisan** (Japanese
計算, "calculation"), shown in menus as "Keisan" alongside "Classic" (Sudoku) and "Killer" (Killer
Sudoku), with a hub-card subtitle explaining it (e.g. *"calculation-cage puzzles — Latin squares
where the math is the clue"*). The engine module, symbols, and board `variant` slug stay the
descriptive **`calc`** — a deliberate slug-vs-display split kept to avoid churn; only the display
name is "Keisan". The **"KenKen" trademark** is held by KenKen Puzzle LLC (first filed 2007 by
Nextoy, LLC — Robert Fuhrer's company, NOT the inventor Tetsuya Miyamoto personally);
"Calcudoku"/"Mathdoku" are the established generic names, so "KenKen" is avoided in shipping
code/UI — sound risk avoidance, not legal advice.

## 1. What the research locks in (before any code)

- **Sizes: 4×4 (entry), 5×5, 6×6 (standard), 7×7 — 9×9 optional later.** Latin-square-only
  means ANY N ≥ 3 works, including primes — that's the structural difference from box
  Sudoku and it unlocks 5 and 7. NYT/Shortz's *canonical* product is 4×4/6×6 daily; the prime
  sizes 5/7 are an **ecosystem-wide** convention (calcudoku.org, KrazyDad "Inkies", Tatham's
  Keen, puzzle books), NOT specifically NYT's. Grid-size research recommends exactly this ladder
  and warns off 16×16+ ("long but shallow"). Start with **4 and 6** (mirrors our mini
  infrastructure), add 5/7 in a follow-up slice, hold 9.
- **The duplicate-in-cage rule changes the math.** Digits MAY repeat in a cage if not
  sharing a row/column — so cage-combination tables are **multisets**, not the Killer
  digit-set tables. This is the single most common source of solver bugs (research's
  words) and the reason K1 exists as its own gated slice.
- **Operator difficulty ordering ÷ < − < × < + is a DEFAULT PRIOR, not a strict total order.**
  The endpoints hold (2-cell ÷/− cages have tiny candidate sets; big + cages are the ambiguous
  ones), but candidate count depends jointly on (operator, target, cage size, N) — a `1−` on 6×6
  has five pairs, a `5−` has one, so − isn't uniformly easier than ×. Use the ordering to seed
  operator-mix tuning, but let **measured per-(op, target, size, N) combination counts** (exactly
  what K1's multiset tables compute) drive actual grading. Multiset-combo ambiguity is the real
  difficulty currency, not "arithmetic complexity".
- **Operator set is a first-class difficulty axis**: SingleOp (+ only) → DualOp (+− or ×÷)
  → QuadOp (all four) → **No-Op/Mystery** (operator hidden — uniqueness must hold across
  every operator interpretation; true hard mode, deferred to the last slice).
- **Subtraction/division are two-cell cages only** — a Shortz/NYT + KSudoku + Tatham's-Keen
  convention and a **safe design choice**, NOT a universal rule (calcudoku.org allows larger
  −/÷ cages under a "largest-first" convention). Enforcing 2-cell "by construction" sidesteps
  the non-associativity trap (`6−(4−1)=3` vs `(6−4)−1=1`) entirely. Single-cell cages are free
  givens — same difficulty lever we tuned for Killer, and one needing an explicit min/max band
  (below).
- **Techniques**: classic singles/pairs/X-wing carry over but on rows+columns only; the
  KenKen-specific tiers are prime factorization (×), line invariants (each line sums to
  N(N+1)/2 and multiplies to N! — the "Rule of 21 / Rule of 720" on 6×6), and cage-combo
  restriction (the E2 pattern transfers directly).
- **House rule override (same as Killer):** bitmask/MRV backtracking, NOT the research's
  DLX default (AGENTS.md §1). KSudoku proves a shared Killer/KenKen cage engine works; we
  already own most of it.
- **Boxless grids are a type/engine/API-level change, not a solver detail (codebase audit
  finding).** `GridSize = 4 | 6 | 9` is a *closed* union, and `getGridConfig` is a hard-coded
  3-entry record — both baked into ~10 files well outside the engine: the two API-route
  allowlists (`VALID_GRID_SIZES` in `api/puzzle/route.ts` + `api/solve/route.ts`), the
  `GridSizeSelector` UI (its own literal `4|6|9` union, independent of the type),
  `PlayExperience`'s per-variant size clamp, and — critically — the base grid renderer both
  the board (`Cell.tsx`) and PDF (`pdf.service.ts`) draw onto, which computes thick box
  borders and "box-peer" highlights straight from `boxWidth`/`boxHeight`. A boxless 5×5/7×7
  grid makes those fields meaningless, so the renderers draw phantom box lines/highlights
  unless gated. This is why **K0 exists as its own prerequisite slice** (below): 5 and 7 are
  KenKen's headline differentiator vs. Killer, and discovering this coupling piecemeal across
  K2/K3/K5 would mean redoing work.

## 2. What we already have (reuse map)

| Existing asset | KenKen reuse | Audit verdict |
|---|---|---|
| `cage-generator.ts` (region growing) | Drop the no-repeat eligibility check (repeats are legal); keep `minSize`/`maxSize`/`maxSizeBias` levers | Mostly holds — but the no-repeat check is *load-bearing for termination* (it's what lets a cage "box itself in" and stop); removing it needs a different growth stop (target size only) or cages run to `maxSize` every time. Verify in K2. |
| `cage-geometry.ts` + `CageOverlay` | Directly — geometry is fully box-agnostic (verified: no box assumption in `computeCageOutline`) | **Holds** for outlines. Label is NOT zero-touch: `Cage.sum`/`CageSum.value` are bare `number`; showing `12+`/`3÷` needs an operator-carrying field + a label-width recompute (`CageOverlay` sizes the mask gap off digit-string length). Small, but a real change. |
| PDF `drawKillerGrid` (`pdf.service.ts`) | Cage-outline half reuses directly; base grid-line half does not | **Claim was overstated.** Only the cage-outline loop is box-agnostic. The base-grid loop hard-codes `i % config.boxHeight === 0 ? thick : thin` — meaningless for boxless KenKen, and `getGridConfig(5\|7)` returns `undefined` today. Needs a variant-gated uniform-line branch (see K0 + K5). |
| Bitmask exact-solver skeleton (`killer-solver.ts`) | Pattern — new `kenken-solver.ts` with row/col masks only (no box mask) + per-cage multiset-combo pruning | Holds as *pattern-copy* (not direct reuse). `killer-solver` also carries `boxMask`, `boxIndex`, cage *no-repeat* via `candidateMaskExcluding`; KenKen drops the box mask and the exclusion (repeats legal), so the candidate/place/unplace logic is rewritten, not shared. |
| Logical-solver architecture (technique table, tiers, counts, openness, `disable`) | Pattern-copy — classic strategies constrained to rows/cols; KenKen technique rows added | Holds — but note `HumanSolver` genuinely **cannot** be composed (verified): its constructor infers boxes from `size` with a hardcoded 3×3 else-branch, so at size 5/7 it *silently* applies a bogus box constraint. KenKen needs its own row/col-only technique fns (K0 adds a `HumanSolver` size guard so this fails loud, not silent). |
| Two-factor scoring + disjoint bands + recalibration protocol | Directly — same `raw × density` scorer, KenKen weights, bands measured fresh per size | Holds. |
| Difficulty pipeline (shape gates → capped solve → necessity → band → budgeted verify) | Directly — proven twice now | Holds. |
| Daily-board registry (`daily-row.ts`) | Registry rows + a `variant: 'kenken'` | Registry *shape* holds (flat typed rows). But `variant`/`difficulty` unions are closed, `dailies.service.ts` dispatch is a binary ternary (KenKen falls through to the *classic* generator), and `toDailyPuzzleRow` duck-types `'cages' in puzzle` → misreads KenKen as Killer. Needs a real 3-way discriminant (K5). |
| Board store variant plumbing + hub card | `variant: 'kenken'`; cage-mate pencil stripping stays off (repeats legal); hub card goes live | Pencil-stripping is already variant-gated (`useBoardStore` line ~229) — correct as claimed. But `startNewGame` duck-types `'cages' in puzzle` → same Killer misclassification; `PuzzleVariant`/`BoardPuzzle` unions need extending (K5). |

## 3. Slices

### K0 — Boxless-grid foundation (prerequisite; codebase audit finding) ✅ Done

> **Shipped** on `feature/kenken`. Full write-up: [keisan-walkthrough.md](keisan-walkthrough.md).
> `GridSize` widened to `4|5|6|7|9`, `GridConfig` gained `hasBoxes` (row-strip sentinel for the
> boxless dims), `isValid`/`fillGrid` produce Latin squares at 5/7, both grid renderers gate box
> lines/peers on `hasBoxes`, `HumanSolver` throws on non-4/6/9, quota map made `Partial`, board
> store `persist` bumped 2→3. 248 tests green (9 new); Basic/Advanced benchmarks at historical
> best. The `4|6|9` UI/API pickers were deliberately left narrow — 5/7 is representable, not yet
> offered (that's K5).

The one slice that is *pure enabling refactor*, added after auditing the reuse claims against
the live code (§2 audit column). It exists because 5×5/7×7 — KenKen's differentiator — is not a
KenKen-module-local change: the `4|6|9` closed union and box assumptions leak into API
validation, UI, and both grid renderers. Doing it first means K2–K5 build on a size-open,
box-optional base instead of each rediscovering the coupling.

- **Widen `GridSize`** to include `5` and `7` (type + every exhaustive `Record<GridSize, …>`:
  `getGridConfig`, `diggers.ts` quotas — the latter classic-only, so it just needs the keys to
  compile, not real values). Decide 9×9 KenKen timing separately (research: optional cap).
- **Give `GridConfig` a boxless representation** — a `hasBoxes: boolean` (or optional
  `boxWidth`/`boxHeight`) so consumers can branch instead of computing garbage. For prime N
  (5, 7) there is no box tiling; `getGridConfig` must return a valid boxless config, not throw.
- **Gate the two grid renderers off boxes:** `Cell.tsx` (thick box borders + box-peer
  highlight) and `pdf.service.ts`'s base grid-line loop must skip box logic when
  `!hasBoxes` — uniform thin lines, row/col peers only. This is the fix the PDF-reuse claim
  actually needs.
- **Update the closed allowlists/UI:** `VALID_GRID_SIZES` in both API routes, the
  `GridSizeSelector` literal union + options, and `PlayExperience`'s per-variant size clamp.
  Sizes are still gated *per variant* (classic/Killer stay 4/6/9; KenKen gets its own ladder)
  — widening the type must not silently offer 5×5 *classic* Sudoku (impossible — no box tiling).
- **Add a `HumanSolver` size guard:** throw on an unsupported size instead of silently
  assuming 3×3 boxes (the current else-branch) — turns a KenKen prototyping landmine into a
  loud error. KenKen never calls `HumanSolver`; this just protects the classic path.
- **Gate:** classic 4/6/9 + Killer 6/9 fully regression-green (no behavior change); a boxless
  `getGridConfig(5)`/`(7)` returns a valid config; renderers verified to draw no box lines for
  a `hasBoxes: false` grid (unit + a manual visual check per the visual-check-handoff rule).

### K1 — Multiset cage-combination tables + operator model ✅ Done

> **Shipped** on `feature/kenken`. [`calc-types.ts`](../src/features/engine/calc/calc-types.ts)
> (operator model: `CalcOperator`, `computeTarget`, `operatorAllowedForCageSize`,
> `hasAssignableOperator` legality invariant, `CalcCage`) +
> [`calc-combinations.ts`](../src/features/engine/calc/calc-combinations.ts) (per-`(op, size,
> target, N)` multiset enumerator + union/guaranteed masks, lazy `(N, op, size, target)` memo). The
> two-layer split is explicit in code and docs: tables give arithmetic validity and
> over-approximate; masks are priors (union = upper bound, guaranteed = lower bound); the solver
> enforces geometry (K2). −/÷ two-cell by construction; `1÷` correctly empty (collinear). 27 tests,
> including the published `6×` 4-cell → `{1,1,1,6}`/`{1,1,2,3}` gate. Displayed as **Keisan**;
> engine module/symbols/variant slug stay the descriptive `calc`.

- `kenken-combinations.ts`: for each (op, target, cageSize, N) the candidate multisets and
  union/guaranteed masks. −/÷ restricted to size 2 by construction.
- **Two-layer check, made explicit (review recommendation).** The table answers *arithmetic
  multiset validity*; *geometric placement legality* (can the repeats actually land in distinct
  rows/cols given THIS cage's shape?) is a second, separate layer enforced at the solver's
  placement check. A straight domino/line cage cannot hold ANY repeat; only L/T/blocky shapes
  can. So the tables deliberately **over-approximate** (they don't know cage geometry) and the
  solver prunes — but this means the union/guaranteed masks are only valid *as priors*: for a
  line-shaped cage the mask over-counts (includes repeat-only multisets that geometry forbids).
  Document this so a future optimization doesn't trust the mask as exact for line cages.
- Table sizes are bounded (N ≤ 9, targets ≤ 9! = 362 880 for ×) — precompute per N like the
  Killer tables; memoized excluding-variants from day one (E1's lesson: memo or lose). Confirm
  the memo key (op, target, size, N) and integer types carry the largest × products cleanly, and
  document the lazy per-N build's worst-case time (a perf, not correctness, budget).
- **Gate:** exhaustive spot-tests against published examples (e.g. `6×` 4-cell → {1,1,2,3},
  legal only when the two 1s are non-collinear); table-size/perf budget documented.

### K2 — Exact solver + Latin-square generator ✅ Done

> **Shipped** on `feature/kenken`. [`calc-solver.ts`](../src/features/engine/calc/calc-solver.ts)
> (bitmask/MRV over rows+cols only, per-cage multiset pruning via K1 count-arrays + a node budget)
> and [`calc-generator.ts`](../src/features/engine/calc/calc-generator.ts) (`calcGridConfig` boxless
> config, region-growing `generateCalcCageShapes` with no no-repeat stop, `assignCalcCages` operator
> assignment with the legality-invariant assertion + `div`-integer check, `generateUniqueCalc`
> fill→cage→assign→uniqueness loop). **Key simplification:** the K1 "geometric placement" layer is
> free — same-row/col repeats are already forbidden by the Latin-square row/col masks, so the cage
> layer only enforces arithmetic. **Gate met:** 6×6 QuadOp uniqueness-verify **avg 0.038 ms** (< 50
> ms), 57.7% unique yield; 12 tests incl. fuzz-vs-independent-brute-force on 4×4. `CalcPuzzle` type +
> difficulty grading deferred to K3/K4.

- Latin-square fill (trivial vs Sudoku fill — no boxes). `fillGrid` (`grid-utils.ts`) keeps a
  `boxMask` alongside row/col masks; K0's `hasBoxes: false` must make that mask conditional so
  it produces a pure Latin square. A ~10-line standalone is the fallback if that proves awkward.
- **Cage generator termination (don't lean on target size alone — review recommendation).** The
  Killer generator relies on the *no-repeat eligibility* check to stop growth (a cage "boxes
  itself in" when every neighbor's digit is already used). KenKen has no such stop (repeats
  legal), so a random target size in `[minSize, maxSize]` becomes the growth bound — but that is
  *weaker* than the reference generators this plan cites. KSudoku layers a hard `maxSize` cap +
  a `maxCombos` ambiguity-reject + explicit `mMinSingles`/`mMaxSingles` bands, all wrapped in a
  DLX-uniqueness retry loop; Tatham's Keen uses a hard `MAXBLK = 6` cap plus whole-grid
  regeneration. Match that shape: **(1)** keep the hard `maxSize` cap (already in
  `cage-generator`), **(2)** add the single-cell-cage proportion band (K4), **(3)** re-test
  `maxCombos` as an ambiguity gate (K4), and **(4)** treat the K2 uniqueness verifier as the
  real termination backstop — regenerate the layout (or the whole grid) on non-unique. Confirm
  cages don't all run to `maxSize`; keep the `minSize`/`maxSizeBias` levers working.
- `kenken-solver.ts`: bitmask/MRV over rows+cols only (no box mask), with cage pruning via K1
  masks plus a placement-time repeat check (same-row/col duplicate legality). Node budget from
  day one. **The cage-multiset pruning intersected with the row/col masks is MANDATORY, not
  optional:** boxless = 2 constraining units/cell instead of 3, so naked/hidden-single cascades
  fire less and the search leans on cage pruning to avoid ballooning on 6×6+ QuadOp. The < 50 ms
  gate below is the tripwire — if it trips, strengthen candidate intersection before adding
  search heuristics.
- Operator/target assignment on the solved grid (KSudoku's `setCageTarget` pattern):
  operator chosen per cage from the active operator SET (difficulty axis), target computed.
  **Legality invariant:** every cage size present must have ≥1 assignable operator in the
  active set. −/÷ are 2-cell-only, so any cage ≥3 cells needs + or × available — a "− only" or
  "÷ only" set is unsatisfiable for big cages. The K4 ladder avoids this (easiest is SingleOp
  addition, which covers all sizes), but the assigner must assert it rather than assume it, or a
  future operator-set config silently wedges generation. Operator choice per cage is itself part
  of what the generate-and-test loop varies to hit uniqueness and the difficulty band.
- **Gate:** uniqueness verify < 50 ms avg at 6×6 QuadOp shapes; fuzz vs brute force on 4×4.

### K3 — Logical solver + difficulty tiers ✅ Done

> **Shipped** on `feature/kenken`.
> [`calc-logical-solver.ts`](../src/features/engine/calc/calc-logical-solver.ts) — its OWN candidate
> grid + row/col-only techniques (cannot compose `HumanSolver`: box-Sudoku-only, throws on 5/7).
> Tier ladder: **T1** cage arithmetic + naked/hidden singles (single-cell cages placed as givens);
> **T2** naked/hidden pairs + cage-combo restriction (multiset→cell matching with no-collinear-
> repeat); **T3** line-sum invariant (Rule of 21); **T4** X-Wing on rows/cols. `solve({ maxTier })`
> caps the ladder and reports `{ solved, hardestTier, techniqueCounts, passes, avgOpenSingles }` for
> the K4 scorer. **Gate met:** soundness fuzzed vs the K2 exact solver (no logically-placed digit
> ever disagrees with the unique solution, solved or not); gradable share **89–100%** across
> 4×4/6×6 × {QuadOp, +−, ×÷, add-only}. Hardest-tier distribution concentrates at T1/T2, so — like
> Killer — played difficulty will ride the two-factor score within a tier (K4). 4 tests + full suite
> 291 green.

- Tier ladder (provisional, measured before locking): T1 givens/singles + two-cell ÷ and −
  cage resolution; T2 pairs + × prime-factorization cages; T3 line invariants (sum/product
  "rule of 21/720") + cage-combo restriction (E2's Hall-check pattern); T4 X-wing-class on
  rows/cols + multi-line invariants.
- Same solve-result instrumentation (counts, passes, openness) feeding the shared scorer.
- **Gate:** soundness fuzz vs K2 (0 mismatches); gradable share measured per size/op-set.

### K4 — Difficulty configs + generation ✅ Done

> **Shipped** on `feature/kenken`. [`calc-score.ts`](../src/features/engine/calc/calc-score.ts)
> (two-factor `raw × density` scorer, Keisan weights) + `CalcPuzzle`/`CalcDifficulty` types +
> [`calc-sudoku.ts`](../src/features/engine/calc/calc-sudoku.ts) (`generateCalcSudoku` /
> `generateCalcBatch`, per-size difficulty configs, fill→cage→assign→shape-gate→logical-solve→
> score-band→uniqueness pipeline). **v1 = easy/medium/hard at 4×4 + 6×6** (QuadOp; SingleOp/DualOp/
> No-Op deferred). Difficulty rides the **two-factor score** (K3 showed the tier ceiling barely
> separates — most puzzles are T1/T2), with a min/max single-cell-cage band as the shape lever.
> **Bands measured + calibrated disjoint per size** (4×4: `<3.5 / [3.5,6.5) / ≥6.5`; 6×6:
> `<9 / [9,16) / ≥16`). **Gate met:** every band avg **1–2 ms/gen** (max ≤ 9 ms « 1 s), **0 fails in
> 40**, score ranges disjoint. 8 tests; full suite 299 green.

- Five-band product ladder built from the research's axes, e.g. easiest = 4×4 SingleOp(+),
  easy = 4×4 DualOp, medium = 6×6 DualOp, hard = 6×6 QuadOp, expert = 6×6/7×7 QuadOp with
  tight given/foothold budgets. **No-Op mode explicitly deferred** (needs
  uniqueness-across-interpretations verification — its own slice later).
- Shape gates (singles budget, two-cell-cage share, operator mix) + score bands placed on
  measured distributions per the recalibration protocol; stage-rate sweeps before
  end-to-end benchmarks (the Killer discipline, verbatim).
- **Explicit single-cell-cage proportion band — min AND max (review recommendation).** Too many
  single-cell "given" cages is a *documented KenKen generation failure mode* (trivial puzzles;
  CanCan rejects above a max proportion, KSudoku uses `mMinSingles`/`mMaxSingles`). Killer only
  ever needed a `maxSingles` cap; KenKen wants both bounds as a first-class difficulty lever, not
  an implicit side effect of cage growth. A *min* also keeps easy tiers from becoming givens-free
  and unexpectedly hard.
- **Re-fit bands per size, don't merely rescale (review recommendation).** Weaker 2-unit
  propagation means the *same* technique tier yields *fewer* forced moves at a given size, so
  band cuts must be measured fresh per (size, op-set), not derived by scaling 9×9/Killer cuts.
  4×4 band compression is expected (like 6×6 Killer).
- **Re-evaluate `maxCombos` (per-cage combination cap) for KenKen.** The Killer plan *tried and
  dropped* this lever (no-op at maxSize 3, fatal at 4). But the research flags it as KSudoku's
  primary difficulty knob, and KenKen's difficulty currency IS multiset-combo ambiguity — the
  Killer rejection was size-specific, so it may be the natural lever here where it wasn't for
  Killer. Measure it as a candidate gate before falling back to the foothold-count proxy.
- **Gate:** every band ≤ 1 s avg generation, 0 fails in 20, bands disjoint per size.

### K5 — Surfaces ✅ Done (play + PDF + hub + daily rotation)

> **Shipped** on `feature/kenken`: Keisan is **playable, printable, discoverable, and in the daily
> rotation**.
>
> - **Board (`/play`):** Classic/Killer/Keisan toggle, per-variant size lists (Keisan 4/6),
>   easy/medium/hard, `?variant=calc` deep link. Real 3-way `variant` discriminant in
>   `startNewGame` (replaces `'cages' in puzzle`); cages normalized to `BoardCage {id,cells,label}`
>   (operator labels `12+`/`3÷`); boxless config (row/col peers, no box borders); pencil-strip stays
>   Killer-only. `CageOverlay`/`cage-geometry` generalized to `LabeledCage`. Candidate-clearance CSS
>   extended to `data-variant='calc'`.
> - **PDF (`/generate`):** shared `drawCagedGrid` + `drawCalcGrid`/`generateCalcPDF` (boxless, operator
>   labels); `/api/generate` + PuzzleForm Keisan section. Verified end-to-end.
> - **Hub:** the "Coming soon" KenKen card is now a live **Keisan** card (`/play?variant=calc`) wearing
>   the `new!` sticker (moved off Killer).
>
> - **Daily rotation ✅:** a `calc` section in `DAILY_BOARDS` (`calc4-*` + `calc6-*`, 6 boards → 25
>   total) with per-board anti-cheat floors + tuned bot times; the daily path made **variant-safe**
>   (the duck-typed `'cages'` checks in `toDailyPuzzleRow`, `dailies.service` dispatch, and
>   `/api/daily` serving now key off the explicit `variant` / registry key); `StoredCage` widened to a
>   Killer|Calc union (no DB migration — jsonb); `useDaily` + the `/daily` picker + leaderboard tabs
>   gained a Keisan section; anti-cheat is variant-agnostic (`gridsMatch`). Boundary-unit-tested;
>   live DB round-trip runs via the daily cron / `db:seed`. See the walkthrough's "K5 tail" section.

- **Real 3-way discriminant first (audit finding).** Before any UI, replace the two
  duck-typed `'cages' in puzzle` checks — `useBoardStore.startNewGame` and
  `daily-row.toDailyPuzzleRow` — with an explicit `variant` tag, and widen
  `dailies.service.ts`'s binary `variant === 'killer' ? … : …` dispatch to a real switch.
  Otherwise a KenKen puzzle (which also carries `cages`) is silently misclassified as Killer
  (store/registry) or generated by the *classic* engine (dispatch fall-through). Extend
  `PuzzleVariant` + `BoardPuzzle` + `DailyBoard.variant`/`.difficulty` unions.
- `/play`: third variant toggle (Classic / Killer / KenKen), size + difficulty pickers;
  cage overlay labels show `target op`. Board store: `variant: 'kenken'`, cage-mate pencil
  stripping DISABLED for KenKen (repeats are legal!) — already variant-gated, so this is "don't
  add a `kenken` branch," not new logic. Label change per §2 (operator-carrying cage field).
- PDF: operator-aware corner labels; `/generate` section; sample booklet. Uses K0's boxless
  base-grid branch (no box lines for KenKen).
- Dailies: registry rows (`kenken4-easy` … `kenken6-expert` — exact set decided at K4) in
  a fourth picker section; per-board anti-cheat floors.
- Hub: the KenKen card goes live (deep link `/play?variant=kenken`); sticker moves per the
  established "newest thing wears new!" convention.
- **Gate:** full battery + in-browser verification, both themes, both sizes (visual check
  handed to the user per the visual-check-handoff rule — including a boxless 5/7 board if that
  ladder shipped).

### Difficulty rebalance ✅ Done (post-K5)

> Playtesting found even "hard" was givens-heavy and small-caged. Per
> [kenken-difficulty-calibration.md](research/kenken-difficulty-calibration.md), difficulty now
> rides **shape first** (givens → **hard ~1**; cage size → **6×6 hard `maxSize: 4`**; easy drops `×`)
> with the score band refining. New `maxFootholds`/`maxCombosPerCage` lever (the research's
> "quantitative core," which Killer had dropped — it earns its keep here because Keisan's multiset
> cages carry the ambiguity). Measured: `maxSize: 4` verifies ~0.2 ms avg on 6×6 (no Killer thrash);
> 6×6 hard now ~0.7 givens + ~3.4 four-cell cages/puzzle; bands re-cut disjoint; gate met. See the
> walkthrough's "Difficulty rebalance" section.

### K7 — 9×9 Keisan 📋 Next (re-sliced after a de-risk measurement)

**Why re-sliced.** A 9×9 de-risk (see
[keisan-9x9-feasibility-findings.md](research/keisan-9x9-feasibility-findings.md)) found three walls
that kill the original "just add a 5-tier ladder" plan: (1) **maxSize-5 cages are a dead end** —
verify time explodes ~50×, uniqueness craters to 3%, and our T1–T4 solver grades **zero** of them;
(2) the logical solver **effectively caps at Tier 2** on 9×9, so there is **no technique ladder** to
hang Expert/Extreme on; (3) **single-cell givens are load-bearing** — ~15 givens take a maxSize-3
board from 8.5 ms → 0.5 ms verify and 65% → 100% gradable, so difficulty *is* the inverse of givens
count and the 0-given hard end is exactly the slow, low-yield regime.

The [9×9 honest-ladder research](research/compass_artifact_wf-feb5af89-67a1-51e8-bf2f-f348f76adfdd_text_markdown.md)
resolves it: the missing "T5" is **not** a hand-coded technique but **bounded guess-and-check with a
counted recursion depth** — exactly how Tatham's `keen.c` produces its `EXTREME`/`UNREASONABLE`
tiers (their technique functions are literally `NULL`; the shared solver's recursion machinery does
the grading). That gives an honest, always-available difficulty axis on 0-given boards. The research
also confirms **maxSize 4 is not worth its ~13× verify cost** (real 9×9 Calcudoku is 2–3-cell-cage
dominated; Tatham caps at 6 and calls big cages "annoying") and that **score-band tiers are
industry-standard** (HoDoKu weighted-sum; calcudoku.org rates purely by empirical solve-rate) — *as
long as* we stop advertising the top tiers as pure-logic-solvable, which the bounded-recursion tier
then lets us do honestly (every board has a solve path: T1–T4 + ≤D guesses).

Three sub-slices, each independently shippable and gated:

- **K7a — 3-tier 9×9 (Easy/Medium/Hard), maxSize 3, givens + score band.** No new engine — it's the
  model already shipped at 4×4/6×6. Populates the (currently auto-hidden) top-level **Keisan** daily
  section, mirroring "Classic 9×9" / "Killer 9×9". Adding Expert/Extreme later is **additive** (new
  board keys, no rename/migration), so this commits us to nothing K7b/K7c must undo.
  **Gate:** ≥ 95% of accepted Hard boards gradable by current T1–T4; interactive p95 generation
  < 250 ms; ≥ 24/25 Hard boards carry a −/÷ cage (the existing A/B benchmark); disjoint bands.
- **K7b — bounded-recursion "T5" (the keen.c transplant). ✅ Done — with a plan-changing finding.**
  Built into `CalcLogicalSolver` as tiers 5/6 (depth-1 Nishio + depth-2), snapshot/restore rollback,
  a `hasContradiction` check (empty-cell OR fully-placed-cage mismatch), minimal-depth escalation, and
  a `guessNodeBudget`. Measured: ~23% of unique 0-given 9×9 boards are T4-stuck, and **depth-1 Nishio
  solves 100% of them, every solution verified correct**. **Depth-2 never fires** — on *both* maxSize-3
  and maxSize-4 populations, every solvable T4-stuck board solves at depth-1. So the depth axis is a
  **single step** (needs-a-guess vs not), exactly the contingency this slice flagged ("if depth-2
  isn't there, cap at depth-1"). The mechanism is committed and dormant-capable of depth-2 (for later
  sizes / No-Op), but 9×9 uses depth-1 only. **This opens the K7c fork below.**
- **K7c — the Expert/Extreme ladder ⏸ Blocked on a decision (K7b finding).** The plan was to split
  Expert/Extreme by guess-depth, but K7b measured that **depth-2 never occurs** — depth gives only one
  guess-gated tier, not two. So K7c can't be built as specified. The fork (documented with options in
  [keisan-9x9-feasibility-findings.md](research/keisan-9x9-feasibility-findings.md) §6b): (1) ship a
  **4-tier** 9×9 (Expert = needs depth-1 Nishio, no Extreme) — the honest, simple option; (2) count
  Nishio *steps* as an Extreme axis (needs monotonicity evidence); (3) score-band-split the T5
  population (weak — score barely discriminates at 9×9); (4) add a real intermediate technique
  (cage-region intersection / multi-line region-sum — a K3 solver expansion) so the pre-guess ladder
  widens. Whichever tier shape is chosen, Expert (+ Extreme if any) still generate **offline into the
  daily-cron pool** and carry the honest "solvable with logic plus at most one hypothesis step"
  guarantee. **Chosen direction: research option 4** — brief at
  [keisan-solver-technique-expansion-research.md](research/keisan-solver-technique-expansion-research.md)
  (widen the named ladder via pointing/claiming + multi-line region-sum; validate firing rate +
  monotonicity before building; fall back to option 1's 4 tiers if it doesn't pan out). **K7c build
  paused pending that research.**

**Deferred as optional perf work, not blockers** (from the research's Slices 1–2): GAC `alldifferent`
(Régin 1994) to speed uniqueness proving, and constructive **"dig-out"** generation (start gradable,
remove givens / merge cages toward the target band) to fix the ~0.1% hard accept rate. Because
Expert/Extreme live in the offline pool, slow generation there is tolerable — pull these in only if
cron latency actually hurts. 5×5/7×7 remain representable from K0 but stay out of scope.

### K6 — No-Op / Mystery mode 📋 After K7 (applies to the finished 9×9 tiers too)

An orthogonal **"Mystery" toggle** (selectable at any size/difficulty), NOT a 5th tier — matches the
research + kenkenpuzzle.com/calcudoku.org practice ("surface it as its own labeled mode"). Sequenced
**after** K7 deliberately: No-Op then lands on top of the whole finished ladder (including 9×9
Expert/Extreme), instead of being redone when those tiers arrive. The cage shows only a target; the
solver must deduce the operator too (3+ cells ⇒ + or ×). Real engine work, not a flag: (1) exact-solver
cage pruning that **unions candidate multisets across every operator a target admits**, plus
**uniqueness across all operator interpretations**; (2) a new logical-solver **operator-deduction
technique** so no-op puzzles stay gradable/human-solvable; (3) generation that rejects
operator-ambiguous puzzles. Rendering is trivial (the cage label is already a string — just omit the
operator). Its own uniqueness + gradability gates.

## 4. Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | Multiset tables explode at 9×9 × (× targets up to 362 880) | Ship 4/6 first; tables per-N lazy; × targets sparse — index by factorization, measure before 7/9 |
| 2 | Repeat-legality bugs (the research's #1 bug source) | Enforced at ONE place (solver placement check); fuzz 4×4 exhaustively vs brute force |
| 3 | Trademark ("KenKen") | Neutral product name decided at K1; research doc keeps the descriptive term |
| 4 | Difficulty bands compress at 4×4 (like 6×6 Killer) | Expected; measured cuts, honesty over ladder-padding |
| 5 | Cage-mate pencil stripping wrongly applied to KenKen | Already variant-gated in `inputDigit`; add `kenken` to the union WITHOUT a stripping branch; regression test |
| 6 | `GridSize` widening silently offers impossible 5×5/7×7 *classic* Sudoku | Sizes gated per-variant in the pickers, not by the type alone (K0); classic/Killer stay 4/6/9 |
| 7 | Duck-typed `'cages' in puzzle` misclassifies KenKen as Killer (store, registry, dispatch) | Real `variant` discriminant + 3-way generation switch, landed at the top of K5 before UI |
| 8 | Boxless renderers draw phantom box lines/peer highlights | K0 gates `Cell.tsx` + PDF base-grid loop on `hasBoxes`; manual visual check on a 5/7 board |
| 9 | Cage-generator loses the no-repeat growth stop | maxSize cap (kept) + single-cell band (K4) + `maxCombos` ambiguity gate (K4) + uniqueness-driven regeneration as the backstop (K2) — the KSudoku/Keen pattern, not target size alone |
| 10 | Boxless = 2 units/cell not 3 → Latin-square deduction is *weaker* than Sudoku (research §3), so cages must carry more constraint; uniqueness-reject rate may run higher than Killer at the same cage density | Expected per research; cage-multiset pruning is mandatory (K2); measure yield at K2 and let K4's shape gates (denser/tighter cages) absorb it — don't assume Killer's cage-density tuning transfers |
| 11 | Save/resume must round-trip KenKen (cages + operators); numpad/maxNum for 5/7 | Numpad already config-driven (`config.size`) — free once K0 widens config; `useSavedGame` persists `variant`, so extend its serialized puzzle shape with the operator-carrying cage field |
| 12 | Too many single-cell "given" cages → trivial puzzles (documented KenKen failure mode) | Explicit min/max single-cell proportion band in K4, both as a correctness guard and a difficulty lever (CanCan/KSudoku pattern) |
| 13 | Geometric feasibility ≠ arithmetic validity: masks over-count for line-shaped cages (a line cage can't hold repeats at all) | Two-layer check (K1): arithmetic multiset table → placement-time geometric legality; masks documented as priors, never trusted as exact for line cages |
| 14 | Users expect difficulty labels comparable ACROSS sizes; a "hard 5×5" may not sit between hard 4×4 and hard 6×6 | Bands re-fit (not rescaled) per size (K4); set the user-facing expectation that labels are per-size, not a cross-size ranking |
| 15 | No-Op/Mystery mode (deferred) multiplies uniqueness cost — must verify across EVERY operator interpretation per cage | Correctly deferred to its own slice; roadmap carries the future cost so it isn't rediscovered as "just another operator set" |
| 16 | 9×9 top tiers are score-band cuts, not pure-logic solve paths (T1–T4 grades ~0% of 0-given boards) — labeling one "Expert, logic-only" when it needs a guess erodes player trust and makes timed leaderboards noisy/unfair | K7b bounded-recursion "T5" gives every accepted board a guaranteed path (T1–T4 + ≤D guesses); state the honest guarantee in copy; calibrate bands against real solve data, not an absolute clue count |
| 17 | 9×9 hard-tier generation is slow + low-yield (0-given verify ~50× slower; ~0.1% accept at the narrow band) | Restrict Expert/Extreme to the **offline daily-cron pool** (K7c) so latency is decoupled from interactive play; optional Régin GAC + constructive dig-out generation only if cron latency hurts |

## 5. Definition of done (v1)

4×4 + 6×6 KenKen: unique, difficulty-banded (measured cuts), operator-set-aware, playable
on `/play` with cage overlay + operator labels, printable, in the daily registry, full test
battery green, mirrored docs synced, roadmap flipped. K0's boxless foundation landed with
classic/Killer fully regression-green (no behavior change). If the 5/7 ladder shipped in v1,
boxless boards verified visually; otherwise K0 still lands (it's the enabler) but the 5/7
picker options stay behind the follow-up slice.
