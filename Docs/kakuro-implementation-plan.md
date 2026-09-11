# Kakuro (Cross Sums) — Implementation Plan

> **Status:** 📋 Planned (plan written 2026-09-11; nothing built) · **Branch:** fresh
> (`feature/kakuro`) · **Roadmap:** Phase 10 in [roadmap.md](roadmap.md)
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
| D2 | **Interior N×N storage + explicit runs list**; clue cells render in a one-cell gutter (top + left) plus inside interior black cells. `grid.length === N` stays true everywhere (`DailySize`, profile lookup, board config) | Proposed — confirm |
| D3 | Black cells are `0` in both `grid` and `solution`; **blocked = "in no run"**, derived from `runs` at game start (like `cellToCage`). No `-1` sentinel leaks into `Grid` consumers | Proposed — confirm at V1 |
| D4 | Daily at 4 types: **keep 3 mini slots and roll 3 of the 4 types** each day; a mini slot holding a type is played at **that type's mini size** (D11), so the "easy/medium = 4×4, hard = random(4/6)" rule is retired for types with a single mini size | Open — owner (slot count); size part follows D11 |
| D5 | ~~T5 = bounded depth-1 recursion (Keisan transplant)~~ → **Every published tier is logic-only. T1–T3 by the technique ladder; T4 = whips of bounded length; T5 = longer whips / g-whips.** Surface sums (1-cuts) are an accelerator inside T4+, not a rung. Bounded T&E survives only as an optional, labelled *experimental* tier outside the daily | **Superseded 2026-09-11 by G5** — new form proposed, confirm |
| D6 | **Three sizes, chosen for Kakuro, not inherited from Sudoku:** a **mini** (smallest size that carries an honest easy/medium/hard — 6×6 or 7×7, E3 decides), a **standard** (9×9 interior — the research's 8–10 sweet spot, odd for the edges-inward centre line, and what the standard daily slot expects), and a **large** (13×13 proposed — odd, near the Krazydad 13×17 print size; play + PDF, daily later). **No 4×4.** | Proposed — mini size decided by E3 (G6) |
| D11 | **Sizes are per puzzle type.** Each type ships three: the smallest size that is genuinely interesting for *that* puzzle, its standard size, and a large size. Minis in menus and the daily are "the type's smallest size", not a fixed 4×4/6×6. Kakuro is the first type built this way; revisiting Classic/Killer/Keisan under the same rule is deferred (4×4 is trivial for most of them) | Locked by owner 2026-09-11 (principle); Kakuro sizes per D6 |
| D12 | **Build order is visual first, simplest → hardest:** a hand-baked puzzle is playable and printable (V1–V3) before any engine code; each engine slice lands on that board and is judged by what it makes visible. The **hub card goes live only at E5** (when "New puzzle" is real); until then `/play?variant=kakuro` is reachable by URL for building and E2E, so `main` never advertises a one-puzzle type | Locked by owner 2026-09-11 (order); hub timing proposed |
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
| 1 | V1 — Types + baked fixtures | Nothing yet — the data a board can render |
| 2 | V2 — Board on the baked puzzle | A playable Kakuro at `/play?variant=kakuro` |
| 3 | V3 — PDF on the baked puzzle | A printable Kakuro page in the booklet |
| 4 | E1 — Combination table + exact solver + uniqueness | Hint button backed by a real solver; "unique ✓" on the fixture |
| 5 | E2 — Logical solver + classifier | A difficulty badge and technique-by-technique hints |
| 6 | E3 — Yield measurement spike | Numbers in the log; the mini size chosen (D6′) |
| 7 | E4 — Layout + fill + clue derivation | "New puzzle" produces a fresh board |
| 8 | E5 — Difficulty configs + `generateKakuro` + benchmark | The difficulty and size pickers go live; hub card live |
| 9 | R1 — Daily rotation (4 types) | Kakuro in the daily |

### V1 — Types + baked fixtures ⏳

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

### V2 — Board on the baked puzzle ⏳

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

### V3 — PDF on the baked puzzle ⏳

- `drawKakuroGrid` + `generateKakuroPDF` on the shared nav helpers (bookmarks + puzzle↔answer
  links). Print conventions (G7): light interior lines with a heavier outer border, **shaded clue
  cells**, both sums in their triangles, one puzzle per page, answers on a separate page.
- `/api/generate` gains a Kakuro branch that, until E5, renders the fixtures; PuzzleForm gets a
  Kakuro section with Kakuro's sizes (D11); sample booklet regenerated with a Kakuro page.

**Gate:** a Kakuro page in the sample booklet, verified by eye; PDF service tests cover the
renderer.

### E1 — Combination table + exact solver + uniqueness ⏳

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

### E2 — Logical solver (technique classifier) + instrumentation ⏳

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

### E3 — Yield measurement spike (throwaway, no production code) ⏳

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

### E4 — Layout generator + digit fill + clue derivation ⏳

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

### E5 — Difficulty configs + `generateKakuro(difficulty, { gridSize })` + benchmark ⏳

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

### R1 — Daily rotation (4 types) ⏳

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
