# Skyscrapers (Towers) — Implementation Plan

> **Status:** 🚧 In progress (plan written 2026-10-01; build started 2026-10-01 — V0 built, owner's
> visual verdict pending). · **Branch:** one per slice off
> `main` (`feature/skyscrapers`, then `-v1`, `-v2`, … as Kakuro did; never stacked — V1's step-log
> in the Kakuro plan says why) · **Roadmap:** Phase 11 in [roadmap.md](roadmap.md)
> **Running log (decisions · gaps · bugs · learnings · measurements):**
> [skyscrapers-log.md](skyscrapers-log.md) — every `D#` / `G#` referenced below lives there with
> its current status.
> **Research:** [skyscrapers.md](research/skyscrapers.md) (the deep report this plan is built
> from; its research-gaps table seeds G1–G12) ·
> [skyscrapers-research-gaps-findings.md](research/skyscrapers-research-gaps-findings.md) (answers
> to G1, G2, G9, G10 and a narrowed G5, received 2026-10-01 — **amended D1** with a wired "Towers"
> fallback and **D9** to Tatham's prefix rule; see §1b) · [kakuro-implementation-plan.md](kakuro-implementation-plan.md)
> (the sibling plan this one copies, slice for slice, and the source of the D11/D12 owner rules) ·
> [kakuro-feasibility-findings.md](research/kakuro-feasibility-findings.md) (the de-risk pattern E3
> copies) · [daily-redesign-plan.md](daily-redesign-plan.md) (how a type registers into the daily;
> its "end state (5 types): 5 + 3" is what R1 delivers) ·
> [kenken-implementation-plan.md](kenken-implementation-plan.md) (Keisan — the Latin-square
> substrate this engine reuses) · [puzzle-grid-size-landscape.md](research/puzzle-grid-size-landscape.md)

This is a **living handoff document** (AGENTS.md → Living Planning Docs). Each slice carries its
spec now and gains a **step-log** (process · learnings · blockers) when it lands. Cross-cutting
decisions, research gaps, bugs, and measurements go in the [running log](skyscrapers-log.md), not
here, so this doc stays a plan and the log stays a record.

## 1. What the research locks in (before any code)

Skyscrapers is the **fifth and final planned puzzle type**: an N×N **Latin square** of heights
1..N (every row and column holds each height once — no boxes) plus **edge clues** in a one-cell
gutter on all four sides, each clue = the number of towers *visible* from that edge looking inward,
a taller tower hiding every shorter one behind it. Two constraints, one of them already in the
repo (the no-box Latin square is exactly the Keisan substrate); the only genuinely new piece is the
**visibility count**. That single fact drives the reuse map below — this is the *least* new engine
of the five, and the plan is sized accordingly.

- **Naming.** Invented 1992 by Masanori Natsuhara (Sekai Bunka-sha's *Puzzler*, ビルディングシティパズル);
  **not a Nikoli puzzle**; every publisher ships it as "Skyscrapers" (Tatham: "Towers"; DE
  Hochhäuser; IT Grattacieli). The only U.S. filing found is an unrelated 1997 "SKYSCRAPER" 3D-game
  application, abandoned 1998. **The gap-findings then queried the registers (G1):** US and Japan
  clear; the **EU/UK holds a live singular "SKYSCRAPER" games-software mark** (Inspired Gaming,
  cl. 9/28/41/42, expiring 2027-10-12, flagged not-to-be-renewed) — so "Towers" is **wired as the
  fallback title**, the Kakuro / "Cross Sums" posture → **D1**. Beware the collision with the *Sudoku technique* also named "Skyscraper"
  (HoDoKu single-digit patterns) — the HumanSolver does not implement it today, so the puzzle-type
  label is free, but the name is reserved in the log so a future technique never clashes in hints
  or telemetry.
- **The engine is Latin square + visibility.** Every fast solver converges on one primitive: a
  **per-N permutation table bucketed by (left clue, right clue)** — N! = 120 at 5×5, 720 at 6×6,
  5,040 at 7×7, 362,880 at 9×9 (≈ 4 MB) — intersected with per-cell bitmasks and MRV search.
  Tatham's `towers.c` caps at 9×9 only because its enumeration is *unmemoised*; precomputing the
  table removes that reason. Cheap rules first (clue 1 / clue N, facing clues summing to N+1,
  the position bound) cut permutation work ~8× in krnsk0's measurement (12,000 → 1,490).
- **Complexity.** NP-complete (Iwamoto & Matsui 2016), even for completing a single line
  (Haraguchi & Tanaka 2017). **No ASP-completeness result exists** (unlike Kakuro), so the formal
  status of uniqueness checking is open — irrelevant at N ≤ 9 where a count-to-2 solver is
  milliseconds → **G2** (low priority).
- **Difficulty rides which clues are blank and which values they carry, not clue count.** 1s and
  Ns resolve a cell or a whole line in one move; facing clues summing to N+1 pin N; mid-range
  clues only bound. A fully-clued 6×6 with every clue in {2,3,4} carried GM Puzzles time
  standards of 9/18/36 minutes. Tiers calibrate **within a size** from the technique classifier
  (the Keisan/Kakuro principle), parameters only bias → **D7**. **Every published tier is
  logic-only** — only Tatham ships a guessing tier ("Unreasonable"), every commercial publisher
  says "no guessing" → **D6**, guess count 0.
- **Technique ladder (rungs 0–10, research §2).** 0 clue-N / clue-1 → 1 facing clues a+b = N+1 →
  2 position bound (exclude height h from distance d < c + h − N − 1) → 3 nearly-filled clue →
  4 Latin singles → 5 clue-2 patterns + visible-count reachability → 6 **per-line permutation
  filtering** against one clue pair (the catch-all: every clue-2 trick and every Conceptis
  "advanced technique" is a special case) → 7 Latin pairs/triples → 8 single-digit fish on
  rows×columns → 9 bivalue forcing chains → 10 bifurcation (**never shipped**). The ordering of
  rungs 5–7 is the research's proposal, not a published standard → **G7** (E2/E5 histograms
  decide).
- **Generation is Tatham's pipeline, which is already the platform's pipeline.** Latin fill → all
  4N clues → remove clues (not cells) while unique *and* solvable at ≤ target tier → accept only
  at exactly the target tier, else regenerate. **The twist:** a Latin square with *all* 4N clues
  is frequently **not unique** — 35.42% at 4×4 and 57.61% at 5×5 by exhaustive enumeration
  (measured in the research, replicated in-session); N ≥ 6 is unmeasured → **G4**, the first E3
  question. Random *valid* puzzles need backtracking; published ones fall to propagation (krnsk0)
  — the same lesson as Kakuro: label from the classifier, never from the parameters.
- **Sizes are Skyscrapers' own** (owner rule **D11**, inherited from Kakuro). Publishers cluster at
  5×5–7×7: 6×6 is in every catalogue and the only size Tatham gives the full ladder; 4×4 is a
  teaching size (Tatham ships only 4×4 Easy; Puzzle Baron does not ship it); 7×7 is Conceptis's
  "several hours" ceiling; 9×9 is a weekly special where it appears at all; 8×8 has the weakest
  support of any size. Research recommends **mini 5×5, standard 6×6, large 7×7** with 4×4 and
  9×9 as the alternatives — **D4**, settled by E3's measurement, not inherited.
- **Rendering + a11y conventions (research §6, corrected by the gap-findings §G10).** Four-sided
  gutter of plain digits (arrows optional); a violated clue in the error colour **as soon as the
  violation is provable from the filled prefix** (Tatham's `check_errors`; puzzle-skyscrapers.com
  waits for a full line — the prefix rule is earlier with the same zero false positives); **no
  player auto-tints a satisfied clue**; Tatham, Brainbashers and puzzle-skyscrapers.com all have a
  manual click-to-grey "done" toggle (Tatham's undo-able, `COL_DONE`); Conceptis's clue click is a
  visibility visualiser; WAI-ARIA grid of (N+2)×(N+2) with read-only gutter gridcells,
  roving tabindex, clue-direction announcements; **no accessible Skyscrapers implementation exists
  anywhere** → **D9**, gap **G8**. Print (G9, measured from Krazydad and three championship
  booklets): clue digits **½ the solved digit, one tone lighter**, no arrows, 0.2–0.5 cell clear of
  a frame **≥ 3× the inner rule** (Krazydad: 5 pt over 1 pt grey), one puzzle per page, answers
  gridded on one page without clues — the Kakuro PDF template extended to four sides.
- **Solve-time telemetry is absent publicly.** GM Puzzles' time standards (very hard 6×6:
  9:00 / 18:00 / 36:00 for Grandmaster / Master / Expert) and a ~3.4–4.5 s hall-of-fame on small
  Easy grids are all there is. Floors come from **cell count** first and own telemetry later →
  **G6** (the Kakuro G2 rule).

### 1b. What the gap-findings changed (2026-10-01)

The [findings doc](research/skyscrapers-research-gaps-findings.md) answered four gaps and narrowed
a fifth on the day the plan opened. The deltas:

1. **"Towers" is a wired fallback title, not a subtitle only (G1 → D1).** A live EU/UK word mark
   "SKYSCRAPER" (Inspired Gaming, class 9 "games software", expiring 2027) exists; the US and Japan
   are clear. Same posture as Kakuro's live Japanese mark: one constant, switchable, no affiliation
   implied, professional read before an EU logo.
2. **Violations show when provable, not when the line is full (G10 → D9).** Tatham's prefix rule
   is O(N), earlier, and has zero false positives; nobody auto-tints satisfied clues (off by
   default); the manual done toggle is undo-able and persisted, drawn error > done > normal. The
   research doc had quoted a stale mirror — corrected there, L4 in the log.
3. **Print numbers (G9).** Clue digit = ½ the solved digit and one tone lighter; frame ≥ 3× the
   inner rule; no arrows; answers 3 × 4 per page without clues. V3 drops the "60–70%" guess.
4. **Minimum clues ≈ N−1 (G5).** Nakamura's conjecture (verified to N = 8) and an exact 4×4
   measurement (3 clues suffice, 2 never). E1 pins the 4×4 facts as tests; E3 (e) measures the
   minimum *surviving* count per size.
5. **ASP-completeness (G2)** is open for clue-only Skyscrapers and settled (yes) once givens are
   allowed — no practical consequence; count to 2.

Still open: **G3 / G4 / G7 / G12** (E3 measures), **G6** (telemetry), **G8** (screen-reader
pass), **G11** (owner — the first non-9×9 daily standard).

## 2. What we already have (reuse map)

Surveyed 2026-10-01 against `main` (`946d83f`). "Reuse" means import or copy the pattern; "new"
means Skyscrapers needs its own. The headline: **the Latin-square half of the engine, the board,
the PDF nav, the daily registry and the generate-and-grade pipeline all exist** — the new work is
the visibility constraint, a four-sided gutter, and the clue-removal generator.

| Area | Existing | Skyscrapers | Notes |
|---|---|---|---|
| Latin-square fill | `grid-utils.fillGrid(grid, config, rng)` — MRV bitmask backtracker; boxless when `boxWidth = size, boxHeight = 1` (`calcGridConfig(size)` in `calc-generator.ts` builds exactly that) | **Reuse** | `createEmptyGrid(N)` + `fillGrid(grid, skyscrapersGridConfig(N), rng)` is the whole fill. Shuffle rows/columns/symbols afterwards if isotopy bias ever matters (research: avoid cyclic-shift samplers) |
| Grid config | `sudoku.ts` `GridSize = 4 \| 5 \| 6 \| 7 \| 9`, `GridConfig { size, hasBoxes, boxWidth, boxHeight, totalCells, maxNum }`; `getGridConfig(size)` makes **5 and 7 boxless but 4, 6, 9 boxed** | **New `skyscrapersGridConfig(N)`** | Copy `calcGridConfig`: boxless at *every* N (a 6×6 Skyscrapers has no 2×3 boxes), `maxNum = N`. `GridSize` already contains 5 and 7 — no union widening for the recommended sizes |
| Exact solver | `calc-solver.ts` `CalcSolver.countSolutions(limit = 2, nodeBudget)` (−1 on budget); `kakuro-solver.ts` `countKakuroSolutions` (typed-array shape, ring-buffer queue, MRV, early exit at 2) | **New** (`skyscrapers-solver.ts`) | Copy the Kakuro shape (compiled typed arrays, node budget, `exhausted` flag); the propagation unit is the **line against its clue pair**, via the permutation table — nothing in-repo filters a line by a permutation bucket |
| Permutation / visibility table | nothing | **New** (`skyscrapers-visibility.ts`) | Per-N lazily built, cached: `perms`, `visL[p]`, `visR[p]`, `bucket(visL, visR)`. 4! … 7! trivial; 9! ≈ 4 MB — build it only if E3 keeps 9×9 |
| Logical solver + grading | `CalcLogicalSolver` (tiers 1–4: `cageArithmetic`/`nakedSingle`/`hiddenSingle` → `nakedPair`/`hiddenPair`/`cageComboRestriction` → `lineSum` → `xWing`; tiers 5–6 Nishio), `CalcSolveResult { solved, hardestTier, techniqueCounts, passes, avgOpenSingles, maxGuessDepth, guessSteps }`, `scoreCalcSolve`; `KakuroLogicalSolver` + `classifyKakuro` / `measureKakuro` / `explainKakuroHint`, `scoreKakuroSolve` | **New solver, reuse both patterns** | The Latin techniques are *sound unchanged* here — unlike Kakuro (log L12), every row and column holds every height, so hidden singles/pairs/fish need no `required` guard. Copy the result shape, the `explain…Hint` lead-up pattern, and the two-factor scorer; write the visibility rungs fresh |
| Chain engine | `kakuro-chains.ts` (g-braids over run-combination variables); classic `HumanSolver` AIC/ALS (house-based, 9×9 only) | **Mostly not reused** | Rung 9 (bivalue forcing chains) is Tatham's `latin_solver_forcing` — a short contradiction walk over Latin bivalue cells plus one clue; far simpler than Kakuro's g-braids. Write a small walker; do not port either existing engine |
| Generate-and-grade pipeline | `generateKakuro(difficulty, { gridSize, rng, timeBudgetMs })` + `walkToTier` (classifier in the objective, `tierDistance`), `generateKakuroBatch` (one 45 s budget per batch), `KAKURO_BUDGET_ERROR`; `generateCalcSudoku` (rejection toward a tier) | **Copy the contract** (`skyscrapers.ts` → `generateSkyscrapers`) | The *mechanism* differs: Skyscrapers removes **clues** from a fully-clued square (Tatham), so the objective is "which clues to keep" rather than Kakuro's fill-mutation walk. Keep the budget error + batch contract so `/api/generate` treats it like Kakuro |
| Benchmarks | `benchmark-kakuro.ts` → `appendBenchmarkRows(rows)` (`benchmark-log.ts`); row format `\| ts \| commit \| label \| avg ms \| max ms \|` | **Reuse** (`benchmark-skyscrapers.ts`) | One row per (size, tier), randomized inputs |
| Board store | `useBoardStore.ts`: `PuzzleVariant`, `BoardPuzzle` union, `config: GridConfig`, `candidates` bitmasks, `givens`, `peers` via `buildPeers` (`computeRunPeers` when `runs.length > 0`, else `computePeers(config)`), `runs`/`blocked`/`cellToRuns`/`clues` (Kakuro), `pencilMode`; actions `inputDigit`, `clearCell`, `hint`, `togglePencilMode`, `revealErrors` | **Extend** | `'skyscrapers'` joins the union; config from `skyscrapersGridConfig`; peers = `computePeers` on the boxless config (row + column — correct); pencil stripping on placement is correct (Latin). New state: `edgeClues` (four arrays) + per-line satisfaction derived on completion. **Real discriminant** (`puzzle.variant`), never `'clues' in puzzle` (K5 lesson) |
| Board rendering | `Board.tsx`: `tracks = isKakuro ? kakuroTracks(size) : size`; gutter = one `ClueCell` row on top + one leading `ClueCell` per row — **top + left only**; `move(dr, dc)` skips `blocked` for Kakuro, clamps at edges. `Cell.tsx`: `Cell`, `ClueCell({ clue, colIndex })` (`role="gridcell"`, `tabIndex={-1}`) | **Extend** | Generalise to a `tracks = size + 2` four-sided gutter (bottom row, trailing right cell); a `SkyscraperClueCell` showing one digit with state (open / satisfied / violated / marked done); arrow keys never land on gutter cells. The display-coordinate helpers for Kakuro live in the engine (`kakuro-layout.buildClues`, `kakuroTracks`) — put Skyscrapers' in `skyscrapers-types.ts` from day one (Kakuro V3's lesson: move on the second consumer, so start there) |
| Numpad | `Numpad.tsx` — digits `1..config.maxNum`; greys out completed digits except for Kakuro | **Free** | `maxNum = N`; the "digit exhausted" counter is **correct** for Skyscrapers (each height appears exactly N times) — leave it on |
| Solved check | cell-for-cell match against `solution` | **Free** | No blocked cells, no givens by default (D3) |
| Rules dialog | `RulesDialog.tsx` — private `VARIANT_TITLE`, `RulesBody` if-chain, `hasSeenRules` | **Extend** | One new title + body ("Skyscrapers", subtitle "Towers") |
| Size / play surface | `PlayExperience.tsx` — private `PlayVariant`, `SIZES = { classic: [4,6,9], killer: [6,9], calc: [4,6,9], kakuro: [6,7,9] }`, `VARIANT_LABEL`, `parseVariant`, `topTiersLockedFor(variant, size)` (= `size !== 9 && variant !== 'kakuro'`); `GridSizeSelector` (`SelectableSize = 4 \| 6 \| 7 \| 9`, generic over `sizes`) | **Extend** | Skyscrapers' sizes per D4; `SelectableSize` gains 5; `topTiersLockedFor` becomes a per-type rule (Skyscrapers offers all five tiers at *every* size that E5 proves) |
| Save / resume | `useSavedGame` — `SavedGame { mode, difficulty, variant, gridSize, elapsedTime, dailyDate }`; persist `merge` rebuilds derived fields (Kakuro B1 / L8) | **Extend** | `edgeClues` must be rebuilt/derived in `merge`, not after hydration (L8); round-trip test that hydrates from storage (L10) |
| Puzzle fetch | `usePuzzle.fetchPuzzle({ difficulty, gridSize, variant, noOp })` → POST `/api/puzzle` (inline per-variant size/difficulty guards; Kakuro branch uses `KAKURO_LADDER × KAKURO_SIZES`) | **Extend** | One branch, `SKYSCRAPERS_LADDER × SKYSCRAPERS_SIZES`; Zod-validate it (the Kakuro `/api/generate` branch is the only Zod'd one today — follow it) |
| PDF | `pdf.service.ts`: `drawGrid`, `drawKillerGrid`, `drawCalcGrid`, `drawKakuroGrid(doc, puzzle, x, y, size, showSolution)`, private `drawCenteredDigit`, `drawCagedGrid`, `addPageNavigation`, `drawCrossLink`; `generateKakuroPDF(puzzles)`; `preview-kakuro.ts`; `Docs/samples/kakuro-sample.pdf` | **New renderer, reuse nav + digit helper** | `drawSkyscrapersGrid` (four-sided gutter digits at ~60–70% of cell-digit size, bold frame on the N×N, no arrows) + `generateSkyscrapersPDF`; `preview-skyscrapers.ts`; a sample booklet |
| Print form + API | `/api/generate` (`kakuroRequestSchema` Zod; Killer/Calc hand-validated; `MAX_PUZZLES = 50`, `MAX_EXTREME = 5`, `maxDuration = 60`); `PuzzleForm.tsx` toggles over the four variants, per-variant size state; `DifficultyConfigurator` (`variant` prop, `slowGenerationWarning`); `usePuzzleGeneration.PDF_FILENAME` | **Extend** | One Zod schema, one toggle, one filename |
| Hub | `PuzzleHub.tsx` Play / Compete / Print; `PuzzleCard({ href?, emoji, title, desc, tilt?, sticker? })`; the Kakuro card wears `new!` | **Extend** | A Skyscrapers card at E5; `new!` moves off Kakuro (D12: newest thing wears it) |
| Daily registry | `daily-row.ts`: `Variant`, `VARIANTS` (4), `DailySize = 4 \| 6 \| 9`, `SIZES[variant] = { mini, standard }` (all standards are **9** today; Kakuro `{ mini: [6], standard: 9 }`), private `PROFILE` keyed `` `${variant}-${size}-${difficulty}` `` → `{ minSolveMs, botTimeMs }` via `getProfile`, `isEligible`, `rollDailyAssignment` (one standard per type + 3 minis; hard seat = two draws), `MINI_KEYS`, `toDailyPuzzleRow` (Kakuro runs → `cages`) | **Extend** | The 5th type makes the standard roll a **5-rung bijection** (the daily plan's end state) — every type must cover all five rungs at its standard size. **A 6×6 standard is the first non-9×9 standard** → `DailySize` gains 5 and 6-as-standard, and the "standard = 9×9" copy in the daily plan/roadmap changes → **D5**, gap **G11** |
| Daily storage | `schema.ts` `daily_puzzles.variant` (`text`, `$type<DailyVariant>`), `cages: jsonb $type<StoredCage[]>` where `StoredCage = StoredKillerCage \| StoredCalcCage \| StoredKakuroRun` | **Reuse column, new shape** | Edge clues are not cage-shaped. Store them as `StoredSkyscraperClue { side, index, count }[]` in the same untyped jsonb with `variant` gating every reader (Keisan L2 rule), **or** add a nullable `clues` jsonb column (additive migration). → **D2** (recommendation in the log) |
| Daily surfaces | `dailies.service.ts` `generatePuzzleFor(slot)` switch + `generateSlotWithFallback` pool from `SIZES`; `/api/daily` builds `caged` per variant; `useDaily` `DailyPuzzleResponse` union; `slot-display.VARIANT_LABEL`; picker (`DailyExperience`) + leaderboard tabs render `slotLabel`; `seed.ts`; cron `.github/workflows/daily-puzzles.yml` | **Extend** | One label, one dispatch branch, one response branch, one hook branch |
| Anti-cheat | `solve-rules.ts`: `gridsMatch`, `isImplausiblyFast(variant, size, difficulty, ms)` via `PROFILE`, `maxPlausibleMistakes(puzzleGrid, solution)` (solution-aware since #126) | **Free + tune** | No zeros in a Skyscrapers solution → the mistake cap counts every cell, correctly. Floors per **G6** |
| Hub / sitemap / SEO | `sitemap.ts` lists static routes only (no `?variant=`); no `robots.ts` | **Nothing** | Recorded so V0's workbench route knows to set `robots: { index: false }` in metadata, as Kakuro's did |
| Hint agent (MCP over `HumanSolver`) | Classic only | **Non-goal** | Recorded so it isn't rediscovered as "just add a variant" |
| E2E | `e2e/play.spec.ts` holds one Kakuro test (`plays a Kakuro: clue gutter, 1–9 numpad at the 6×6 mini, …`); `a11y.spec.ts`, `archive.spec.ts`, `home.spec.ts` | **Extend** | One Skyscrapers play test (four-sided gutter renders, digits 1..N, a completed violated line marks its clue, board starts empty); a11y spec covers gutter cells |
| Hardcoded variant lists | `PuzzleVariant`, `PlayVariant`/`SIZES`/`VARIANT_LABEL`/`parseVariant`, `VARIANT_TITLE`/`RulesBody`, `usePuzzle`'s unions, `PuzzleForm` toggles + `PDF_FILENAME`, `DifficultyConfigurator` prop, `DailyVariant`/`VARIANTS`/`SIZES`/`PROFILE`, `slot-display.VARIANT_LABEL`, `generatePuzzleFor`, `/api/daily` spread, `toDailyPuzzleRow`, `GridSizeSelector.SelectableSize`, `DailySize` | **≥ 14 edits** | Listed so V2/V3/R1 each have a checklist; the fifth type is the moment to ask whether a single `VARIANT_REGISTRY` should own label + sizes + ladder (**deferred**, §4 "Deferred" — not inside this plan) |

## 3. Locked and proposed decisions (summary — details and status in the log)

| # | Decision | Status |
|---|---|---|
| D1 | Display **Skyscrapers**, subtitle **Towers**; engine/slug `skyscrapers`; the title is **one constant with "Towers" wired as the fallback title** (a live EU/UK "SKYSCRAPER" games-software mark exists; US/JP clear); no publisher affiliation implied; the technique name "Skyscraper" is reserved in `STRATEGY_NAMES`' vocabulary so a future HumanSolver pattern never collides with the type label | **Locked 2026-10-01** (G1 resolved); professional read before any EU logo / paid use |
| D2 | **Interior N×N `grid` + `solution`, plus `clues: { top, bottom, left, right }`** (length-N arrays, **0 = blank**); display is (N+2)×(N+2). `grid.length === N` stays true everywhere. Daily storage: clues ride the existing `cages` jsonb as `StoredSkyscraperClue[]` with `variant` gating every reader (no migration) — the nullable-`clues`-column alternative is recorded | **Proposed — owner may veto the column reuse** |
| D3 | **No givens at any published tier** (the commercial norm; Tatham allows them). `grid` keeps the slot so Tatham-style fixtures round-trip; the generator never emits givens in v1 | Proposed (research) |
| D4 | **Three sizes, chosen for Skyscrapers:** mini **5×5** (vs 4×4), standard **6×6**, large **7×7** (vs 9×9). **Planned at the recommendation** — V0–V2 build and show 5/6/7 — and **still measured by E3** (tier reachability at guess count 0 and per-tier yield at 5/6/7 and at 4, 9 for the alternatives; 7-vs-9 line-filter wall time), which can overturn any of the three. 4×4 survives, if at all, as a tutorial board; 9×9 as a later weekly special | **Planned by owner 2026-10-01** ("plan for recommended but still measure"); E3 confirms or overturns |
| D5 | **A 6×6 standard is the first non-9×9 daily standard.** `DailySize` widens (5, 6-as-standard); the standard roll becomes a 5-rung bijection at 5 types; slot labels carry the size where it is not 9×9 ("Hard 6×6 · Skyscrapers"); the "standard = 9×9" copy in the daily plan and roadmap is amended | Proposed; G11 |
| D6 | **Every published tier is logic-only.** Five rungs mapped from the research ladder: Easy = rungs 0–4 · Medium = + rung 5 · Hard = + rungs 6–7 · Expert = + rung 8 · Extreme = + rung 9. **Rung 10 (bifurcation) is a reject, never a tier.** Guess count 0 everywhere, copy says "solvable by logic alone" | Proposed (research-backed; rungs 5–7 ordering is G7) |
| D7 | Difficulty label from the **classifier post-generation**; generator parameters (which clues to remove, in what order) only bias | Locked (research + Kakuro D8 precedent) |
| D8 | **Visual first, simplest → hardest** (Kakuro D12): V0 looks-only board → V1 types + baked fixtures → V2 board → V3 PDF → E1 exact solver (Hint) → E2 classifier (badge, technique hints) → E3 yield spike → E4 generator ("New puzzle") → E5 tiers + pickers + **hub card** → R1 daily. The deep link exists from V2; the hub card waits for E5. The owner may reorder slices (Kakuro pulled E1 ahead of V3) | Locked (owner rule, inherited) |
| D9 | **Clue UX:** four-sided gutter of plain digits (no arrows); a violated clue turns the error colour **as soon as the violation is provable from the filled prefix** (Tatham's rule — O(N), zero false positives); "satisfied" is an opt-in muted state, off by default; a manual **"mark clue done"** toggle ships in V2, **undo-able and persisted**, drawn error > done > normal — it doubles as the a11y progress tracker; a "which towers this clue sees" highlight on clue focus is a later teaching aid | Proposed (research §6), **amended by G10** |
| D10 | Roadmap **Phase 11**, engine-first like Phases 6/8/10 | Applied (this PR) |
| D11 | **Sizes are per puzzle type** (Kakuro D11, owner 2026-09-11) — applies here from day one | Locked (inherited) |
| D12 | **Mini tiers:** the mini ships easy/medium/hard only if E3/E5 prove Hard separable from Medium at the chosen mini size (research: attested at 5×5 via Tatham's 5×5 Hard, *not* at 4×4); otherwise fewer tiers (the Killer-4×4-easy-only precedent) | Proposed; measured in E3/E5 |

## 4. Slices — visual first, then the engine underneath

Each slice is its own PR gated by the AGENTS.md Pre-Merge / Pre-PR Checklist; the owner runs
`/code-review high` over each and a follow-up PR fixes every finding (the Kakuro cadence). Spec and
step-log live together under each slice. Status key: ✅ done · 🚧 in progress · ⏳ not started ·
⏸ deferred. Engine module: `src/features/engine/skyscrapers/` with mirrored `.md` files per source
file. Slice prefixes: **V** = visual surface on baked content · **E** = engine · **R** = rotation
(daily).

| Order | Slice | What becomes visible |
|---|---|---|
| 0 | V0 — Looks-only static board 🚧 | Empty 5×5 / 6×6 / 7×7 boards with a four-sided clue gutter at `/skyscrapers` — no digits, no input |
| 1 | V1 — Types + baked fixtures | Real clue digits on the static board (5×5, 6×6, 7×7 fixtures) |
| 2 | V2 — Board on the baked puzzle | A playable Skyscrapers at `/play?variant=skyscrapers`, clue states, "mark done" |
| 3 | V3 — PDF on the baked puzzle | A printable Skyscrapers page in the booklet |
| 4 | E1 — Visibility table + exact solver + uniqueness | Hint button backed by a real solver; "unique ✓" on the fixtures; the 4×4/5×5 ambiguity numbers as tests |
| 5 | E2 — Logical solver (rungs 0–9) + classifier + scorer | Easy→extreme graded by the solver; hints that name their technique ("clue 2 opposite 1: the 5 goes next to it") |
| 6 | E3 — Yield measurement spike | Numbers in the log and `research/skyscrapers-feasibility-findings.md`; D4 and D12 settled |
| 7 | E4 — Clue-removal generator | "New puzzle" produces a fresh, unique, solver-graded board at the chosen sizes |
| 8 | E5 — Difficulty targeting + `generateSkyscrapers` + benchmark | Every puzzle fresh at exactly the requested tier; pickers and hub card live; fixtures test data only |
| 9 | R1 — Daily rotation (5 types) | Skyscrapers in the daily: 5 standard + 3 minis = 8 boards/day |

### V0 — Looks-only static board 🚧

Before any types or store work, a page that only **looks** like a Skyscrapers, so the four-sided
gutter is designed once and everything after lands on something visible (D8).

- `/skyscrapers` — a workbench route (Server Component, `robots: { index: false }`, not in the
  sitemap, no hub card or header link). Deleted when V2 makes `/play?variant=skyscrapers` real.
- `SkyscrapersBoard` (`src/features/interactive-board/components/SkyscrapersBoard/`) — a static
  Server Component drawing an (N+2)×(N+2) track grid: the N×N play area with a heavier frame,
  four gutter strips, blank corners. **No digits, no selection, no input, no store.** Carries the
  WAI-ARIA grid skeleton (D9): gutter cells are `role="gridcell"` + `aria-readonly`, corners are
  presentational.
- Render it at 5×5, 6×6 and 7×7 side by side so the owner sees the size question (D4) on screen.

**Gate:** the owner is happy with the empty boards in both themes, including at 360 px (a 7×7
with its gutter is 9 tracks — the same footprint as a 9×9 Sudoku, so no new phone-width risk at
the recommended sizes; 9×9 + gutter = 11 tracks would be, and is why 9×9 is the alternative).

**Step-log (2026-10-01 — branch `feature/skyscrapers-v0`, built the day the plan merged):**

- *Process:* `src/app/skyscrapers/page.tsx` (Server Component, `robots: { index: false }`, not in
  the sitemap, no hub card or header link) renders the three D4 sizes side by side, each labelled
  with its role (5×5 mini · 6×6 standard · 7×7 large), wrapping on narrow screens.
  `SkyscrapersBoard` (`components/SkyscrapersBoard/`) is a static Server Component taking only
  `size`: `buildDisplayCells` expands N into the (N+2)×(N+2) picture (play / gutter-by-side /
  corner), `gutterLabel` spells the clue's reading direction (D9), the frame is drawn on the play
  cells that touch the gutter, corners are `role="presentation"` + `aria-hidden`. CSS module:
  per-cell right/bottom rules inside the play area, 3px frame on its edge cells, transparent
  gutter, a size container with `--cell-size` for V1's digits. Mirrored `.md` for both files; 6
  tests (track count, cell classification by position, label wording, ARIA roles and counts at
  6×6, hidden corners, the `--tracks` variable).
- *Learnings:* (1) Kakuro's gap-as-line trick is wrong here — it would draw lines between gutter
  cells, which must read as open space; lines belong on the play cells and the frame on the
  play area's edge cells. (2) No dark-theme override is needed because there are no filled blocks
  to re-tint — the one case that forced Kakuro's dark rule does not exist in Skyscrapers.
  (3) The owner's "plan for recommended but still measure" turned D4 from *open* into *planned*:
  the visual slices build 5/6/7, and E3 keeps the power to overturn any of them.
- *Blockers:* none. **Gate pending:** the owner's visual verdict in both themes and at 360 px.
- *Carried into V1:* the display-coordinate helpers (`skyscrapersTracks`, `buildDisplayCells`)
  move into the engine's `skyscrapers-types.ts` when V1 creates it (L2); `gutterLabel` gains the
  clue digit; the route gains real clue digits from the fixtures.

### V1 — Types + baked fixtures ⏳

- `skyscrapers-types.ts`: `SkyscrapersPuzzle { variant: 'skyscrapers'; gridSize; grid; solution;
  clues: SkyscraperClues; difficulty }`, `SkyscraperClues { top: number[]; bottom: number[]; left:
  number[]; right: number[] }` (**0 = blank**, D2), `SKYSCRAPERS_LADDER` / `SkyscrapersLevel`
  (the `KAKURO_LADDER` pattern, so the form, route and selector type it once), `skyscrapersGridConfig(N)`
  (boxless at every N, `maxNum = N`), `visibleCount(line)` (count of strict running maxima),
  `deriveClues(solution)` (all 4N), `validateSkyscrapers(puzzle)` (Latin rows/columns + every
  present clue matches `solution`). The **display-coordinate helpers** (`skyscrapersTracks(N) =
  N + 2`, gutter index ↔ clue side/index) live here from day one — board and PDF both consume
  them (Kakuro V3's lesson).
- `skyscrapers-fixtures.ts`: hand-baked puzzles — one each at **5×5, 6×6, 7×7** — authored as the
  **solved grid plus a clue mask** (which of the 4N clues are kept); clues are *derived*, never
  typed (Kakuro V1's one-source-of-truth lesson). At least one fixture with blank clues, one
  fully clued. Author from the rules; **never** transcribe a Conceptis/Brainbashers/Puzzle Baron
  grid.
- Tests: every fixture's solution is Latin and satisfies every kept clue; `visibleCount` against
  a brute-force count on random lines; `deriveClues` round-trips the fixtures; the research's
  4×4 counterexample pair (same 16 clues, two Latin squares) is pinned as a fixture of
  **non**-uniqueness for E1 to prove.

**Gate:** fixtures valid by test; mirrored `.md` files in place; the static board shows real clue
digits for all three fixtures.

### V2 — Board on the baked puzzle ⏳

- **Real discriminant first** (K5): `PuzzleVariant` / `BoardPuzzle` / `usePuzzle` unions gain
  `'skyscrapers'`; `startNewGame` switches on `variant`. While no generator exists, `usePuzzle`
  serves a **fixture** (client-side import); `/api/puzzle` is untouched until E5.
- **Board:** config `skyscrapersGridConfig(N)`; peers = `computePeers` on the boxless config (row +
  column, no box — assert in a test); pencil stripping on placement stays on (Latin); the Numpad's
  exhausted-digit counter stays on (each height appears exactly N times). `Board.tsx` generalises
  the Kakuro gutter: `tracks = N + 2`, a top row and a bottom row of clue cells, a leading and a
  trailing clue cell per row, presentational corners; arrow keys **never** land on gutter cells.
  `SkyscraperClueCell` renders one digit (blank = empty cell, still in the grid for a11y) with
  four states (D9): *open*, *satisfied* (opt-in muted tint, off by default), *violated* (error
  colour **as soon as the filled prefix proves it** — Tatham's `check_errors`: count already over
  the clue, tallest seen with the count still short, or count reached before the tallest; a full
  wrong line is the special case), *done* (manual toggle, click or Enter on the clue — the
  Brainbashers / Tatham / puzzle-skyscrapers "dealt with" marker; **an undo-able move, persisted
  with the board**; drawn error > done > normal). The prefix check for a clue is derived from
  `grid` in a narrow per-line selector (INP rule — never recompute all 4N on every keystroke).
- **Solved / hint:** solved = cell-for-cell match. The Hint button reveals a solution cell until
  E1 replaces it with a real solver step.
- **A11y (D9, G8):** the WAI-ARIA grid the board already uses, now (N+2)×(N+2): gutter cells
  `role="gridcell"` + `aria-readonly="true"` with names that spell direction and state — "Clue 3,
  looking down from the top of column 2, open" / "…, satisfied" / "…, violated"; corners
  `aria-hidden`; play cells keep "row r column c" plus the two clues that look at the cell
  ("row 3 column 4; left clue 2, top clue 3") so a screen-reader user has the constraints in
  hand; roving tabindex over play cells only, with a **"jump to clues"** key (e.g. `C`) that
  moves focus into the gutter and arrow keys walking along it; `aria-invalid` on a cell in a
  violated line; digits 1..N fill, Backspace/Delete/0 clear; visible keyboard instructions
  (WCAG 3.3.2). **No screen-reader-tested Skyscrapers exists anywhere** — an NVDA/VoiceOver pass is
  owed before R1 at the latest.
- **Sizes (D11):** the `/play` size picker lists **Skyscrapers'** sizes (whatever D4 settles; the
  fixtures make 5/6/7 playable now); `GridSizeSelector.SelectableSize` gains 5; `PlayExperience`'s
  `SIZES` gains the type; `topTiersLockedFor` becomes a per-type rule.
- **Rules dialog:** "Skyscrapers" / "Towers", the two rules, the gutter convention, "blank clues
  are normal". **Save / resume:** `edgeClues` and any derived line state rebuilt in persist's
  `merge` (L8), with a hydrate-from-storage test (L10).
- **Hub:** *not* yet (D8). **E2E:** a Skyscrapers play test on the 6×6 fixture (four-sided gutter
  renders N clues per side, digits 1..6 only, a completed wrong line marks its clue violated,
  "mark done" toggles, board starts empty, solving the fixture shows the solved dialog); the a11y
  spec covers gutter cells.

**Gate:** the fixtures are playable end-to-end in the browser (both themes, 5/6/7), E2E green,
visual check handed to the owner.

### V3 — PDF on the baked puzzle ⏳

- `drawSkyscrapersGrid(doc, puzzle, x, y, size, showSolution)` + `generateSkyscrapersPDF` on the
  shared nav helpers (bookmarks + puzzle↔answer links) and `drawCenteredDigit`. Print conventions
  (G9, measured): light interior lines with a **frame ≥ 3× heavier** (Krazydad 5 pt over 1 pt
  grey), gutter digits **½ the solved-digit size, bold, one tone lighter**, centred on their
  row/column 0.2–0.5 cell clear of the frame, **no arrows**, blank clues blank, one puzzle per
  page with the `#N` label above the top clues, answers gridded 3 × 4 on one page **without the
  clues** (Krazydad) — or with them, since our answer pages are also puzzle pages (decide by eye).
- `/api/generate` gains a **Zod** branch (`skyscrapersRequestSchema`, Kakuro's is the model) that,
  until E5, renders the fixtures with the same one-per-level cap V3 Kakuro needed (one `max(1)`
  to delete when `generateSkyscrapersBatch` exists); `PuzzleForm` a toggle with Skyscrapers'
  sizes; `usePuzzleGeneration.PDF_FILENAME` an entry; `preview-skyscrapers.ts`; a sample booklet
  in `Docs/samples/`.

**Gate:** a Skyscrapers page in the sample booklet, verified by eye (rasterise one puzzle page and
one answer page); PDF service tests cover the renderer; route tests cover the schema.

### E1 — Visibility table + exact solver + uniqueness ⏳

- `skyscrapers-visibility.ts`: per-N **permutation table** built lazily and cached — `perms`
  (`Uint8Array` of N·N! heights), `visL[p]`, `visR[p]`, and `bucket(visL, visR)` → the
  permutation indices (a line with one blank clue uses the union of N buckets; both blank, all
  N!). Tests pin N! sizes, the visibility of canonical lines, and that every bucket's members have
  the bucket's clues.
- `skyscrapers-solver.ts`: N-bit candidate masks per cell; **line propagation** = iterate the
  line's surviving permutations against current masks, OR kept heights per position, AND into
  cells, and shrink the line's survivor list monotonically (a `Uint32Array` per line); Latin
  singleton cascade along row and column; the cheap rules (clue 1 / clue N, facing sum N+1,
  position bound) as a pre-pass so permutation work starts from a reduced state. **Cell-MRV
  search**, re-filtering affected lines after each assignment, with a **node budget** and **early
  exit at the 2nd solution**. Monomorphic hot path (AGENTS.md §5): one solver class, typed arrays,
  no per-call allocation in propagation. The research's own failed clue-removal benchmark is the
  warning: never enumerate line-by-line without column pruning once both clues on a line are
  blank at N ≥ 7.
- Exports: `countSkyscrapersSolutions(puzzle, { limit = 2, nodeBudget, grid? })` →
  `{ solutions, nodes, exhausted, solution }`, `isSkyscrapersUnique`, `deduceSkyscrapers`
  (propagation only). The Kakuro contract, so the store's `hint` wiring is a copy.
- **Visible on the board:** the Hint button places a cell the *solver* deduces (selected cell if
  forced, else the first forced; **re-checked against the solution** — Kakuro L9); a dev-only badge
  reads "unique ✓ · n nodes".
- Tests: fuzz vs an independent brute force (all Latin squares at N ≤ 4; random fills at 5–6);
  **the research's 4×4 (204/576 = 35.42%) and 5×5 (92,912/161,280 = 57.61%) all-clue ambiguity
  counts reproduced in-repo** (4×4 as a unit test; 5×5 behind a `SLOW` flag or in the benchmark
  — it is ~1.5 s in Node); **the G5 facts pinned**: at 4×4 some 3-clue subset determines a square
  and no 2-clue subset does (and the 5×5 "none with 3 clues" check as a slow test if it fits a
  budget — Nakamura's N−1 conjecture); the V1 counterexample pair reports 2 solutions; every
  fixture is unique; budget exhaustion is reported, not silent.

**Gate:** uniqueness verify on the 7×7 fixtures **< 50 ms average** (expect well under 1 ms —
record the real number); fuzz clean; board hint driven by the solver.

### E2 — Logical solver (technique classifier) + instrumentation ⏳

- Tier *definition* (Simonis, via Kakuro G9): a puzzle's tier is the **weakest technique level
  that finishes it search-free**. Ordinal; the scorer only orders within a tier.
- `skyscrapers-logical-solver.ts` (a class, no inheritance), rungs from the research ladder,
  each a named technique for hints and histograms:
  - **T1 (Easy)** — `clueN` (ascending line), `clue1` (N adjacent), `facingSum` (a + b = N+1 pins
    N at distance a−1), `positionBound` (exclude h from d < c + h − N − 1; refined after
    placements by skipping heights already placed beyond a taller one), `nearlyFilledClue`
    (c−1 tallest visible already placed → the adjacent cell is the last visible), `nakedSingle`,
    `hiddenSingle`.
  - **T2 (Medium)** — `clue2Pattern` (the three Conceptis clue-2 rules named individually for
    friendlier hints), `reachability` (walk the line counting guaranteed-visible towers;
    eliminate candidates that make the clue unreachable).
  - **T3 (Hard)** — `lineFilter` (per-line permutation filtering against one clue pair — the
    catch-all; stop after the **first productive line** so diagnostics do not inflate difficulty,
    Tatham's rule), `nakedPair` / `hiddenPair` / `nakedTriple`.
  - **T4 (Expert)** — `xWing` (and the swordfish shape if it ever fires) on rows × columns for one
    height; `twoLineInteraction` (a clue pair whose survivors, intersected with a crossing line's
    survivors, eliminate — the research's "multi-line clue interactions", scoped in E2 by what the
    corpus actually needs).
  - **T5 (Extreme)** — `forcingChain`: bivalue-cell contradiction walks of bounded length over
    Latin links plus one clue (Tatham's `latin_solver_forcing`); the bound is set by E5's
    histogram. **No guessing at any tier** (D6); bifurcation is a reject.
  - Run the visibility technique before the Latin technique at each tier and restart from the
    easiest after any progress (Tatham's loop, the Kakuro loop). The Latin techniques are sound
    without a `required` guard here (every row and column is a full permutation) — assert that
    in a test so the Kakuro L12 question is answered on record.
- `SkyscrapersSolveResult { tier; techniques; steps; hardestRung; maxChainLength; guessSteps;
  metrics }` with `metrics` = N, clue count, blank-clue count, clue-value histogram (1s, Ns,
  facing-pair sums), cells solved by the pre-pass, average available deductions per step.
- `skyscrapers-score.ts`: two-factor scorer (weighted technique sum × opportunity density, the
  `scoreKakuroSolve` shape); the second factor is **how few deductions are available at each
  step** (Pelánek's dependency structure).
- `classifySkyscrapers`, `measureSkyscrapers`, `explainSkyscrapersHint` (lead-up cites only what is
  on the player's board — Kakuro L13).
- **Visible on the board:** the fixture's difficulty label comes from the classifier; the Hint
  button walks the logical solver's next step and names the technique; the dev badge shows the
  rung histogram.
- Tests: soundness fuzz — every logical placement equals the exact solution on ≥ 500 random
  unique puzzles per size; each technique has a minimal hand-built case that fires it and one
  that must not; the fixtures' tiers are pinned.

**Gate:** classifier agrees with the exact solver on every fuzz puzzle; every T1–T4 technique
fires on at least one fixture; classify a 7×7 in < 20 ms.

### E3 — Yield measurement spike (throwaway, no production code) ⏳

The research's hard warnings are about **yield and sizes** — all-clue ambiguity rising with N,
no published per-tier yield, no published clue-survival counts, and Tatham's unbounded retry
loop. Before E4, a bounded session on a throwaway script under the scratchpad (not committed):

- For **N = 4, 5, 6, 7, 9**: (a) **P(all-clue unique)** over ≥ 1,000 unbiased Latin fills per N
  (shuffle rows, columns and symbols — no cyclic-shift sampler) — answers G4 at N ≥ 6;
  (b) **clue survival** — greedy uniqueness-preserving removal in random order, recording how
  many of 4N clues survive and the E2 tier of the result, ≥ 200 per N — answers G3/G5;
  (c) **tier reachability** — tier-bounded removal toward each of the five tiers, yield and
  wall-clock per accepted puzzle, guess count (must be 0) — answers D4, D12 and G7;
  (d) **wall time** of the line filter and the 2-solution count at 7 vs 9 with the bucket table;
  (e) the **minimum surviving clue count** per N under uniqueness-preserving removal, against the
  N−1 conjecture (G5).
- **Pick the sizes (D4):** mini = the smaller of 4×4 / 5×5 whose accepted puzzles give three
  separable tiers at guess count 0 with ≥ ~20% yield each; standard = 6×6 unless the numbers say
  otherwise; large = 7×7 unless 9×9 clears both the wall-time and expert/extreme-yield gates.

**Output:** `Docs/research/skyscrapers-feasibility-findings.md` (the K7 pattern), the chosen
size triple written into D4, D12 settled, and log entries under Measurements. **Gate:** a unique
6×6 at any tier in **< 200 ms** average, a 7×7 in **< 1 s**; expert/extreme populated at the
standard size (≥ ~10% of tier-bounded output) — if not, **stop and re-slice** (a finer visibility
ladder, two-line interactions, or givens as a lever) before E4 rather than tuning inside E4.

### E4 — Clue-removal generator ⏳

- `skyscrapers-generator.ts`: `generateUniqueSkyscrapers(N, opts)` = **fill** (`fillGrid` on the
  boxless config, then shuffle rows/columns/symbols) → **derive all 4N clues** → **uniqueness
  check** (E1; on failure **reject the square** — the cheap option at N ≤ 7; Kolijn's
  fix-one-differing-cell repair is recorded as the alternative if a `givens` lever is ever wanted)
  → **remove clues** in a tier-biased order (keep 1s/Ns for Easy; remove them first for Hard+),
  each removal kept only if the puzzle stays **unique and solvable at ≤ the target tier** (Tatham's
  bound) → **re-add on overshoot** (restore the last clue instead of discarding the square — the
  yield lever Tatham lacks). Expose the removal-order and target-tier knobs E5 biases with.
- Instrument everything E3 measured so the log gets production numbers: yield per (N, tier),
  surviving clue count, retries, ms per accepted puzzle.
- **Visible on the board:** "New puzzle" produces a fresh, unique, ungraded Skyscrapers (the label
  shows the E2 classifier's tier for whatever came out); the fixtures become test data only.

**Gate:** yield ≥ what E3 measured; 6×6 accepted puzzle < 200 ms avg, 7×7 < 1 s; 0 failures in
100 per size.

### E5 — Difficulty configs + `generateSkyscrapers(difficulty, { gridSize })` + benchmark ⏳

- `skyscrapers.ts`: per-size `DIFFICULTY_CONFIG` for the three D4 sizes — removal-order bias,
  target rung, score bands from **measured** per-size distributions (never reuse cuts across
  sizes); `generateSkyscrapers(difficulty, { gridSize, rng, timeBudgetMs })` and
  `generateSkyscrapersBatch` with the Kakuro budget-error contract.
- Pipeline: fill → all clues → unique → **tier-bounded removal toward the target** → grade → band →
  accept; reject non-unique, any guess at any tier, below-tier and above-tier boards.
- **Tier-flip rules** (research Stage 4): a Hard whose trace never fires rung 6 or 7 → demote; a
  Medium that fires rung 6 → promote; any guess > 0 → reject.
- `benchmark-skyscrapers.ts` + `benchmark-logs.md` rows; targets set from E3/E4 reality.
- The mini ships the tiers that **measure** separable (D12); the large ships the full ladder if its
  generation fits the cron budget.
- **Visible everywhere:** `/play` difficulty + size pickers live for Skyscrapers; `/api/puzzle` and
  `/api/generate` switch from fixtures to `generateSkyscrapers` (Zod-validated sizes per variant;
  the V3 one-per-level cap deleted); the **hub card goes live** (`/play?variant=skyscrapers`,
  subtitle "Towers"; `new!` moves off Kakuro — D8); E2's soundness fuzz re-run over ≥ 500
  generated puzzles per size.

**Gate:** bands disjoint per size; easy/medium/hard at the standard size < 200 ms avg;
expert/extreme allowed to be slower but inside the cron budget; 0 generation failures in 20 per
tier and size; T4 and T5 **populated** at the standard size.

### R1 — Daily rotation (5 types) ⏳

- `Variant` → the five-type union in `daily-row.ts` and the `schema.ts` `$type` (**no migration**
  — `text` column); `StoredCage` union gains `StoredSkyscraperClue` (D2) **or** the nullable
  `clues` column lands as an additive migration if the owner vetoes column reuse.
- **Per-type sizes (D11):** `SIZES.skyscrapers = { mini: [<D4 mini>], standard: <D4 standard> }`;
  `DailySize` widens to whatever D4 needs (5, and 6-as-standard — **D5**). `isEligible` already
  reads `SIZES[variant].standard`, so a 6×6 standard works mechanically; the **copy** ("standard
  = 9×9") in the daily plan, roadmap and any UI string is amended, and `slotLabel` shows the size
  where it is not 9×9.
- `PROFILE`: floors + bot times for every eligible Skyscrapers `(size, difficulty)`, derived from
  **cell count** (G6): the only public numbers are a ~3.4–4.5 s hall-of-fame on small Easy grids
  and GM Puzzles' 9–36 min very-hard 6×6, so mini floors sit near **2 s** (or use input cadence)
  and standard floors well below record pace; flag as estimates, tune from live attempts. The
  `isEligible ⟺ getProfile` coverage test stays the tripwire.
- `rollDailyAssignment`: standard draws **5 distinct rungs for 5 types — a bijection** (the daily
  plan's end state; every type must cover all five standard rungs, which E5 must deliver for
  Skyscrapers); minis per D4-of-Kakuro: choose 3 of **5** types, then permute, filtered by
  `isEligible`, hard seat two draws. Roller test asserts the existing four types' rolls are
  unchanged in distribution.
- `dailies.service` dispatch, `/api/daily` response branch (`{ variant, clues }`), `useDaily`
  union, `slot-display` label ("Hard 6×6 · Skyscrapers", "Medium · Skyscrapers" for a mini),
  picker + leaderboard tabs, `seed.ts` expectations.
- Verify: exactly **5 + 3 = 8** rows/day over a seeded multi-day **dry run through the real
  engines with no database** (L25 — the workstation's `DATABASE_URL` is the shared instance;
  never `db:seed` ahead of the deploy that understands the new rows); archive/replay of old days
  unaffected; a Skyscrapers row never renders a `CageOverlay`.

**Gate:** the daily plan's end-to-end checklist green at 5 types; `/daily` shows the fifth type in
both sections over a week of seeded rolls; the first real cron after deploy round-trips.

### Deferred / follow-ons (not v1)

- **Variants:** Skyscrapers with Parks (one empty lot per line; Tim Peeters 1999) and Sum
  Skyscrapers (clue = sum of visible heights) — WPC-standard, near-zero engine change (an
  aggregator swap / a 0 ignored by visibility). Skyscraper **Sudoku** is a Sudoku-engine feature,
  not this type's. The competition long tail (Mirrors, Glass Towers, Index, Cluster, Double,
  Deficit) is out.
- **9×9 as a weekly special** if E3 rejects it as the large size; **4×4 as a tutorial board** if
  E3 rejects it as the mini.
- **Givens as a difficulty lever** (Tatham) — changes the "no givens" copy; research first.
- A **visibility highlight** on clue focus ("which towers this clue sees") as a teaching aid;
  "fill all candidates" (Tatham `M`, Brainbashers `A`) as a board-wide feature for every type.
- A **`VARIANT_REGISTRY`** (label + sizes + ladder + title in one place) to replace the ≥ 14
  hardcoded variant lists — a refactor the fifth type makes obviously worth it, deliberately
  *after* R1 so this plan ships a type, not a refactor.
- Revisiting Classic / Killer / Keisan sizes under D11; a daily "large" slot; hint-agent coverage;
  Phase 7 course lessons for the visibility techniques.

## 5. Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | All-clue ambiguity keeps rising with N and most 6×6/7×7 fills are rejected before any clue is removed | E3 measures P(unique) at 6/7/9 first; reject-the-square is cheap at ≤ 7 (fill is µs, count is sub-ms); Kolijn's one-cell repair is the recorded fallback |
| 2 | Expert/Extreme are sparse at 6×6 — Tatham's Extreme is pure Latin logic ("a Latin-square puzzle with some clue help"), so the top tiers may not feel like Skyscrapers | E3 gate requires T4/T5 populated at the standard size; levers are a finer visibility ladder (two-line interactions), clue-value bias, and — last — givens. If 6×6 cannot carry five tiers, D4's standard moves to 7×7 and the plan says so, not the code |
| 3 | Mini Hard is not honestly separable from Medium (4×4 is "fewer clues", not deeper logic) | E3 picks the mini *for* separability (research favours 5×5); ship fewer tiers otherwise (D12, Killer-4×4 precedent) |
| 4 | The first non-9×9 daily standard breaks assumptions in the roller, labels, bests or copy | D5 + G11: `isEligible` already keys on `SIZES[variant].standard`; a roller property test + label test + a grep of every "9×9" in daily copy before R1 |
| 5 | Plausible-but-wrong visibility rules (the position-bound formula, the nearly-filled rule) — the AI failure mode | Every logical placement fuzzed against the exact solution on hundreds of puzzles per size; each rule has a minimal fires / must-not-fire pair; the formula is written once with a worked example in the mirrored `.md` |
| 6 | Permutation-table memory at 9×9 (≈ 4 MB per worker; a cron run and a dev server both hold it) | Build lazily per N, only for sizes that ship; E3 measures 7-vs-9 and the plan prefers 7×7 |
| 7 | A violated-clue colour flashing mid-solve, or an auto "satisfied" tint, reads as the game solving itself | D9: violated only on a complete line; satisfied opt-in; the manual "done" toggle is the default affordance |
| 8 | Screen-reader users cannot find or understand the gutter (no precedent exists) | D9's naming + a "jump to clues" key, visible keyboard instructions; an NVDA/VoiceOver pass owed before R1 (G8) |
| 9 | The live EU/UK "SKYSCRAPER" games-software mark (Inspired Gaming, exp. 2027) is asserted, or a new filing appears | Slug `skyscrapers` is internal; the title is one constant with **"Towers" wired as the fallback** (D1, G1 resolved); no affiliation implied; professional read before any EU logo or paid use |
| 10 | The technique name "Skyscraper" (Sudoku single-digit pattern) lands in `HumanSolver` later and collides in hints / telemetry | Reserved in the log under D1; any future technique of that shape is named "Skyscraper (fish)" or routed under a `technique:` namespace |
| 11 | Anti-cheat floors wrong with no in-repo prior; practised solvers finish small Easy grids in 3–5 s | G6: floors from cell count, mini floors ≈ 2 s or cadence-based; tune from own telemetry; floors err low |
| 12 | Hardcoded variant lists (≥ 14) drift — one forgotten list ships a half-registered type | The reuse map's list is the V2/V3/R1 checklist; the `isEligible ⟺ getProfile` test and an E2E deep-link smoke per variant are the tripwires; the registry refactor is deferred, not forgotten |
| 13 | Storing clues in `cages` jsonb tempts cage-style rendering on Skyscrapers rows | `variant` gates every reader (L2); a test that a Skyscrapers row never renders a `CageOverlay`; or the owner picks the `clues` column (D2) |

## 6. Definition of done (v1)

Skyscrapers at its own three sizes (D4, settled by E3): unique, **no givens, logic-only at every
tier** (zero guesses), difficulty-banded on measured per-size cuts with the classifier as the label
source; playable on `/play` with the four-sided gutter, clue states and "mark done", 1..N numpad,
row/column peers, save/resume, keyboard + screen-reader access to clues; printable; on the hub; in
the daily as the fifth type (5 + 3 = 8 boards/day) with profile floors + bot times for every
eligible combo; full test battery + E2E green; benchmarks logged; mirrored docs synced; roadmap +
README flipped; the running log's open decisions resolved or explicitly deferred with a reason.
