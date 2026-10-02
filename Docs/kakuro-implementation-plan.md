# Kakuro (Cross Sums) — Implementation Plan

> **Status:** 🚧 In progress (plan written 2026-09-11; build started 2026-09-30 — V0
> [#104](https://github.com/zfert99/Puzzle-Generator/pull/104) and V1
> [#108](https://github.com/zfert99/Puzzle-Generator/pull/108), V2
> [#109](https://github.com/zfert99/Puzzle-Generator/pull/109) and E1
> [#110](https://github.com/zfert99/Puzzle-Generator/pull/110) and the review follow-up
> [#111](https://github.com/zfert99/Puzzle-Generator/pull/111), E2a
> [#112](https://github.com/zfert99/Puzzle-Generator/pull/112) and its review follow-up
> [#113](https://github.com/zfert99/Puzzle-Generator/pull/113), E2b
> [#114](https://github.com/zfert99/Puzzle-Generator/pull/114) and its review follow-up merged
> 2026-10-01 — the full easy→extreme ladder is served at both sizes; E3 (yield spike)
> [#116](https://github.com/zfert99/Puzzle-Generator/pull/116) — mini = 6×6, repair-not-retry,
> density ≥ 35% at 9×9, 13×13 deferred; review follow-up 4 (two-way g-link, extremes re-baked)
> [#117](https://github.com/zfert99/Puzzle-Generator/pull/117); V3 (PDF)
> [#118](https://github.com/zfert99/Puzzle-Generator/pull/118) and its review follow-up
> [#119](https://github.com/zfert99/Puzzle-Generator/pull/119); E4 (generator)
> [#120](https://github.com/zfert99/Puzzle-Generator/pull/120) and its review follow-up
> [#121](https://github.com/zfert99/Puzzle-Generator/pull/121); E5
> [#122](https://github.com/zfert99/Puzzle-Generator/pull/122) and its review follow-up
> [#123](https://github.com/zfert99/Puzzle-Generator/pull/123) and
> [#124](https://github.com/zfert99/Puzzle-Generator/pull/124); R1 (daily rotation at four
> types) [#125](https://github.com/zfert99/Puzzle-Generator/pull/125) and its review follow-up
> [#126](https://github.com/zfert99/Puzzle-Generator/pull/126) — **every slice done**) · **Branch:** one per slice off
> `main` (`feature/kakuro`, `-v1`, `-v2`, `-e1`, `-review-1`, `-e2`, `-review-2`, `-e2b`,
> `-review-3`, `-e3`, `-review-4`, `-v3`, `-review-5`, `-e4`, `-review-6`, `-e5`, `-review-7`,
> `-review-8`, `-r1`, `-review-9`) ·
> **Roadmap:** Phase 10 in [roadmap.md](roadmap.md)
> **Running log (decisions · gaps · bugs · learnings):** [kakuro-log.md](kakuro-log.md) — every
> `D#` / `G#` referenced below lives there with its current status.
> **Research:** [kakuro.md](research/kakuro.md) (the deep report this plan is built from) ·
> [kakuro-research-gaps-findings.md](research/kakuro-research-gaps-findings.md) (answers to G1–G5
> and G7–G10, received 2026-09-11 — **flipped D5** from bounded T&E to chains and made T4 a
> chain-depth rung; see §1b) ·
> [keisan-9x9-honest-ladder.md](research/keisan-9x9-honest-ladder.md) (the bounded-recursion
> top-tier pattern this plan *originally* proposed to transplant — now rejected for the published
> ladder, kept only as the model for an optional experimental tier) ·
> [keisan-9x9-feasibility-findings.md](research/keisan-9x9-feasibility-findings.md) (the de-risk
> pattern E3 copies) · [daily-redesign-plan.md](daily-redesign-plan.md) (how a new type registers
> into the daily) · [puzzle-grid-size-landscape.md](research/puzzle-grid-size-landscape.md)
> **Sibling plans (the shape this one copies):** [kenken-implementation-plan.md](kenken-implementation-plan.md),
> [killer-6x6-implementation-plan.md](killer-6x6-implementation-plan.md)

This is a **living handoff document** (AGENTS.md → Living Planning Docs). Each slice carries its
spec now and gains a **step-log** (process · learnings · blockers) when it lands. Cross-cutting
decisions, research gaps, bugs, and measurements go in the [running log](kakuro-log.md), not here,
so this doc stays a plan and the log stays a record.

## 1. What the research locks in (before any code)

Kakuro is a **genuine fourth puzzle type**, not a cage variant. There is no row, column, or box
constraint at all — the only constraints are, per *run* (a maximal horizontal or vertical strip of
white cells), **sum = clue** and **all-different**. Digits are always 1–9 regardless of grid size.
That single fact drives almost every divergence from the Killer/Keisan machinery below.

- **Naming.** Every U.S. "KAKURO" filing is dead (five applications, all abandoned 2007–2009;
  Nikoli's live U.S. marks are for "NIKOLI"), and the EU bare-word application was **refused** for
  non-distinctiveness in 2006. The one live mark is **Japan** (「カックロ/KAKURO」, Nikoli, actively
  asserted). "Cross Sums" (Dell, 1966) is the fully generic fallback. Ship as **"Kakuro (Cross
  Sums)"** for a US/EU-facing product, keep "Cross Sums" wired as a one-constant fallback title,
  never imply Nikoli affiliation → **D1** (G1 resolved; not legal advice — re-check TSDR/eSearch
  before any paid marketing push).
- **Generation ≫ solving.** Finding-another-solution is ASP-complete (Yato–Seta 2003), so uniqueness
  verification is the expensive step. Naive random generation is *empirically hopeless* even at
  10×10 (Mathimagics' best random attempt still had 3,676 solutions). The only tractable shape is
  **solution-first**: symmetric black-cell layout → valid digit fill → derive clues → verify with a
  counting solver that early-terminates at the 2nd solution. **Black-cell density is the dominant
  statistical lever** for both uniqueness and difficulty.
- **Difficulty does not scale like Sudoku.** It rides run-length / combination-space structure,
  not clue count: a dense 6×6 can be fiendish, a 24×14 can be singles-only yet take hours. So tiers
  are calibrated **within** a grid size (the Keisan principle — already proven in this repo), and
  the label is assigned **from the technique classifier post-generation**; generator parameters
  only *bias* toward a tier → **D8**.
- **The combination table is tiny.** 2⁹−1 = 511 non-empty subsets of {1..9}; grouped by length the
  counts are 9, 36, 84, 126, 126, 84, 36, 9, 1. The whole `(length, sum) → {combos, union mask}`
  table is a build-time precompute. Régin-style GAC for all-different is *overkill*: the
  combination-mask method already gives per-run GAC at length ≤ 9.
- **Technique ladder (easiest → hardest):** unique combinations → intersection → naked/hidden
  singles → pairs/triples → min/max (sum-based) elimination → residual sums → limited-solution-set
  reasoning → locked candidates → **chains: whips / g-whips by depth** (Berthier). **Surface /
  disconnection sums** (the Kakuro analogue of innies/outies — there is no clean "45 rule") are
  cheap to detect (articulation points of the white-cell graph) but Berthier measured that they
  *rarely* lower the whip rating of real hard puzzles, so they are an **accelerator, not a rung**.
  Community consensus: fair puzzles are **logic-only**; T&E-requiring puzzles are curiosities.
  **Commercial hardest tiers (ATK Hard, Conceptis Black Belt / Absolutely Nasty) are
  chain-solvable without T&E** — so a bounded-guessing top tier would mislabel them → **D5**.
- **Grid conventions.** Runs are length 2–9 (never 1). Every white cell is in both an across and a
  down run. The white region is connected. 180° rotational symmetry is the aesthetic norm.
  **Name puzzles by interior playable area** (a "9×9" has a 9×9 white-region bounding box; the dead
  clue row/column does not count) — some sites count it, which confuses users → **D2**.
  Mathimagics' uniqueness table bounds any template: at interior N = 6 / 9 the **max white cells**
  are 24 / 59 and the **min interior hint cells** 1 / 5 (full table in the findings doc, G10).
- **Size guidance.** ≤ 5×5 is trivial (tutorial only). 6×6–7×7 supports Easy–Medium honestly;
  genuinely-hard 6×6 verges on T&E. **8×8–10×10 is the sweet spot** for a full ladder; 13×17 /
  16×16 are the classic print sizes. Sizes are chosen **for Kakuro** (owner rule **D11**: every
  type gets its own mini / standard / large), not inherited from Sudoku's 4/6/9 → **D6**, gap
  **G6**.
- **Instrumentation that proves a tier** (Mathimagics + Berthier): white-cell count (NCELL), max
  run length (MRL), average cell run length (ACRL), black-cell density, run-length histogram,
  unique-combination run count (`fixed`), cells solved by iterated shaving (`implied`), post-shaving
  average possible-values-per-cell (`rating`), the ordered technique list, max technique level, and
  guess count (must be 0 at every published tier).

### 1b. What the gap-findings changed (2026-09-11)

The [findings doc](research/kakuro-research-gaps-findings.md) answered nine of the twelve gaps.
The deltas that reshaped slices, in priority order:

1. **Top tiers are chains, not bounded T&E (G5 → D5 flipped).** Berthier ran hundreds of ATK
   "hard" puzzles through KakuRules: all whip/g-whip solvable; Conceptis "Absolutely Nasty" is
   mostly singles-only at scale; Black Belt reviews confirm "pure logic". The Keisan transplant
   would over-rate large-but-easy puzzles and label guess-required puzzles no publisher ships. E2
   now builds a **whip engine** (Berthier's model: redundant per-run combination variables turn
   the non-binary sum constraint into binary ones that chain rules can walk).
2. **T4 is defined by chain depth, surface sums are an accelerator (G4).** The algorithm is
   trivial — articulation points (1-cuts) of the white-cell adjacency graph; the cut cell's value
   is (sum of across clues spanning the region) − (sum of down clues) — but a tier defined by
   "needs a surface sum" would be sparsely populated and collapse into T3. Implement 1-cuts;
   define the rung by whip length.
3. **Layout generation has a concrete procedure and static rejection rules (G3, G10).** The
   six-step edges-inward method (below, E4) plus: reject any *contiguous* all-white rectangle of
   size ≥ 2×9, 3×8, 4×7 or 5×5 (guaranteed sum-preserving swap cycle) and honour the min-hints /
   max-blanks table before ever running the counting solver.
4. **Calibration inputs (G8, G9).** Tier *definitions* follow Simonis: the weakest propagation /
   technique level that finishes **search-free**. Tier *cuts* are calibrated against Mathimagics'
   ATK table (Easy: rating 1.0 + high `fixed`%; Hard: rating > 1.1, or large grid with very low
   `fixed`%). Rating alone ≠ human difficulty — combine with cell count and `fixed`%.
5. **Floors and bots by cell count, not rating (G2).** No Kakuro telemetry exists; the Sudoku
   analogue and forum anecdotes put a hard 9×9 at ~10+ min for skilled solvers and a record
   density near 0.8 s/cell. Anti-cheat floors go *well below* record density; tune from live
   attempts.
6. **Rendering + a11y conventions are now specified (G7):** diagonal clue split with the
   **upper-right triangle = down sum, lower-left = across sum**; WAI-ARIA grid with read-only clue
   cells announcing both sums; roving tabindex skipping blockers; print with heavier outer border,
   shaded clue cells, answers on a separate page.

Still open after the findings: **G6** (6×6 Hard separability — E3 measures it), **G11** (D4, the
owner's call), **G12** (combination helper — a product decision).

## 2. What we already have (reuse map)

Surveyed 2026-09-11 against `main` (`99b87ee`). "Reuse" means import or copy the pattern; "new"
means Kakuro needs its own.

| Area | Existing | Kakuro | Notes |
|---|---|---|---|
| Sum-combination table | `killer/cage-combinations.ts` — `combosFor(size, sum, maxDigit)`, `candidateMaskFor`, `guaranteedMaskFor`, `candidateMaskExcluding` (distinct digits, memoized) | **Reuse candidate** | This *is* the Kakuro `(length, sum)` table at `maxDigit = 9`. E1 verifies coverage for lengths 2–9 and either re-exports or wraps it; do not write a second table. |
| Exact solver | `killer-solver.ts` / `calc-solver.ts` (bitmask + MRV + node budget) | **New** (`kakuro-solver.ts`) | No row/col masks exist in Kakuro — the pruning unit is the run, not the house. Copy the MRV + node-budget + early-exit-at-2 *shape*, not the code. |
| Logical solver + grading | `KillerLogicalSolver`, `CalcLogicalSolver` (tiered techniques, `SolveResult` with technique histogram), `scoreKillerSolve` / `scoreCalcSolve` two-factor scorers | **New** solver, **reuse** the scorer pattern | Technique names differ entirely; the *result shape* (tier, techniques[], steps, guess count) and the Stuart-style weighted-sum × opportunity-density scorer transfer. |
| Bounded-recursion top tier | `CalcLogicalSolver` T5/T6 (depth-1 Nishio; guess-step count as a monotone axis — K7b–K7d) | **Not reused** for the published ladder | **D5** flipped on G5: commercial Expert/Extreme Kakuro is chain-solvable, so the published tiers are whips by depth (E2). The snapshot/contradiction shape may still back an optional, clearly-labelled *experimental* "beyond published" tier — never in the daily. |
| Chain engine | Nothing in-repo walks chains over non-binary constraints; the classic `HumanSolver` AIC/ALS code is house-based | **New** (`kakuro-chains.ts`) | Berthier's CSP-Rules/KakuRules model: redundant per-run combination variables (`hrc`/`vrc`) make sum constraints binary, then bivalue-chains → whips[n] → g-whips. The single biggest engineering unknown in the plan (Risk 8). |
| Layout / fill generator | `cage-generator.ts` region growing; `grid-utils.fillGrid` | **New** (`kakuro-layout.ts`, fill inside `kakuro-generator.ts`) | Cage growing is the wrong primitive; Kakuro needs a symmetric black-cell template generator plus a run-all-different DFS fill. |
| Generate-and-grade pipeline | `generateKillerSudoku` / `generateCalcSudoku`: fill → constrain → reject non-unique → grade → band → accept | **Copy the shape** (`kakuro.ts` → `generateKakuro`) | Including the K-lesson "grade before uniqueness when deductions are sound" — check whether it applies (sound completion ⇒ unique). |
| Benchmarks | `benchmark-calc.ts` + `benchmark-log.appendBenchmarkRows` | **Reuse** (`benchmark-kakuro.ts`) | Randomized inputs, one row per tier, appended to `benchmark-logs.md`. |
| Board store | `useBoardStore`: `PuzzleVariant`, `BoardPuzzle` union, `BoardCage {id, cells, label}`, `cellToCage`, `computePeers` (row/col/box), Killer-gated pencil stripping | **Extend** | `'kakuro'` joins the union. Peers become **run-mates** (a new peers builder — `computePeers` is house-based and wrong here). Pencil stripping on placement is *correct* for Kakuro (no repeats in a run) — gate it on `variant === 'kakuro'` alongside Killer. |
| Board rendering | `Board.tsx` / `Cell.tsx` (`hasBoxes` gate, givens, peer/cage highlight), `CageOverlay` | **Extend + new** | Kakuro has no cage outlines and no givens; it has **blocked cells** (black) carrying up to two clues, and a clue **gutter** for edge runs (D2). New: a clue-cell renderer; blocked cells are non-selectable and skipped by keyboard navigation. |
| Numpad | `Numpad.tsx` — digits `1..config.size`, "all placed" from `config.size` | **Change** | Kakuro digits are 1–9 at every size. Drive the numpad from `config.maxNum` (already on `GridConfig`) and set a Kakuro config `{ size: N, hasBoxes: false, maxNum: 9 }`. The "digit exhausted" counter has no meaning in Kakuro — disable per variant. |
| Solved check | `nextGrid.every(... v === solution[r][c])` | **Free** | Cell-for-cell match; with black cells encoded identically in grid and solution (D3) it needs no change. |
| Rules dialog | `RulesDialog.tsx` — `VARIANT_TITLE` + `RulesBody` per variant, `hasSeenRules(variant)` | **Extend** | One new body; the "Cross Sums" subtitle and the interior-size convention belong here. |
| Save / resume | `useSavedGame` persists `variant` + puzzle | **Extend** | Serialized puzzle gains `runs`; round-trip test. |
| PDF | `pdf.service.ts` — `drawGrid`, `drawCagedGrid` (Killer/Keisan), `generateKillerPDF`/`generateCalcPDF`, shared nav helpers (bookmarks + puzzle↔answer links) | **New renderer, reuse nav** | `drawKakuroGrid` (black cells, diagonal clue split, gutter) + `generateKakuroPDF`. |
| APIs | `/api/puzzle` + `/api/generate` switch on `variant` | **Extend** | One more branch each; Zod validation of sizes per variant. |
| Hub | `PuzzleHub.tsx` — `PuzzleCard` with `href` (live) or without (coming soon); `new!` sticker convention | **Extend** | A Kakuro card; sticker moves off Keisan ("newest thing wears new!"). |
| Daily registry | `daily-row.ts`: `Variant`, `VARIANTS`, `DailySize = 4 \| 6 \| 9`, `PROFILE[(variant,size,difficulty)]`, `isEligible`, `rollDailyAssignment` (standard: `VARIANTS.length` distinct rungs; minis: `PERMS_3` over exactly 3 slots, size by difficulty), `MINI_KEYS` (3 keys) | **Extend + generalize** | The 4th type trips the plan's own "open scaling question": 3 mini slots vs 4 types → **D4**. Sizes become a per-type table (**D11**) instead of the global 4/6/9. `schema.ts` `variant` is a `text` column with a `$type` union — **no migration** to widen. |
| Daily storage | `daily_puzzles.cages` (untyped jsonb; `StoredCage` = Killer `{cells,sum}` \| Keisan `{cells,op,target}`) | **Reuse** | A Kakuro run is structurally a Killer cage: `{ id, cells, sum }`. Store runs in `cages`; the row's `variant` says how to read them. No migration (same trick Keisan used). |
| Daily surfaces | `dailies.service.ts` dispatch, `/api/daily` serve, `useDaily`, `slot-display.VARIANT_LABEL`, picker + leaderboard tabs, `seed.ts` | **Extend** | One label, one dispatch branch, one hook branch. |
| Anti-cheat | `gridsMatch`, `isImplausiblyFast` via `PROFILE` floors, `(key, variant, size)`-scoped bests | **Free + tune** | Floors/bot times for every eligible Kakuro combo → **G2**. |
| Hint agent (MCP over `HumanSolver`) | Classic only | **Non-goal** | Recorded so it isn't rediscovered as "just add a variant". |
| E2E | `e2e/play.spec.ts` per-variant specs | **Extend** | One Kakuro play spec (blocked cells, clue render, 1–9 numpad at 6×6, board starts empty). |

## 3. Locked and proposed decisions (summary — details and status in the log)

| # | Decision | Status |
|---|---|---|
| D1 | Display **Kakuro**, subtitle **Cross Sums**; engine/slug `kakuro`; "Cross Sums" wired as a **one-constant fallback title** (Japan mark is live; US dead, EU refused) | Locked (G1 resolved; re-verify TSDR/eSearch before paid marketing) |
| D2 | **Interior N×N storage + explicit runs list**; clue cells render in a one-cell gutter (top + left) plus inside interior black cells. `grid.length === N` stays true everywhere (`DailySize`, profile lookup, board config) | Locked by owner 2026-09-30; applied in V1 |
| D3 | Black cells are `0` in both `grid` and `solution`; **blocked = "in no run"**, derived from `runs` at game start (like `cellToCage`). No `-1` sentinel leaks into `Grid` consumers | Locked by owner 2026-09-30; applied in V1 |
| D4 | Daily at 4 types: **keep 3 mini slots and roll 3 of the 4 types** each day; a mini slot holding a type is played at **that type's mini size** (D11), so the "easy/medium = 4×4, hard = random(4/6)" rule is retired for types with a single mini size | **Locked by owner 2026-10-01** (3 mini slots, 3 of 4 types); applied in R1 |
| D5 | ~~T5 = bounded depth-1 recursion (Keisan transplant)~~ → **Every published tier is logic-only. T1–T3 by the technique ladder; T4 = whips of bounded length; T5 = longer whips / g-whips.** Surface sums (1-cuts) are an accelerator inside T4+, not a rung. Bounded T&E survives only as an optional, labelled *experimental* tier outside the daily | **Superseded 2026-09-11 by G5** — D5′ (log) applied in E2b and confirmed by owner 2026-10-01 |
| D6 | **Three sizes, chosen for Kakuro, not inherited from Sudoku:** mini = **6×6** (E3: carries the full ladder incl. expert/extreme with chains, repairs to unique in 3–10 ms; 7×7 stays on `/play` as a second size), standard = **9×9**, large = **13×13 on paper — deferred** (E3: the repair objective is too slow there; needs its own measured approach before it ships anywhere). **No 4×4.** | E3 measured 2026-10-01 — mini and large settled by measurement; confirmed by owner 2026-10-01 |
| D11 | **Sizes are per puzzle type.** Each type ships three: the smallest size that is genuinely interesting for *that* puzzle, its standard size, and a large size. Minis in menus and the daily are "the type's smallest size", not a fixed 4×4/6×6. Kakuro is the first type built this way; revisiting Classic/Killer/Keisan under the same rule is deferred (4×4 is trivial for most of them) | Locked by owner 2026-09-11 (principle); Kakuro sizes per D6 |
| D12 | **Build order is visual first, simplest → hardest:** a hand-baked puzzle is playable and printable (V1–V3) before any engine code; each engine slice lands on that board and is judged by what it makes visible. The **hub card goes live only at E5** (when "New puzzle" is real); until then `/play?variant=kakuro` is reachable by URL for building and E2E, so `main` never advertises a one-puzzle type. *Amended 2026-09-30: a looks-only static board (V0, at the unlinked workbench route `/kakuro`) precedes V1* | Locked by owner 2026-09-11 (order), amended 2026-09-30; hub card live 2026-10-01 (E5) |
| D7 | Roadmap: **Phase 10**, engine-first like Phase 6/8 | Applied (this PR) |
| D8 | Difficulty label comes from the classifier **post-generation**; generator parameters only bias | Locked (research) |
| D9 | Shipped layouts are **180° rotationally symmetric**, white-connected, runs 2–9, no *contiguous* all-white rectangle ≥ 2×9 / 3×8 / 4×7 / 5×5, and within Mathimagics' min-hints / max-blanks bounds per size | Locked (research + G10) |
| D10 | **Guess count = 0 at every published tier**, Expert and Extreme included (they are chain rungs). Copy says "solvable by logic alone" everywhere; only an experimental tier, if ever built, carries a "may need trial and error" label | Locked (tightened by G5) |

## 4. Slices — visual first, then the engine underneath

**Build order is simplest → hardest, and the page exists before the engine does** (owner,
2026-09-11, for learning purposes). A hand-baked Kakuro is playable on the real board first; each
engine slice then lands *on that board* and is judged by what it makes visible — a hint that comes
from a real solver, a difficulty badge that comes from a real classifier, a "New puzzle" button
that comes from a real generator. The K7 lesson (measure before you build a generator) is kept:
the yield spike still runs before any generator code, it just no longer blocks the board.

Each slice is its own PR gated by the AGENTS.md Pre-Merge / Pre-PR Checklist. Spec and step-log
live together under each slice. Status key: ✅ done · 🚧 in progress · ⏳ not started · ⏸ deferred.
Engine module: `src/features/engine/kakuro/` with mirrored `.md` files per source file. Slice
prefixes: **V** = visual surface on baked content · **E** = engine · **R** = rotation (daily).

| Order | Slice | What becomes visible |
|---|---|---|
| 0 | V0 — Looks-only static board | An empty 7×7 Kakuro shape at `/kakuro` — no sums, no input *(route retired in V2)* |
| 1 | V1 — Types + baked fixtures | Real clue sums on the static boards at `/kakuro` (7×7 and 9×9) *(route retired in V2)* |
| 2 | V2 — Board on the baked puzzle | A playable Kakuro at `/play?variant=kakuro` |
| 3 | V3 — PDF on the baked puzzle | A printable Kakuro page in the booklet |
| 4 | E1 — Combination table + exact solver + uniqueness | Hint button backed by a real solver; "unique ✓" on the fixture |
| 5 | E2a — Logical solver T1–T3 + classifier + metrics + scorer | Easy/medium/hard Kakuro graded by the solver; hints that name their technique and show the lead-up |
| 5′ | E2b — Chain tiers (T4 / T5 forcing chains by length) | Expert and extreme Kakuro served at both sizes; the `*_CHAINS` fixtures solved by logic; chain hints that spell out the contradiction |
| 6 | E3 — Yield measurement spike | Numbers in the log and `research/kakuro-feasibility-findings.md`; mini = 6×6 (D6′); 13×13 deferred |
| 7 | E4 — Layout + fill + repair + clue derivation | "New puzzle" produces a fresh, unique, solver-graded board at 6/7/9 |
| 8 | E5 — Difficulty targeting + `generateKakuro` + benchmark | Every puzzle fresh and at exactly the requested tier at 6/7/9; hub card live; fixtures test data only |
| 9 | R1 — Daily rotation (4 types) | Kakuro in the daily |

### V0 — Looks-only static board ✅

Added 2026-09-30 at the owner's request, *ahead of* V1: before any types, fixtures or store work,
get a page on screen that only **looks** like a Kakuro, so the visual design is settled first and
everything after it lands on something visible (D12 taken one step further).

- `/kakuro` — a workbench route (Server Component, `robots: noindex`, not in the sitemap, no hub
  card or header link). Deleted when V2 makes `/play?variant=kakuro` real.
- `KakuroBoard` (`src/features/interactive-board/components/KakuroBoard/`) — a static Server
  Component taking an interior layout (`.` white / `#` black, one string per row). Draws the D2
  clue gutter, white cells, black cells, and the G7 diagonal on black cells that start a run.
  **No sums, no selection, no input, no store.** Carries the WAI-ARIA grid skeleton already.
- `sample-layout.ts` — one hand-drawn **7×7** shape obeying D9 (180° symmetric, connected, runs
  2–7, 32 whites against the N=7 ceiling of 34). 7×7 over 6×6 only because odd N has a
  self-symmetric centre line; this is *not* the D6′ mini-size decision, which E3 still measures.

**Gate:** the owner is happy with how the empty board looks in both themes.

**Step-log (2026-09-30 — PR [#104](https://github.com/zfert99/Puzzle-Generator/pull/104), merged 2026-10-01):**

- *Process:* cut `feature/kakuro` from `main`; built the route, component, CSS module, sample
  layout, mirrored docs, and 4 tests (gutter dimensions, clue-vs-blocked marking, the sample's
  cell counts and symmetry). Lint, `tsc` and the new tests green; page renders with no console
  errors. Visual verdict handed to the owner.
- *Learnings:* (1) drawing grid lines with a 1px `gap` over a line-coloured board background
  handles white/white, black/black and white/black boundaries with one rule — per-cell borders
  (the Sudoku board's approach) would need three. (2) The dark theme needs its own block colour:
  `--ink` is cream there, so "black cell = mostly ink" becomes a bright slab. (3) The first
  sketch of the sample had 35 whites — one over the G10 ceiling for N=7 — which is a reminder
  that hand-authored fixtures in V1 need `deriveRuns`-style validation, not eyeballing.
- *Blockers:* none.
- *Carried into V1/V2:* the sample layout is a shape only; V1's fixtures replace it. The
  component's `buildDisplayCells` is a drawing helper — V1's `deriveRuns` owns real run
  derivation and validation. *(Done in V1: `sample-layout.ts` is deleted and the board now takes
  a `KakuroPuzzle`.)*

### V1 — Types + baked fixtures ✅

- `kakuro-types.ts`: `KakuroPuzzle { variant: 'kakuro'; gridSize; grid; solution; runs; difficulty }`,
  `Run { id; cells: number[]; sum; dir: 'across' | 'down' }` (flat `row * size + col` indices, the
  Killer/Keisan convention), difficulty union `easy | medium | hard | expert | extreme`. D2 and D3
  encoded in the JSDoc with the "why".
- `kakuro-fixtures.ts`: **hand-baked puzzles** — at least one mini (6×6 or 7×7) and one 9×9 —
  authored in a compact text form (`.` white, `#` black, clue cells as `across\down` per the
  dCode convention, G7) and parsed into `KakuroPuzzle` at import. Each fixture carries its
  solution. Author them from the rules (D9: symmetric, connected, runs 2–9) or transcribe
  public-domain examples; **never** a copyrighted Nikoli/Conceptis grid.
- `deriveRuns(layout)`: boolean black mask → runs list, validating D9 invariants (no length-1
  runs, every white in two runs, connectivity, degenerate-rectangle check per G10).
- Tests: every fixture's solution satisfies every run (sum + all-different); `deriveRuns` fuzzed
  against a brute-force strip scanner; the fixture parser round-trips.

**Gate:** fixtures valid by test; mirrored `.md` files in place.

**Step-log (2026-09-30 — PR [#108](https://github.com/zfert99/Puzzle-Generator/pull/108); its predecessor #106 was closed by GitHub when V0's branch was deleted, so stacked branches are not worth it here — cut each slice from `main` after the previous one merges):**

- *Process:* `src/features/engine/kakuro/` now holds `kakuro-types.ts` (`Run`, `KakuroPuzzle`,
  `validateKakuroRuns`), `kakuro-layout.ts` (`deriveRuns`, `validateKakuroLayout`, `whiteMaskOf`)
  and `kakuro-fixtures.ts` (`parseKakuroFixture` + a 7×7 and a 9×9), each with a mirrored `.md`
  and tests (29). To give the slice something to look at (L5), the static `KakuroBoard` now takes
  a `KakuroPuzzle` and draws the **clue sums** in their triangles; `/kakuro` shows both fixtures.
  `sample-layout.ts` (V0) is deleted.
- *Divergences from the spec above, and why:*
  1. **Fixtures are authored as the solved grid, not in clue form.** Digits for whites, `#` for
     blacks; the clues are derived by `deriveRuns`. One source of truth — a hand-typed clue that
     disagreed with the solution would look exactly like a correct one. So there is no
     `across\down` text parser and no round-trip test; the parser test asserts the parsed
     solution and runs directly.
  2. **`deriveRuns` takes the solved grid and does not validate.** Validation is split out:
     `validateKakuroLayout(mask)` for the D9 shape rules (static, solver-free — E4 reuses it as
     the pre-solver rejection step) and `validateKakuroRuns(runs, solution)` for the digits.
     `deriveRuns` lives in `kakuro-layout.ts`, the module E4's generator will extend.
  3. **The fixture digits were found by a throwaway script, not typed.** See Learnings.
  4. **The board renders clues already** (spec'd for V2). It is still static — no input.
- *Learnings:* (1) **Random fills of a fixed layout were never unique: 0 of 3,000** on the 7×7
  (32 whites). A hill-climb on the fill — change one cell, keep the change if the solution count
  does not rise — reached a unique fill in ~2 s for the 7×7 and ~105 s for the 9×9 (55 whites),
  with a crude unoptimised counter. This is the research's "naive generation is hopeless"
  warning showing up at mini size, and an early hint that E4 may want *fill repair* rather than
  *fill-and-retry*. **E3 must measure this properly** — logged under Measurements. (2) Flat
  indices hide row wrap: the last cell of a row and the first of the next differ by 1, so an
  "across step is +1" check needs an explicit wrap guard (tested).
- *Blockers:* none. **Owed to E1:** the repo does not yet prove the fixtures are unique — only
  the throwaway counter did. E1's solver adds that test.

### V2 — Board on the baked puzzle ✅

- **Real discriminant first** (the Keisan K5 audit lesson): `PuzzleVariant` / `BoardPuzzle` /
  `usePuzzle` unions gain `'kakuro'`; `startNewGame` switches on `variant`, never on
  `'runs' in puzzle`. While no generator exists, `usePuzzle` serves a **fixture** for Kakuro
  (client-side import — static data, so no hydration concern); `/api/puzzle` is untouched until
  E5.
- **Board:** Kakuro config `{ size, hasBoxes: false, maxNum: 9 }`; `blocked` mask + `cellToRuns`
  built at game start (the `cellToCage` pattern); **run-based peers builder** (`computePeers` is
  house-based and wrong here); clue rendering — one-cell **gutter** (top + left) plus interior
  black cells, diagonal from upper-left to lower-right, **upper-right triangle = down sum,
  lower-left = across sum** (G7); blocked cells unselectable and skipped by arrow-key nav; numpad
  reads `config.maxNum` and its "digit exhausted" counter is disabled for Kakuro; pencil stripping
  on placement gated on `'kakuro'` (correct — no repeats in a run); rules dialog body ("Kakuro
  (Cross Sums)", the interior-size convention); `?variant=kakuro` deep link; `useSavedGame`
  round-trips `runs`; both themes.
- **Solved / hint:** the solved check is the existing cell-for-cell match (free under D3). The
  Hint button reveals a solution cell as it does today — E1 replaces that with a real solver
  step.
- **A11y (G7):** WAI-ARIA grid as the board already uses; white cells `role="gridcell"` with an
  accessible name carrying position *and* both runs' clues ("row 3 column 4, across 17, down
  23"); clue cells read-only with a name spelling both sums; blockers out of the tab order;
  `aria-rowindex`/`aria-colindex`; roving tabindex with arrow keys skipping non-fillable cells;
  digits 1–9 fill, Backspace/Delete/0 clear; avoid Ctrl+PageUp/Down (JAWS intercepts). Validate
  with NVDA/VoiceOver — no screen-reader-tested Kakuro exists anywhere.
- **Sizes (D11):** the `/play` size picker lists **Kakuro's** sizes (D6′), not 4/6/9 — `GridSize`
  widens per-variant only (Keisan Risk 6). The large size is where the phone cell-size floor gets
  tested first (13×13 + gutter = 14 columns; measure at 360 px, cap it out of `/play` on narrow
  viewports rather than shrink digits below legibility — Risk 15).
- **Hub:** *not* yet — a card pointing at one baked puzzle would ship a one-puzzle type to
  `main`; the deep link is reachable by URL for building and E2E (D12).
- **E2E:** Kakuro play spec on the fixture (blocked cell refuses a digit, clue cells render both
  sums, 1–9 numpad at the mini size, board starts empty, solving the fixture shows the solved
  dialog); a11y spec covers clue cells.

**Gate:** the fixture is playable end-to-end in the browser (both themes, mini + 9×9), E2E green,
visual check handed to the owner.

**Step-log (2026-10-01 — PR [#109](https://github.com/zfert99/Puzzle-Generator/pull/109), merged):**

- *Process:* `'kakuro'` joined `PuzzleVariant` / `BoardPuzzle` / `usePuzzle`'s unions with the
  real discriminant (`puzzle.variant`); `startNewGame` keeps the puzzle's `runs` and derives
  `blocked`, display-indexed `clues` and **run-mate peers** (`kakuro-board.ts`); black cells are
  marked as `givens` so every existing edit path refuses them without a second flag;
  `kakuroGridConfig` is boxless with `maxNum: 9`, and Numpad/Cell/Board read `maxNum` instead of
  `size`; the Sudoku digit lockout is gated off. `Board` draws the gutter as a first row of
  `ClueCell`s plus one per interior row, labels the grid "Kakuro board", and its arrow keys skip
  black cells; `Cell` renders a blocked cell as a `ClueCell` (down sum upper-right, across sum
  lower-left, diagonal) and highlights peers by run-mate membership. `PlayExperience` gained the
  toggle, a per-type `SIZES` table (7/9 for Kakuro) and no difficulty picker for Kakuro;
  `usePuzzle` serves the fixture for the chosen size with no network call; `GridSizeSelector`
  offers 7×7 and became generic in its size union; `RulesDialog` has a Kakuro body. The V0/V1
  workbench route `/kakuro` and the static `KakuroBoard` are **deleted** — `/play?variant=kakuro`
  is the surface now (hub card still waits for E5, per D12). Tests: 17 new (board utils, store,
  Board, Numpad) + a Kakuro e2e play spec; full suite green; verified in the browser (play,
  pencil marks, arrows, peers, reload/resume).
- *Bug found and fixed (B1 in the log):* a resumed Kakuro came back all-white with no clues.
  The store rebuilt its derived fields in `onRehydrateStorage` by **mutating** the state after
  hydration's `set`, which notifies no subscriber — already-rendered cells never re-read them.
  Moved the rebuild into persist's `merge`, which runs before the state is set. Killer's
  `cellToCage` had been one interaction late after every reload for the same reason.
- *Not done, deliberately:* `useSavedGame` needed no change (it only reads `variant`); the
  a11y spec was not extended; the large size (13×13, 14 tracks) has no fixture yet so the
  phone-width check (Risk 15) is still owed; no NVDA/VoiceOver pass (G7's owed AT test).
- *Blockers:* none.

### V3 — PDF on the baked puzzle ✅

- `drawKakuroGrid` + `generateKakuroPDF` on the shared nav helpers (bookmarks + puzzle↔answer
  links). Print conventions (G7): light interior lines with a heavier outer border, **shaded clue
  cells**, both sums in their triangles, one puzzle per page, answers on a separate page.
- `/api/generate` gains a Kakuro branch that, until E5, renders the fixtures; PuzzleForm gets a
  Kakuro section with Kakuro's sizes (D11); sample booklet regenerated with a Kakuro page.

**Gate:** a Kakuro page in the sample booklet, verified by eye; PDF service tests cover the
renderer.

**Step-log (2026-10-01 — PR [#118](https://github.com/zfert99/Puzzle-Generator/pull/118); built after E3 and review follow-up 4, the order the owner chose):**

- *Process:* `drawKakuroGrid` draws the (N+1)×(N+1) display grid — shaded blocks, light
  interior lines, heavier frame, a diagonal through every clue cell with the down sum
  upper-right and the across sum lower-left (G7), solution digits on the answer page — and
  `generateKakuroPDF` is the fourth booklet on the shared navigation helpers. White vs black
  comes from `solution` (D3: black = 0); the clue picture comes from `buildClues`, **moved from
  the interactive board into the engine's `kakuro-layout.ts`** (re-exported by `kakuro-board.ts`
  under its old names) so paper and screen derive one picture. `/api/generate` gained a
  Kakuro branch validated by a **Zod schema** — sizes `7 | 9` (D11, not the Sudoku family's
  4/6), each level `0..1` — that serves the fixtures; `PuzzleForm` a Kakuro toggle with
  Kakuro's sizes, the full ladder at both, and a one-per-level cap (`maxPerDifficulty` on the
  configurator + a clamp in `handleGenerate`, so the default 2/2/2 prints 1/1/1 rather than
  erroring). `preview-kakuro.ts` wrote `Docs/samples/kakuro-sample.pdf` (10 puzzles + answers).
  Tests: PDF parity (bookmarks, links, page count), four route cases (happy path + filename,
  count > 1, Sudoku-family size, all zeros), the form's Kakuro path.
- *Verified by eye:* the 7×7 easy puzzle page and the 9×9 easy answer page rasterised
  (`sips`) and checked — gutter, shading, diagonals, sum placement, digit centring all as
  specified. The QuickLook/`sips` route only renders a PDF's first page, so single-page
  renders were made with `drawKakuroGrid` directly; recorded in the pre-merge entry.
- *Divergence from the spec:* "one puzzle per level" is a V3 constraint the spec did not
  anticipate — the fixtures are the only puzzles until E5, and a count of 2 would print one
  puzzle twice. The route rejects it (400 with the reason) and the form prevents it; the cap is
  one `max(1)` in the schema to delete when `generateKakuroBatch` exists.
- *Learnings:* the clue picture was board code until a second consumer appeared; the right
  home was the engine all along (the board's `kakuro-board.md` said as much — "display
  coordinates" is a puzzle concept). Move on the second consumer, not the third.
- *Blockers:* none. The hub card still waits for E5 (D12); `/generate` shows Kakuro now
  because it is a real, if small, catalogue.

**Review follow-up 5 (2026-10-01 — hosted `/code-review high` over #118, 8 findings, all
addressed in [#119](https://github.com/zfert99/Puzzle-Generator/pull/119); recorded in full):**

| # | Finding (file) | Outcome |
|---|---|---|
| 1 | The "Expert and Extreme are only available for 9×9" note tested `gridSize`, but the form passed its *classic* size for every variant, so the note was wrong for Killer 6×6 / Keisan 4×4 either way; V3 added a Kakuro exception on top (`DifficultyConfigurator.tsx`) | **Fixed** — the form passes the active variant's size, and the note derives from the ladder actually offered (`!availableDifficulties.includes('expert')`), no per-variant case; tested both ways |
| 2 | The one-per-level rule clamped three times (configurator, toggle, submit) (`PuzzleForm.tsx`) | **Fixed** — the submit-time clamp removed; the toggle + the configurator's `maxPerDifficulty` are the rule |
| 3 | `isWhite` re-implemented `whiteMaskOf`; the digit-centring formula copied a third time (`pdf.service.ts`) | **Fixed** — `whiteMaskOf(solution)`; one `drawCenteredDigit` for classic, caged and Kakuro renderers (re-rendered all three to confirm) |
| 4 | Fixture selection lived in the route, not a service (AGENTS.md §1) (`route.ts`) | **Fixed** — `selectKakuroBatch(counts, { gridSize })` beside the fixtures, the Kakuro counterpart of `generateKillerBatch`; the one function E5 swaps; tested |
| 5 | The log's `counts` field carried `variant` inside it | **Fixed** — five numbers under `counts`, size at the top level, like the other branches |
| 6 | The puzzle page never read `puzzle.grid` — givens would not print | **Fixed** — `grid` on the puzzle page, `solution` on the answer page, like the other renderers (every Kakuro's `grid` is empty today) |
| 7 | Schema defaults (`gridSize` omitted → 7, a level omitted → 0) and a non-numeric count untested | **Fixed** — two route tests |
| 8 | The ladder typed three times (form ×2 routes, route) | **Fixed** — `KAKURO_LADDER` + `KakuroLevel` exported from `kakuro-types.ts`; form, route and selector use it (Killer keeps its own list — it is Killer's) |

### E1 — Combination table + exact solver + uniqueness ✅

- Combination table: verify `cage-combinations.ts` at `maxDigit = 9` gives exact `(length, sum)`
  coverage for L 2–9 (sum ranges 3–17, 6–24, 10–30, 15–35, 21–39, 28–42, 36–44, 45); wrap as
  `kakuro-combinations.ts` (union mask, per-combination masks, `isUniqueCombination(L, S)`), or
  re-export. Tests assert the 9/36/84/126/126/84/36/9/1 counts and the canonical magic entries
  (3-in-2 = {1,2}, 4-in-2 = {1,3}, 16-in-2 = {7,9}, 17-in-2 = {8,9}, 6-in-3, 7-in-3, 23-in-3,
  24-in-3, 10-in-4, 30-in-4, 45-in-9).
- `kakuro-solver.ts`: 9-bit candidate masks per white cell; **per-run propagation** (filter the
  run's surviving combinations against current cell masks → union → AND into each cell; singleton
  cascade removes the digit from run-mates in *both* runs), plus min/max residual bounds; MRV DFS
  with a **node budget** and **early exit at the 2nd solution**. Monomorphic hot path (AGENTS.md
  §5) — one solver class, typed arrays, no per-call allocation in propagation. No Régin GAC
  (research: overkill at L ≤ 9). Optional later: Mathimagics' look-ahead (a value forced in every
  branch of a cell is forced).
- **Visible on the board:** the Hint button now places a cell the *solver* derived (propagation
  first, search only if needed) instead of copying the solution; a dev-only badge on the fixture
  reads "unique ✓ (n nodes, t ms)".
- Tests: fuzz vs an independent brute force on tiny layouts (≤ 4×4 interior); every fixture is
  unique; the G10 degenerate rectangles report ≥ 2 solutions; a fixture with one cell's across
  and down clues both ±1 (the Mathimagics trick) reports non-unique; budget exhaustion is
  reported, not silent.

**Gate:** uniqueness verify on the 9×9 fixtures **< 50 ms average** (the Keisan/Killer gate), fuzz
clean, board hint driven by the solver.

**Step-log (2026-10-01 — PR [#110](https://github.com/zfert99/Puzzle-Generator/pull/110), merged; taken ahead of V3):**

- *Order:* E1 was pulled ahead of V3 (PDF). The owner asked for "the solver with a Hint button"
  as the next thing after V1; V2 had to come first for a Hint button to exist at all, and the
  PDF page has no dependency on either direction. V3 stays queued.
- *Process:* `kakuro-combinations.ts` is a Kakuro-named view over `killer/cage-combinations.ts`
  at `maxDigit = 9` plus memoized bitmask lists — the table is not built twice; tests pin the
  9/36/84/126/126/84/36/9/1 counts, the sum ranges per length, and the canonical magic runs.
  `kakuro-solver.ts`: compiled typed-array shape, per-run propagation (feasible-combination
  filter → union → all-different strip → required-digit-held-by-one-cell), ring-buffer work
  queue, MRV search with mask copies per branch and a node budget; `countKakuroSolutions`,
  `isKakuroUnique` (`null` on budget), `deduceKakuro` (propagation only). The store's `hint`
  places a cell the solver **deduces** (selected if forced, else the first forced; the digit is
  accepted only if it equals the solution's — a board holding a mistake can force a digit that
  is consistent with the mistake); `KakuroDevBadge` shows "unique ✓ · n nodes" under the board
  in development (nodes, not ms — a timing in render fails `react-hooks/purity`; CI caught it). 48 engine tests incl. a 150-grid fuzz against an independent brute
  force, the G10 2×9 and isolated-2×2 degenerates, the ±1 clue trick, budget exhaustion, and
  **both fixtures proven unique in-repo**; 4 store/badge tests.
- *Measured:* uniqueness verify **0.12 ms** average on the 7×7 (13 nodes) and the 9×9 (11
  nodes) — the 50 ms gate by a factor of 400. Propagation alone forces 2/32 cells on the empty
  7×7, 17/55 on the empty 9×9 (the 7×7 fixture is the harder of the two to *start*).
- *Learnings:* (1) the "required digit held by only one cell" rule is what makes propagation
  solve the 3×3 outright; without it the tiny test puzzle needs search. (2) Mathimagics'
  look-ahead (a value forced in every branch of a cell is forced) was not needed at these
  sizes — recorded as the optional booster the plan named, untouched. (3) The browser's console
  log persists across navigations: a stale error from before a fix reads as a live one —
  confirm in a fresh tab before chasing it.
- *Blockers:* none.

**Review follow-up (2026-10-01 — hosted `/code-review` over V0–E1, 10 findings, all addressed
in one PR; recorded here in full at the owner's request):**

| # | Finding (file) | Outcome |
|---|---|---|
| 1 | No test hydrates the store from storage, so the B1 class (derived fields missing after reload) was guarded only by a manual browser check (`useBoardStore.ts`) | **Fixed** — `useBoardStore.hydration.test.tsx`: snapshot localStorage, wipe, `persist.rehydrate()`, read `blocked`/`cellToRuns`/`clues`/`peers` (Kakuro) and `cellToCage` (Killer); proven to fail when the `merge` rebuild is deleted |
| 2 | Header showed the fixtures' placeholder "Medium" as a real grade (`GameHeader.tsx`) | **Fixed** — header and Continue label read "unrated" for Kakuro until E2 |
| 3 | `countKakuroSolutions` with zero runs: `% 0` → NaN, reported 1 solution (`kakuro-solver.ts`) | **Fixed** (B3) — 0 solutions / contradiction up front; tested |
| 4 | Min-hints floor counted dead black cells as hints (`kakuro-layout.ts`) | **Fixed** (B4) — counts black cells heading a run; table renamed `minInteriorHints`; test with 12 blacks / 4 hints |
| 5 | Private `popcount` duplicated `grid-utils.popcount` (`kakuro-solver.ts`) | **Fixed** — imported |
| 6 | Empty `if (target) {}` branch in `hint()` (`useBoardStore.ts`) | **Fixed** — fallback wrapped in `if (!target)` |
| 7 | `as Variant` assertion hid the `PuzzleVariant`/`Variant` drift (`DailyExperience.tsx`) | **Fixed** — `isDailyVariant` type guard in `daily-row.ts`, visible fallback to the key label |
| 8 | Hint discarded every forced cell when the first one disagreed with the solution (`useBoardStore.ts`) | **Fixed** (B2) — first *agreeing* forced cell; tested with a consistent-but-wrong entry |
| 9 | Unknown Kakuro size silently served the 7×7 (`usePuzzle.ts`) | **Fixed** — sets `error`, returns `null`; two hook tests |
| 10 | Peer highlight scanned the selection's peer list in every cell's selector (`Cell.tsx`) | **Fixed** — `cellToRuns` (two run ids per cell) + `shareRun`, O(1); derived in `startNewGame` and `merge`; tested against the peer lists |

*Learnings:* L10 (hydrate-from-storage tests), L11 (take cheap review cleanups in the same
follow-up). The `/code-review` run was triggered by the owner (it is billed); the agent fixed
and re-reported.

**Step-log — E2b (2026-10-01, built, in review):**

- *Process:* `kakuro-chains.ts` — Berthier's redundant-variable model (a "which combination"
  variable per run makes every constraint a binary link) and a forcing-chain search over it:
  suppose a candidate, follow forced consequences (linked candidates false; a variable with one
  candidate left is true), and eliminate the candidate if a variable empties; the count of
  forced truths is the length. Two ladder techniques: `shortChain` (tier 4, length ≤ 4) and
  `longChain` (tier 5, ≤ 12); the chain's explanation spells the path out ("If row 4, column 6
  were 2: row 3, column 6 → 1, 7-in-two across (row 4) → {2,5}, …, and then 6-in-two across
  (row 3) has no combination left — so 2 is impossible there (chain of 4)"). Both `*_CHAINS`
  fixtures now solve by logic (tier 4, one and two chains); the hill-climb found expert and
  extreme fills at both sizes with the chain solver as the objective, so **the full ladder is
  served** and the Kakuro menu unlocks expert/extreme at 7×7 too. 4 chain tests + tier-4/5
  separation tests; the soundness sweeps (every placement = solution, no elimination removes a
  solution digit) now cover chain steps on all 12 fixtures and random unique grids.
- *Divergences from the spec, and why:* (1) **braids, not whips.** The spec said whips; what a
  single propagation loop naturally finds is Berthier's braid (a whip with "memory"). Braids
  and whips rate puzzles almost identically and the braid is simpler; a whip-only mode can be
  added if calibration ever wants the stricter rating. (2) **No g-whips.** Nothing built or
  searched needed the "a required digit must land somewhere" g-link; added when a fill needs
  it. (3) **No surface sums** (an accelerator, per G4 and L3). (4) The chain spike and the tier
  bound happened in the same slice — the fixtures made the bound obvious.
- *Measured:* the two original fills need chains of **exactly 4** after the tier-3 standstill
  (not 3 — tested), which set `CHAIN_TIER4_MAX_LENGTH = 4`. Searched fills: 7×7 extreme chains
  of 6 and 10; 9×9 extreme 8 and 7; both experts a single chain of 4. Classify: ~7 ms expert,
  ~35 ms extreme; hints ~1 ms. Search times: 7×7 expert 1.5 s, 7×7 extreme 0.07 s (!), 9×9
  expert 63 s and 9×9 extreme 45 s, each with restarts out of non-unique dead ends.
- *Learnings:* (1) a raw chain context must assert single-combination runs as facts before the
  supposition, or a chain that depends on an already-forced run is missed (a unit test caught it
  on the 3×3). (2) Both original fills land exactly on the tier boundary — one fixture is never
  a calibration; E5's distribution is.
- *Blockers:* none. **Still owed to E5:** the T4/T5 bounds are provisional (set from four
  fixtures); the "T4 must be populated" gate decides them.

**Review follow-up (2026-10-01 — hosted `/code-review` over E2b, 8 findings, all addressed;
recorded in full):**

| # | Finding (file) | Outcome |
|---|---|---|
| 1 | Open combinations re-filtered for every run on every target candidate (`kakuro-chains.ts`) | **Fixed** — `prepareChainWorkspace` builds combos + buffers once per step; targets share and reset them |
| 2 | The facts pre-pass did not iterate, so a chain whose first link was really a fact could be counted one longer — possibly across the tier bound | **Fixed** (B8) — facts (single-combination runs, single-candidate cells, and what they force) established to a fixpoint before the supposition; a fact-excluded target is a length-0 chain; tested |
| 3 | A chain step's `run` was the eliminated cell's own run, contradicting the field's doc | **Fixed** — `ForcingChain.contradictionRun` (the run that emptied, or the emptied cell's run) is what the step records; tested |
| 4 | Tests reached the private `chainContext()` through an `as unknown` cast | **Fixed** — `chainContext()` is public (documented as the engine's view of the state) |
| 5 | Per-candidate buffer allocation | **Fixed** — same workspace as #1 |
| 6 | No g-link: a true combination's digit with no holder was not a contradiction | **Fixed** — the g-link is in the scan (no holder → contradiction; one holder → forced). Every fixture keeps its tier; the 7×7 extreme's chains re-route and now include one of exactly 12 — the ceiling, noted below |
| 7 | The expert/extreme lock rule written three ways (`PlayExperience.tsx`) | **Fixed** — `topTiersLockedFor(variant, size)` |
| 8 | Tier-5 length ceiling untested | **Fixed** — a test learns a chain's length L and asserts bound L finds it and bound L − 1 does not (the off-by-one), on the extreme 7×7 |

*Noted:* with the g-link the 7×7 extreme needs a chain of exactly **12** at one point — the
`CHAIN_TIER5_MAX_LENGTH` ceiling. It still grades extreme (the chain is found), but the fixture
sits on the edge; E5's distribution decides whether 12 is the right ceiling. *(Closed by review
follow-up 4 below: the 12 was an artefact of the one-way g-link.)*

**Review follow-up 4 (2026-10-01 — hosted `/code-review high` over #115 + #116, 8 findings,
all addressed in [#117](https://github.com/zfert99/Puzzle-Generator/pull/117); recorded in full):**

| # | Finding (file) | Outcome |
|---|---|---|
| 1 | The g-link ran one way only: a digit with no remaining holder never falsified the open combinations that need it, so a chain that killed every holder of a required digit was not contradicted until another link singled a combination out (`kakuro-chains.ts`) | **Fixed** (B9) — both directions in the scan, facts included. Measured: `*_CHAINS` need **3** (was 4), the served extremes graded expert and were **re-baked** at chains of 5 (7×7) / 6 (9×9); on a 36-puzzle 7×7 corpus the minimal-bound tail above 4 fell from 11 to 4 of 19 and both unrated puzzles became rated; a 23-puzzle 9×9 corpus moved less (unrated 5 → 3, extreme 8 → 8, expert 3 → 5) and still reaches the ceiling of 12 — the bound of 4 splits the tiers at both sizes, the ceiling stays E5's question; tests for both directions on raw contexts and a pin on the original 7×7 at 3 |
| 2 | The facts fixpoint re-ran identically for every target candidate | **Fixed** — `prepareChainWorkspace` establishes the facts once and snapshots them; each target restores the snapshot |
| 3 | The live D5′ row still said "no g-link", and findings §3e proposed adding g-whips (reverse-sweep miss from #115) | **Fixed** — D5′ reworded (braids with the two-way g-link, i.e. g-braids) and confirmed; §3e carries a dated addendum |
| 4 | The "forced two ways" branch was unreachable (a forced truth is by definition still open) | **Fixed** — asserting a forced truth now throws if it ever fails, instead of a dead branch that would have mis-counted |
| 5 | The `contradictionRun` test could pass via any step naming the run; the cell-emptied branch was untested | **Fixed** — asserts on the contradiction clause only, for both a run-emptied and a cell-emptied chain found on the 9×9 original |
| 6 | An inconsistent context (its facts alone contradict) still yielded a "proven" elimination | **Fixed** — `ChainWorkspace.inconsistent`; every target returns `null`; tested |
| 7 | Findings §6 reproduction counts for 13×13 read as 6 repairs (six layouts, three repairs) | **Fixed** |
| 8 | A fresh workspace's `trueCombo` read as "combination 0 true" until the first reset | **Fixed** — initialised to −1 |

*Learned (L17):* a one-way link is half a link. The tier-4 bound, the extreme fixtures and E3's
tier distribution were all measured against the one-way g-link; the two-way link cut chain
lengths 2–3×. E5 re-measures the distribution with this engine before fixing the bounds.

### E2 — Logical solver (technique classifier) + instrumentation ✅ (E2a ✅ · E2b ✅)

- Tier *definitions* follow Simonis (G9): a puzzle's tier is the **weakest technique level that
  finishes it search-free**. This is ordinal, not a weighted sum — the scorer below only orders
  puzzles *within* a tier.
- `kakuro-logical-solver.ts` (a class, no inheritance — AGENTS.md §1), tiered:
  - **T1** unique combinations + intersection (cross-referencing across/down unions) — the
    Mathimagics `fixed` set.
  - **T2** naked/hidden singles + residual-sum re-lookup + iterated domain shaving (Simonis
    method R: shave to saturation) — completes everything with `rating` = 1.0 (the `implied` set).
  - **T3** naked/hidden pairs/triples within a run + min/max (sum-based) elimination +
    limited-solution-set reasoning + locked candidates across runs.
  - **T4** **whips of bounded length** (Berthier whips[1..k], k fixed by E5 calibration) over
    the redundant-variable model below. **Surface sums** are implemented here as an accelerator
    (G4): articulation points of the white-cell adjacency graph (linear time); a 1-cut cell's value
    = Σ across clues spanning the cut-off region − Σ down clues (or the transpose); 2-cuts give a
    sum or difference of two cells (skip for v1 — Berthier judged them not worth it). A surface-sum
    step never *defines* the tier.
  - **T5** longer whips / **g-whips** (the non-binary sum constraint needs g-labels). Extreme =
    needs a chain deeper than T4's bound. **No guessing at any tier** (D10).
- **Chain model (`kakuro-chains.ts`):** Berthier's KakuRules encoding — add a redundant
  "combination" variable per run (`hrc`/`vrc`: which combination the run uses), so every
  constraint becomes binary between cell-candidates and run-combinations; chain rules then walk
  bivalue links. Port the *model*; write the whip walker fresh (CSP-Rules is CLIPS). This is the
  largest unknown in the plan — **spike it first inside E2**, on the fixtures, before committing
  the tier bound. Build T1–T3 first (visible immediately), chains second.
- `KakuroSolveResult { tier; techniques[]; steps; maxWhipLength; surfaceSumSteps; metrics }` where
  `metrics` carries the instrumentation set (NCELL, MRL, ACRL, density, run-length histogram,
  unique-combo count, `fixed`, `implied`, `rating`).
- `kakuro-score.ts`: two-factor scorer (weighted technique sum × opportunity density) for
  within-tier ordering; weights seeded from the ladder order; re-fit in E5.
- **Visible on the board:** the fixture's difficulty label now comes from the classifier; the Hint
  button walks the logical solver's next step and names the technique ("16-in-two: only {7,9}");
  a dev panel shows the metrics.
- **Soundness fuzz:** every logical placement must match the exact solution — zero mismatches
  over the fixtures and, once E4 exists, ≥ 500 generated puzzles per size (re-run then).
- **Optional, not v1:** an *experimental* bounded-T&E tier using the Keisan snapshot shape, labelled
  "beyond published difficulty", excluded from the daily.

**Gate:** soundness clean on every fixture; each fixture's tier and technique list reported; the
chain spike answers "can we walk whips over the redundant model" before E5 fixes the T4 bound.

**Step-log — E2a (2026-10-01, built, in review):**

- *Re-slice:* E2 is now **E2a** (tiers 1–3, classifier, metrics, scorer, explained hints — this
  step) and **E2b** (the chain engine `kakuro-chains.ts`, T4/T5 — next). The chain model is the
  plan's largest unknown and spec'd as its own spike; everything else was buildable and visible
  now, so it shipped first.
- *Process:* `kakuro-logical-solver.ts` — a class (no inheritance) with eight one-deduction-per-
  call techniques in tier order (`comboRestriction`, `nakedSingle` / `hiddenSingle`,
  `feasibleCombos` / `nakedSubset`, `hiddenSubset`, `sumBounds`, `runAssignments`), `step()` for
  explaining and `solve()` for grading; `classifyKakuro` (tier → easy/medium/hard, or
  `'unrated'` when the ladder stalls — never a guess, D8); `measureKakuro` (NCELL, MRL, ACRL,
  density, histogram, magic runs, `fixed`, `implied`, `rating`); `explainKakuroHint` (first
  placement with technique + reason + lead-up, preferring the selected cell within a short
  detour). `kakuro-score.ts` — the two-factor scorer, weights seeded from the ladder.
  `KakuroDifficulty` gained `'unrated'`. **Fixtures re-cut:** the served set is now easy /
  medium / hard at both sizes, each found by a throwaway hill-climb whose objective was
  "unique AND finishable by the ladder at tier N" (the repo's own solvers as the scorer), and
  each labelled exactly what `classifyKakuro` says (a test pins it); the two original fills
  became `*_CHAINS` test fixtures (unique, but T1–3 stall at 27 / 29 undecided cells — E2b's
  material). Board: the Kakuro menu offers easy/medium/hard (expert/extreme locked until the
  generator), the header shows the classifier's grade, the Hint places the logical solver's
  next placement and `HintNote` shows its reason and lead-up under the board, the dev badge
  shows grade/score/techniques/metrics. 23 new tests incl. soundness on all fixtures + random
  unique grids (placements equal the solution; no elimination removes a solution digit), tier
  separation (medium not solved at T1, hard not at T2), and the e2e asserts the explained hint.
- *Bug found and fixed (B5):* the first hidden-pair draft was unsound — Sudoku's hidden pair
  assumes every house contains every digit; a Kakuro run need not. It placed a wrong digit on
  a fixture on the very first run; the rule now only considers digits every remaining
  combination requires (as hidden single already did).
- *Measured:* classifying a 9×9 ~6 ms; `fixed/implied/rating` per served fixture in
  `kakuro-logical-solver.md`. Random fills of the layouts were **never** ladder-solvable
  either — the hill-climb got there in 0.5–2.4 s (7×7) and 11–90 s (9×9), one restart needed
  for the 9×9 medium (an early uniqueness dead end). Logged under Measurements: the generator
  (E4/E5) will need the same "repair toward the objective" loop, not fill-and-retry (L7).
- *Not done, deliberately:* locked candidates (collapses to hidden single in Kakuro — two runs
  meet in one cell), surface sums (E2b's accelerator), and the T&E tier (plan: never).
- *Blockers:* none. **Open for E2b:** the `*_CHAINS` fixtures are the acceptance test — whips
  over Berthier's redundant-variable model should finish both.

**Review follow-up (2026-10-01 — hosted `/code-review` over E2a, 8 findings; recorded in full:**

| # | Finding (file) | Outcome |
|---|---|---|
| 1 | A hint for the selected cell could "detour" past placements elsewhere inside the solver and then explain the selection against a board the player does not have ("down 3-in-one" while the run shows two empty cells) (`kakuro-logical-solver.ts`) | **Fixed** (B7) — no detour by default; instead, in preferred-cell mode eliminations run ahead of placements and the selected cell is placed the moment it is deducible (naked single, or hidden single in its runs). Tested on the chain fixture: (3,6) honoured over the cell-order-first (3,5); an unreachable preference yields a real placement with no phantom placements in the lead-up |
| 2 | A complete-but-wrong run (repeated digit, wrong sum) never set `contradiction` — no technique revisits a run with no empty cells (`kakuro-logical-solver.ts`) | **Fixed** (B6) — constructor validates placed runs; three tests |
| 3 | `hiddenSubset` (the B5 rule) never fires on any served fixture: no positive test (`kakuro-logical-solver.test.ts`) | **Fixed** — a hand-built 28-in-four (required {8,9}) case asserts it fires once, cuts exactly the right two cells, keeps 8 and 9, and is sound. Bonus: eliminations-first mode on the chain fixture also exercises it live |
| 4 | Per-step full rescan with allocations; E5 will pay it per generated candidate (`kakuro-logical-solver.ts`) | **Skipped, recorded** — ~6 ms per 9×9 today; the fix (per-run dirty flags, scratch buffers) is mechanical and deferred to E5, whose < 500 ms gate is the tripwire. Noted in `kakuro-logical-solver.md` → "Known cost" |
| 5 | `step()` recovered its result through a recording side-channel (`kakuro-logical-solver.ts`) | **Fixed** — techniques return `KakuroStep \| null`; `solve()` keeps them when asked |
| 6 | Fourth private mask→digits helper (`kakuro-logical-solver.ts`) | **Fixed** — `maskToDigits` exported from `grid-utils`; `board-utils` re-exports it; the solver uses it |
| 7 | Non-null assertion where the guard already existed (`useBoardStore.ts`) | **Fixed** |
| 8 | Dev badge ran four solver passes in render; `classifyKakuro` always paid for `measureKakuro` (`KakuroDevBadge.tsx`) | **Fixed** — `classifyKakuro(shape, { metrics })`, off by default; the badge opts in |

### E3 — Yield measurement spike (throwaway, no production code) ✅

The research's one hard warning is about **our** generation yield, and the K7 lesson is that a
plan built on an unmeasured assumption gets re-sliced later at higher cost. Before E4, spend a
bounded session measuring, on a throwaway script under the scratchpad (not committed to `src/`):

- Hand-written symmetric layouts for the **candidate sizes** — mini **6×6 and 7×7**, standard
  **9×9**, large **13×13** interior (edges-inward rules, D9), plus a randomized run-all-different
  fill, clue derivation, and the E1 counting solver.
- Measure over ≥ 200 fills per size: **P(unique)**, verify time per candidate, wall-clock per
  accepted puzzle, black-cell density, and the E2 `fixed` / `implied` / `rating` numbers of the
  accepted puzzles.
- Try two densities per size (research: density is the dominant lever) to see the yield curve.
- **Pick the mini size (D6′/G6):** the smaller of 6×6 / 7×7 whose accepted puzzles show a real
  `rating` > 1 tail (something for a Hard tier to be made of) without needing T&E.

**Output:** `Docs/research/kakuro-feasibility-findings.md` (the K7 pattern), the chosen size
triple written into D6′, and log entries under Measurements. **Gate:** a unique 9×9 in **< 1 s
average** with naive templates, the mini in < 200 ms, and 13×13 inside a cron-tolerable budget
(< 5 s). If the 9×9 or mini gate fails, **stop and re-slice** — likely toward a curated template
library and structural pre-checks (G3, G10) before E4, rather than tuning inside E4. A slow
13×13 only defers the large size, it does not block.

**Step-log (2026-10-01, measured; the record is
[research/kakuro-feasibility-findings.md](research/kakuro-feasibility-findings.md)):**

- *Process:* a throwaway scratchpad script (not committed; §6 of the findings doc says how to
  regenerate) over **random 180°-symmetric layouts** at two or three black densities per size
  (the plan said hand-written layouts; random ones gave 20 per config instead of one), 200 random
  fills per config with the E1 counter, and 20 one-cell **repair** climbs toward uniqueness,
  each accepted puzzle graded by E2's classifier with metrics. 10 configs: 6×6 ×2, 7×7 ×3,
  9×9 ×3, 13×13 ×2.
- *Results, in one line each:* **P(unique) for a random fill ≈ 0.1%** at every size (2 of
  2,000) — fill-and-retry is dead; **repair converges** in 3–24 ms (6×6/7×7) and 64–500 ms
  (9×9); **density is the lever** with a 9×9 floor near 35% black below which repair fails more
  than it succeeds; the **natural tier distribution is hard-heavy**, so easy/medium must be
  searched for with the classifier in the objective; **6×6 carries the full ladder** — mini
  decided; **13×13 fails the 5 s gate** (0/3 repairs at 33% in 60 s, 1/3 at 39% in 32 s) because
  "count solutions" stops being a cheap objective there — large size deferred.
- *Gates:* 9×9 < 1 s — **pass** at ≥ 34% black (fail at 29%); mini < 200 ms — **pass**;
  13×13 < 5 s — **fail, deferred** (the plan's own rule: it does not block).
- *Divergence:* random layouts instead of hand-written ones (more data, same question); the
  stand-in layout generator saturates near 34% black at 9×9, so the high-density 9×9 regime is
  unmeasured until E4's edges-inward generator exists. Recorded as open question 1.
- *Learnings:* L15, L16 in the log. The first 13×13 attempt ran unbounded for 52 minutes before
  being stopped — a spike needs a wall-clock cap per attempt from the start.
- *Blockers:* none; E4 proceeds at 6/7/9 with the findings as its design inputs.

### E4 — Layout generator + digit fill + clue derivation ✅

- `kakuro-layout.ts`: Mathimagics' **edges-inward template method** (G3, now a procedure):
  (1) generate the outer edge — for diagonal symmetry make the top and left edges and reflect;
  for 180° symmetry make one half and rotate — picking uniformly from valid edge patterns;
  (2) every edge white cell **forces its inward neighbour white** (no orphans), which fills the
  second ring deterministically; (3) prefer **odd N** so the centre row/column is self-symmetric
  and the free decision space halves; (4) fill the remaining interior **outside-in**, row by row
  toward the centre, symmetry auto-completing reflections; (5) for each free cell, place the
  *forced* value if leaving it free would break contiguity or exceed max run length, else random
  black/white; (6) on a dead end **restart** (edge or whole). Invariants held throughout: symmetry,
  connected white region, run length ≤ max, no orphans. Expose density and run-length-mix knobs
  (the difficulty levers E5 biases with). No open template catalog exists per size, so a curated
  library is something we would *build* from this generator, not import.
- **Static rejection before the counter (G10):** scan for maximal *contiguous* all-white
  rectangles and reject any ≥ 2×9, 3×8, 4×7 or 5×5 (each is guaranteed to contain a
  sum-preserving swap cycle; supersets like 5×6 included). Also reject layouts outside the
  min-interior-hints / max-blanks table (N=6: ≤ 24 whites, ≥ 1 hint cell; N=9: ≤ 59 whites, ≥ 5
  hint cells). The check is on contiguous rectangles, not bounding boxes — a 5×5 broken by an
  interior clue cell is legal.
- Fill: randomized DFS with per-run all-different; derive every run's sum.
- `generateUniqueKakuro(size, layoutOpts)` loop: layout → static rejection → fill → derive →
  verify (E1) → accept/retry. Measure yield per density band and record it in the log.
- **Visible on the board:** "New puzzle" produces a fresh, unique, ungraded Kakuro (label shows
  the E2 classifier's tier for whatever came out); the fixtures become test data only.

**Gate:** yield ≥ what E3 measured; 9×9 accepted puzzle < 1 s avg at medium density; the mini
< 200 ms.

**Step-log (2026-10-01 — PR [#120](https://github.com/zfert99/Puzzle-Generator/pull/120)):**

- *Process:* `kakuro-generator.ts` — `generateKakuroLayout` (two methods, see divergence),
  `fillKakuroLayout` (randomised DFS, per-run all-different), `repairToUnique` (E3's one-cell
  hill-climb on the capped solution count, plateau moves kept, wall-clock cap scaled by size),
  `generateUniqueKakuro` (layout → fill → repair → exact verify → classifier label). `kakuro.ts`
  — the **thin E5 entry point pulled forward**: `generateKakuro(difficulty, { gridSize })` targets
  the tier by *bounded rejection* (fresh puzzles until the classifier's tier matches, else a
  fixture of the exact tier at 7×7/9×9 or the nearest tier generated, always labelled with the
  grade earned — D8) and `KAKURO_SIZES = [6, 7, 9]` with one density per size. `/api/puzzle`
  gained the Kakuro branch (logs `served` + `source` so E5 can read the fallback rate);
  `usePuzzle` dropped its client-side fixture path; the board offers **6×6** (D6′); the e2e no
  longer depends on fixture clue values. 12 generator tests (seeded, both layout methods, fill
  legality, repair convergence and cap, end-to-end at every size), 3 entry-point tests, 2 route
  tests. The fixtures are now test data and the route's fallback only.
- *Measured (scatter, 30 per size, end to end):* 6×6 **95 ms** avg / 20 median; 7×7 320 / 43;
  9×9 **659 ms** avg / 245 median; 0 failures in 90. Tier distribution at the shipped
  densities: hard 45%, expert 25%, extreme 15%, medium 10%, easy 1–3% — hard/expert/extreme
  match a request in 1–2 tries, medium in a handful, **easy mostly falls back** (the 7×7/9×9
  fixture; at 6×6 the nearest tier, labelled truthfully). Gates: mini < 200 ms ✓, 9×9 < 1 s ✓,
  yield ≥ E3 ✓.
- *Divergence — the layout method* ([research/kakuro-layout-method-findings.md](research/kakuro-layout-method-findings.md)):
  the prescribed **edges-inward** method was built, measured, and **demoted to an option**. Its
  no-orphan forcing lays 2-deep white bands (~30% more all-white 2×2 blocks — the shape every
  sum-preserving swap needs), and its layouts repaired to unique 5/10 at 9×9 vs **10/10** for
  the random-pair **scatter** method E3 had measured with; a 2×2-block-breaker knob did not help
  because the bands are forced, not flipped. Scatter is the default; the invariants the plan
  listed are enforced by the validator for both. G3 amended in the log.
- *Learnings:* L19 (a method's objective must be ours: "valid at high density" is not "repairs
  cheaply"); L20 (a per-step O(N²) check inside a placement loop was 90% of layout time —
  check the neighbourhood, validate once).
- *Blockers:* none. **Owed to E5:** the classifier in the objective (easy is unreachable by
  rejection), per-tier density bias, the fallback's removal, the hub card, the deep link's
  seed (still 7×7 — the mini is 6×6 but has no fixture to fall back to), `/api/generate`
  switching from `selectKakuroBatch` to generation.

**Review follow-up 6 (2026-10-01 — hosted `/code-review high` over #120, 6 findings, all
addressed in [#121](https://github.com/zfert99/Puzzle-Generator/pull/121); recorded in full):**

| # | Finding (file) | Outcome |
|---|---|---|
| 1 | `kakuro.test.ts` asserted a probabilistic outcome (`source === 'generated'` for a hard 9×9 inside a 6 s wall-clock budget); the seeded end-to-end tests also depended on the size-scaled repair cap | **Fixed** — the test asserts what holds either way (the label is the requested tier *and* the classifier's; legal; unique) and accepts `generated \| fixture`; seeded tests pass a 60 s cap so a seed means the same run on any runner. Not added to the flaky table: made deterministic instead |
| 2 | `timeBudgetMs` checked only between attempts — one attempt could run five repair caps past it, the fixture-less last resort 20 more (`kakuro.ts`) | **Fixed** — `generateUniqueKakuro` takes `timeBudgetMs` and hands each repair `min(cap, remaining)`; the entry point passes its remaining budget per attempt and gives the last resort one more budget: bounded by `2 × timeBudgetMs` by construction; tested at 300 ms / 200 ms |
| 3 | Dead mirror-conflict check in `attemptLayout`; redundant centre-cell clause in `scatterLayout` | **Fixed** — removed; the coin steering now runs only for edges-inward |
| 4 | Run indexing built twice (fill, repair) | **Fixed** — `indexRuns(white)` |
| 5 | Objective re-scanned the grid (`deriveRuns`) and copied it every step | **Fixed** — run sums kept in place and nudged by the digit delta. **Measured honestly:** on identical seeded fills 0.63 → 0.60 ms/step at 7×7 and no change at 9×9 — the solution count, not the scan, is the step's cost, so the finding's premise overstated the gain; kept because it is simpler and the shape an E5 objective wants |
| 6 | Scatter never enforced `MAX_RUN_LENGTH`, so above 9×9 it would burn 200 attempts and return `null` | **Fixed** — overlong strips are broken with an interior black after the density loop; a 13×13 layout test passes the validator |

### E5 — Difficulty configs + `generateKakuro(difficulty, { gridSize })` + benchmark ✅

> *E4 pulled the entry point forward in a thin form (`kakuro.ts`: bounded rejection toward the
> requested tier, one density per size, fixture/nearest fallback). E5 replaces the inside —
> classifier in the objective, per-tier bias, bands, no fallback — without changing the contract.*

- `kakuro.ts`: per-size `DIFFICULTY_CONFIG` for all three sizes (D6′) — layout bias (density,
  run-length mix, unique-combo share targets from the research's T1–T5 table, treated as
  **starting points**), solver cap + necessity (`minTier`, as Killer/Keisan do), score bands from
  **measured** per-size distributions (recalibration protocol: never reuse cuts across sizes).
- **Calibration anchors (G8):** Mathimagics' ATK table — Easy = small grid, high `fixed`%,
  `rating` 1.0; Medium = bigger grid and/or fewer `fixed`, `rating` still 1.0; Hard = very low
  `fixed` (2–23 of 100+), `rating` 1.15–1.7. Combine `rating` with cell count and `fixed`% —
  rating alone under-rates large singles-only boards. Cross-check our tier histogram against it.
- Pipeline: bias layout → static rejection (E4) → fill → derive → **verify unique** → grade →
  band → accept; reject non-unique, any guess at any tier, and below-tier boards.
- `benchmark-kakuro.ts` + `benchmark-logs.md` rows; targets set from E3/E4 reality and logged.
- The mini ships whatever tiers **measure** as honestly separable (E3 picked the size to make
  e/m/h possible; if Hard still doesn't separate, ship fewer tiers — the Killer-4×4-easy-only
  precedent). The large size ships the full ladder if its generation fits the cron budget, else
  easy/medium/hard first.
- **Visible everywhere:** `/play` difficulty + size pickers go live for Kakuro; `/api/puzzle` and
  `/api/generate` switch from fixtures to `generateKakuro` (Zod-validated sizes per variant); the
  **hub card goes live** (`/play?variant=kakuro`, subtitle "Cross Sums"; `new!` moves off
  Keisan — D12); E2's soundness fuzz re-run over ≥ 500 generated puzzles per size.

**Gate:** bands disjoint per size; easy/medium/hard 9×9 < 500 ms avg; expert/extreme allowed to
be cron-only slow (Killer-extreme precedent, `maxDuration`), 0 generation failures in 20 per tier
and size; T4 must be *populated* (if fewer than ~10% of generated 9×9 land in T4 at the chosen
bound, move the bound, don't pad with surface sums).

**Step-log (2026-10-01 — PR [#122](https://github.com/zfert99/Puzzle-Generator/pull/122)):**

- *Process:* **the classifier in the objective.** `hillClimb` factored out of the repair, and
  `walkToTier` built on it: from a unique puzzle, mutate one cell at a time keeping uniqueness,
  with an objective that orders fills by distance from "exactly this tier" and has a gradient
  inside each band (shed above-tier steps to get easier; make the tier-below ladder leave more
  undecided to get harder). `generateUniqueKakuro({ targetTier })` runs it after the repair
  under one clock; `generateKakuro` is now that call with no fallback and no fixture — a throw
  on budget exhaustion (0 in 1,500). **The repair objective recalibrated** on 30 identical
  seeded 9×9 fills: count limit 50 → 200 and a 600-step stall cap took the cost per accepted
  puzzle from 2.0 s to 0.77 s (table in `kakuro-generator.md`). `generateKakuroBatch` replaced
  the fixture selector in `/api/generate` (with the usual 50-total / 5-extreme caps); the form's
  one-per-level cap and the configurator's `maxPerDifficulty` went with it; **the hub card is
  live** (`/play?variant=kakuro`, "Cross sums — runs that add up", the `new!` sticker moved off
  Keisan — D12); the deep link seeds the **6×6 mini** (D6′); `benchmark-kakuro.ts` + 15 rows in
  `benchmark-logs.md`. Tests: every size × tier generates at exactly the requested tier with the
  classifier re-deriving the label (15 cases), budget throw, ladder↔tier map, `walkToTier` to
  easy and to extreme on one base, route cases for 6×6 batches and the caps, the hub e2e, the
  play e2e at 6×6.
- *Measured* (`benchmark-kakuro.ts`, 10 per cell, ms avg): 6×6 51/104/37/60/72; 7×7
  401/158/283/403/124; 9×9 **265/528/365/191/773** (e/m/h/x/X). The tier walk alone: 9×9 easy
  0.14–0.30 s, extreme up to 1.6 s. **Soundness fuzz: 500 generated puzzles per size — 0 unsound
  steps, 0 label mismatches** at 6, 7 and 9. Natural T4 share at 9×9 ≈ 25% (E4's corpora) —
  the "T4 populated" gate holds and the bound stays 4.
- *Gates:* easy/hard 9×9 < 500 ms ✓ (265 / 365); **medium 9×9 528 ms — a near miss** on a
  10-sample average that swings run to run with repair-plateau tails (the same cell measured
  under 500 in other runs); expert/extreme allowed slow ✓ (191 / 773); 0 failures in 20 per
  tier and size ✓ (0 in 100 per cell in the fuzz); T4 populated ✓. "Bands disjoint" does not
  apply — see divergence.
- *Divergences from the spec:* (1) **no score bands and no per-tier density bias.** Tiers are
  the solver's ordinal levels (D5′/G9), so there is nothing to band; and the tier walk reaches
  every target from the natural distribution in under a second, so density stays the size knob
  E3 found. The scorer orders puzzles *within* a tier (dev badge; the daily later). (2) The
  mini ships the **full ladder**: 6×6 easy…extreme all measured separable and generable (E3's
  "fewer tiers if Hard doesn't separate" precedent was not needed). (3) The deep link seeds
  6×6, not 7×7 — E4 had kept 7 only because the mini had no fixture to fall back to.
- *Learnings:* L22 (put the grader in the objective: rejection toward a 1–3% tier is a lottery,
  a walk with a gradient is a few hundred cheap steps); L23 (calibrate an objective's cap on
  identical seeded inputs — the repair's count limit was a 2.6× lever hiding in a default).
- *Blockers:* none. **Owed to R1:** the daily registry (4 types, D4 — owner call on slot
  count), `/api/generate`'s schema and the PDF are done. Watch: the 9×9 repair-plateau tail (a
  few fills stall to the cap — the cron has the budget; `/play` sees ~0.3–0.8 s).

**Review follow-up 7 (2026-10-01 — hosted `/code-review high` over #122, 6 findings, all
addressed in [#123](https://github.com/zfert99/Puzzle-Generator/pull/123); recorded in full):**

| # | Finding (file) | Outcome |
|---|---|---|
| 1 | The walk's "easier than target" band was a constant 50 — it capped the ladder at `target − 1`, but a ladder that never needed more than `h ≤ target − 1` finishes under any cap ≥ `h`, so `undecided` was always 0; the up-walks were plateau random walks and the doc described a gradient that did not exist (`kakuro-generator.ts`) | **Fixed** — band keyed on tier distance first (`50 + 10·(target − h)`), then on `lean(h)`: the share of cells the ladder capped at `h − 1` leaves undecided. Measured on 15 identical seeded bases per cell: medians similar, **worst-case steps 1 832 → 287 (9×9 expert) and 886 → 338 (9×9 extreme)**; table in `kakuro-generator.md` |
| 2 | A batch had no shared budget: 50 puzzles × a 20 s per-call budget against a 60 s `maxDuration` (`kakuro.ts`) | **Fixed** — `generateKakuroBatch` runs under one budget (default 45 s), hands each puzzle what is left, and throws cleanly when spent; tested at 0 ms and with a two-puzzle batch |
| 3 | The walk's wall-clock cap was borrowed from `repair.msCap`; no walk options at all | **Fixed** — `walk?: WalkOptions` beside `repair`; the seeded tests widen both explicitly |
| 4 | `generateUniqueKakuro`'s JSDoc still described the E4 contract (label = whatever came out; a fallback) — AGENTS.md §2 | **Fixed** — rewritten for the walk, the target label and the no-fallback rule |
| 5 | The budget-throw test used a 1 ms budget (a first round could still start) | **Fixed** — 0 ms, deterministic |
| 6 | The final `classifyKakuro` repeated the walk's accepting solve verbatim and compared against a label that could not differ | **Fixed** — with a target the label *is* the target (the walk's accepting solve is the classifier's own call); the classifier runs only when no target was asked for |

*Learned (L24):* a gradient claimed in a doc is a hypothesis until the band's value has been
seen to vary — print the objective's distribution on a few states before trusting it.

**Review follow-up 8 (2026-10-01 — hosted `/code-review high` over #123, 6 findings, all
addressed in [#124](https://github.com/zfert99/Puzzle-Generator/pull/124); recorded in full):**

| # | Finding (file) | Outcome |
|---|---|---|
| 1 | An over-budget PDF batch surfaced as the generic 500 — no hint to ask for fewer (`generate/route.ts`) | **Fixed** — the batch's out-of-time error is typed (`isKakuroBudgetError`); the route answers **503** with "N of M generated, ask for fewer puzzles per PDF", logged as `generation_budget` at warn |
| 2 | The walk objective was a closure — nothing could test the property the flat band violated (`kakuro-generator.ts`) | **Fixed** — exported as `tierDistance(runs, size, target)`; a test on the baked fixtures pins 0 at the target, ≥ 100 above, strict ordering by tier distance below, and that two same-tier states score differently (L24 is now enforced, not just written) |
| 3 | A batch handed each puzzle the *whole* remaining budget — one pathological generation could starve the rest (`kakuro.ts`) | **Fixed** — fair share: up to four times the average share of what is left (≥ 5 s), a missed share retried on the next, only the batch's clock is the error |
| 4 | Nested `walk` / `repair` options could carry a second `rng`, breaking one-seed-one-puzzle | **Fixed** — `Omit<…, 'rng'>` on both; spread before the generator's `rng` |
| 5 | The easier band pays a second capped solve; the full solve's top-tier step share was proposed as a free signal | **Measured, not adopted** — same seeded bases: medians a wash, worst cases 20–50% longer at every cell; the capped solve stays (table in `kakuro-generator.md`) |
| 6 | Redundant `as KakuroTier` cast | **Fixed** |

### R1 — Daily rotation (4 types) ✅

- `Variant` → `'classic' | 'killer' | 'calc' | 'kakuro'` in `daily-row.ts` and the `schema.ts`
  `$type` (**no migration** — `text` column). `StoredCage` union gains the run shape.
- **Per-type sizes in the registry (D11):** `DailySize` stops being the global `4 | 6 | 9` and
  becomes "a size this type ships" — a `SIZES[variant] = { mini: number[]; standard: number }`
  table replaces the implicit 4/6/9 assumption in `isEligible`, `PROFILE` keys, and the roller's
  size rule. Existing types keep `{ mini: [4, 6], standard: 9 }` so nothing they do changes
  today; Kakuro registers `{ mini: [<E3's pick>], standard: 9 }`. Bests are already
  `(key, variant, size)`-scoped, so a mini slot whose size varies by type is safe.
- `PROFILE`: every eligible Kakuro `(size, difficulty)` gets floors + bot times; the
  `isEligible ⟺ getProfile` coverage test stays the tripwire. **Derive both from cell count, not
  logical rating (G2):** no Kakuro telemetry exists; anecdotes put a hard 9×9 at 10+ min for
  skilled solvers and the record density near 0.8 s/cell, so floors sit *well below* record
  density (roughly ≤ 0.5 s × white cells) and bot times near typical-skilled pace. Flag them as
  estimates in the JSDoc and tune from live attempts.
- `rollDailyAssignment`: standard draws `VARIANTS.length` = 4 distinct rungs of 5 (a 4-injection —
  every type must cover all five standard-size rungs, which E5 must deliver, or standard
  eligibility becomes per-type too); minis per **D4** (replace `PERMS_3` with a "choose 3 of N
  types, then permute" enumeration filtered by `isEligible`; the slot's size is drawn from the
  assigned type's `mini` sizes — for the existing types that reproduces today's
  "easy/medium = 4×4, hard = random(4/6)" behaviour exactly, and the roller test should assert
  it).
- `dailies.service` dispatch, `/api/daily` serve, `useDaily`, `slot-display` label ("Hard ·
  Kakuro", "Medium 7×7 · Kakuro"), picker + leaderboard tabs, `seed.ts` expectations.
- Verify with the plan's end-to-end checklist: exactly 3 + 3 rows/day, non-null variants, Kakuro
  appears in both sections over a seeded multi-day roll, archive/replay of old days unaffected.

**Gate:** roller property test (every day valid under `isEligible`, keys distinct, Kakuro reachable
in both sections, existing types' rolls unchanged); floors present for every rolled combo; live
`db:seed` round-trip.

**Step-log (2026-10-01 — PR [#125](https://github.com/zfert99/Puzzle-Generator/pull/125)):**

- *Process:* **D4 locked by the owner** ("leave minis at 3, add Kakuro to the rotation"). `Variant`
  gained `'kakuro'` (registry + `schema.ts` `$type`, no migration); `StoredCage` gained
  `StoredKakuroRun` — a Kakuro's runs ride the `cages` column (D2/D3's reason for shaping a run like
  a cage), with the run count as `clue_count`; `/api/daily` hands them back as `runs`. **Sizes are
  per type** (D11): `SIZES[variant] = { mini, standard }` — the Sudoku family `{ [4, 6], 9 }`,
  Kakuro `{ [6], 9 }` — drives `isEligible` and the roller; `PROFILE` gained eight Kakuro rows
  derived from cell count (G2), flagged as estimates. `rollDailyAssignment` draws one rung per
  type (4 of 5) and seats 3 of the N types into the minis via `miniConfigurations` (a general
  "ordered pick of 3 × hard size from the seated type's list" that replaces `PERMS_3`); restricted
  to the Sudoku family it reproduces the old six configurations exactly, and the test asserts it.
  `dailies.service` dispatches `generateKakuro`; `slot-display` labels Kakuro; `useDaily` carries
  the Kakuro payload; the cron comment says 7. Tests: roller at 7 slots (4 distinct rungs, all
  types; 3 distinct mini types; Kakuro only ever 6×6 in a mini; Kakuro reached in both sections
  over 300 seeds — in ~75% of minis), eligibility per type, the Kakuro row mapping, the service's
  counts and fallbacks at 7.
- *Measured:* a seeded dry run of five days with the real engines: 7 slots each, every profile
  present, 0.3–10.6 s per day (the slow case a 9×9 easy Kakuro walking down from a hard base) —
  inside the cron's 60 s.
- *Divergence:* the gate's "live `db:seed` round-trip" was **not run from the workstation**: the
  local `DATABASE_URL` points at the Neon instance that is very likely production, and a Kakuro
  row written before the serving code deploys would be served by the old route as a classic board
  of zeros. The round-trip happens on the first cron after deploy; the dry run above exercised
  roll → engines → row → profile without the database.
- *Learnings:* L25 (seed into the environment that will serve it — a dev workstation pointed at a
  shared database must not write rows the deployed code cannot read).
- *Blockers:* none. **Phase 10 is complete.**

**Review follow-up 9 (2026-10-01 — hosted `/code-review high` over #125, 6 findings, all
addressed in [#126](https://github.com/zfert99/Puzzle-Generator/pull/126); recorded in full):**

| # | Finding (file) | Outcome |
|---|---|---|
| 1 | The anti-cheat mistake cap counted Kakuro's black cells as empties — a 9×9 bounded as 81 cells instead of ~50 (`solve-rules.ts`) | **Fixed** — `maxPlausibleMistakes(grid, solution?)` counts only cells that are `0` in the puzzle and non-zero in the solution; the service passes both; tested (648 → 400 on a 50-white Kakuro, Sudoku family unchanged) |
| 2 | The generation fallback pool hardcoded `[9]` / `[4, 6]` beside the new per-type `SIZES` table (`dailies.service.ts`) | **Fixed** — candidate sizes derived from `SIZES` across the registered types, rolled size first |
| 3 | A uniform pick over configurations seated a one-size type (Kakuro) in the hard mini half as often as a two-size type (`daily-row.ts`) | **Fixed** — two draws: seating uniformly, then hard size within it. Measured over 2 000 seeds: hard seat classic 24% / killer 33% / keisan 20% / kakuro 23%; the roller test bounds every type to 15–35% (Killer's lead is the older easy/hard lean from its no-4×4-medium rule) |
| 4 | The hub's ContinueBanner labelled a saved board by size alone — "6×6 · hard" could be any of four types (`ContinueBanner.tsx`) | **Fixed** — `slotLabel` from the saved variant/size: "Hard 6×6 · Kakuro"; tests updated |
| 5 | No route-level test covered a Kakuro row served as `runs` (`api/daily/route.ts`) | **Fixed** — `route.test.ts` with the service mocked at the boundary: runs / cages / neither / 404 |
| 6 | The `Variant` union typed twice (`daily-row.ts`, `schema.ts` `$type`) | **Fixed** — `DailyVariant` lives with the column in `schema.ts`; the registry re-exports it |

### Deferred / follow-ons (not v1)

- **Revisit Classic / Killer / Keisan sizes under D11** — each type picks its own mini /
  standard / large instead of the inherited 4/6/9 (4×4 is trivial for most of them). Deliberately
  *not* part of this plan; the registry change in R1 is built so that it becomes a per-type
  table edit later, not a redesign.
- A **large Kakuro daily slot** — the daily has no "large" section; whether one is worth adding
  (and to which types) is a daily-design question, not a Kakuro one.
- Further sizes beyond the three (10×10, 13×17 print mode) — `GridSize` widening must stay
  per-variant-gated (Keisan Risk 6).
- An **experimental bounded-T&E tier** "beyond published difficulty" (the Keisan snapshot shape),
  clearly labelled, never in the daily — only if players ask for it.
- **2-cut surface sums** (sum/difference of two cells) — Berthier skipped them; revisit only if
  the T4/T5 population needs it.
- A combination-reference helper in the board UI (G12) — an assist policy question first.
- Hint agent coverage; Strategy-course lessons for Kakuro techniques (Phase 7 hook).
- Simonis-style clue *erasure* (removing redundant clues while unique) as a difficulty lever —
  changes the "every run is clued" rule and the UI; research it before adopting.

## 5. Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | Generation yield collapses at 9×9 (the research's headline warning) | E3 measures *before* E4; density + template library + structural pre-checks are the levers; re-slice early, not inside E4 |
| 2 | Uniqueness verification too slow for the cron's `maxDuration` at expert/extreme | Node budget + early exit at 2; Killer-extreme precedent already tolerates ~5.5 s cron-only tiers; look-ahead propagation as the optional booster |
| 3 | Chain / surface-sum logic mis-implemented (plausible-but-wrong — the AI failure mode) | Soundness fuzz vs exact solutions on every logical placement; whip eliminations re-verified by the exact solver in tests; T4 necessity gate proves the rung actually fires |
| 4 | Board assumes every cell is playable (selection, arrow nav, "all digits placed" counter, peers) | `blocked` mask threaded through Cell/Board/Numpad; run-based peers builder; E2E asserts a blocked cell cannot take a digit |
| 5 | Numpad and "exhausted digit" logic keyed on `config.size` | Drive from `config.maxNum`; disable the exhausted counter for Kakuro (no per-digit global count exists) |
| 6 | The daily roller hardcodes 3 minis (`PERMS_3`, `MINI_KEYS`), a global `DailySize = 4 \| 6 \| 9`, and assumes all types cover 9×9 | D4 + D11's per-type `SIZES` table + the generalized enumeration in R1; the coverage test and a roller property test (existing types' rolls unchanged) are the tripwires |
| 7 | The mini size's "hard" is not honestly separable from medium without T&E | E3 picks the mini size *for* separability (6×6 vs 7×7); if Hard still fails, ship the tiers that measure separable (Killer-4×4-easy-only precedent); eligibility follows measurement |
| 15 | A 13×13 large board (14 columns with the clue gutter) is unreadable on phones | Measure cell size at 360 px in V2; cap the large size out of `/play` on narrow viewports (PDF unaffected) rather than shrink digits below legibility |
| 8 | The **whip/g-whip engine** is the plan's largest engineering unknown (nothing in-repo chains over non-binary constraints), and T4 may be sparse at a naive length bound | Spike the redundant-variable model inside E2 before fixing the bound; the E5 gate requires T4 to be populated; port Berthier's *model*, not his CLIPS code; surface sums as an accelerator only |
| 14 | Japan trademark on "Kakuro" is live and asserted by Nikoli | US/EU-facing product; "Cross Sums" is a one-constant fallback title; no Nikoli affiliation implied anywhere; re-check TSDR/eSearch before paid marketing |
| 9 | "N×N" naming ambiguity confuses players and floors (interior vs counted border) | D2 fixes interior naming; rules dialog says so; `grid.length` stays the interior size |
| 10 | Duck-typing `'runs' in puzzle` creeps in and misclassifies | Real `variant` discriminant landed at the top of V2 (K5 lesson) |
| 11 | Trademark surprise on the display name | Slug `kakuro` is internal; display name is one constant (`VARIANT_TITLE`, hub card, labels) — renameable without churn |
| 12 | Anti-cheat floors guessed too low/high with no in-repo prior | G2 — external solve-time baselines; conservative floors first, tune from real attempts |
| 13 | Storing runs in `cages` jsonb tempts cage-style rendering/pencil logic to run on Kakuro rows | `variant` gates every reader (already the Keisan rule); a test that a Kakuro row never renders a `CageOverlay` |

## 6. Definition of done (v1)

Kakuro at its own three sizes (mini per E3, 9×9 standard, 13×13 large — D6/D11): unique,
symmetric, **logic-only at every tier** (chain rungs, zero guesses),
difficulty-banded on measured per-size cuts with the classifier as the label source; playable on `/play` with blocked cells,
clue rendering, 1–9 numpad, run-based peers/stripping, save/resume; printable; on the hub; in the
daily as the fourth type per D4; profile floors + bot times for every eligible combo; full test
battery + E2E green; benchmarks logged; mirrored docs synced; roadmap + README flipped; the
running log's open decisions resolved or explicitly deferred with a reason.
