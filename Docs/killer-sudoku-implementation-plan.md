<!-- markdownlint-disable MD024 -->

# Phase 6 — Killer Sudoku — Implementation Plan

> **Tracks:** 🧮 Engine, 🎨 Frontend, 🗄️ Infrastructure
> **Status:** 📋 Planned (design)
> **Prerequisite:** Phase 3 (Interactive Board), Phase 5 (design system)
> **Research:** [killer-sudoku.md](research/killer-sudoku.md)
>
> **v1 scope decision (locked):** **engine only** — slices **K1–K5** (combination tables,
> exact solver + uniqueness, cage generator, logical solver + grading, generator pipeline),
> fully tested and benchmarked. UI (K6), PDF (K7), dailies (K8), and polish/QA (K9) are
> **deferred to a follow-up (Phase 6b)** once the hard part — generation + grading — is proven.
> Killer takes the **Phase 6** slot; Strategy Courses moves to **Phase 7**.
>
> **Status (July 2026): K1–K8 shipped** — engine v1 with research-aligned difficulty
> rebalance + two-factor scoring, `/play` board, PDF export, and the Killer daily. Remaining:
> K9 polish odds-and-ends and **K10 (expert/extreme)**, the planned next difficulty work with
> its mandatory score-recalibration protocol.

This plan turns the Killer Sudoku research into a buildable, sliced roadmap that fits the
existing engine, board, PDF, and dailies architecture. It is grounded in three things: the
[research report](research/killer-sudoku.md), the current codebase seams (surveyed below),
and the project rules in [AGENTS.md](../AGENTS.md).

---

## 1. What Killer Sudoku is (and why it's a new module, not a flag)

Killer Sudoku keeps the standard Sudoku constraints (1–9 once per row/column/box) and adds:

- The grid is partitioned into **cages** — connected groups of cells, each with a **target
  sum**.
- Digits in a cage sum to the target, and **no digit repeats within a cage** (the standard
  convention; caps a cage at 9 cells).
- **Typically zero given digits** — all information comes from cage sums. The solve
  bootstraps from arithmetic (cage-combination analysis + the "Rule of 45"), not from
  scanning givens.

Because there are no givens and the constraint model is combinatorial rather than positional,
this is a genuinely different puzzle — the roadmap's standing guidance is a **new module, not
a refactor of `sudoku.ts`** ([roadmap.md](roadmap.md) §"Killer Sudoku & KenKen"). We still
reuse the primitives that are variant-agnostic (grid fill, `isValid`, and the classic
`HumanSolver` techniques), but the Killer generation/solve logic lives on its own.

---

## 2. Reconciling the research with our house rules

The research and [AGENTS.md](../AGENTS.md) disagree in two places. **The house rules win**;
both deviations are deliberate and noted here so nobody "corrects" them later.

| Topic | Research default | Our choice | Why |
|---|---|---|---|
| Exact solver | DLX (Dancing Links) or CP-SAT / OR-Tools | **Bitmask backtracking + MRV**, extended with cage constraints | AGENTS.md §1 explicitly forbids preferring DLX/exact-cover for this engine; a 9×9 Killer solves in well under our budget with cage-aware forward checking, and it keeps the engine pure TypeScript with **no new heavy dependency** (OR-Tools is a native/WASM add). |
| Logical solver structure | (unspecified) | **New `KillerSolver` class that composes cage logic + reuses `HumanSolver`** — never `extends` it | AGENTS.md §1: keep solvers as classes but "strictly avoid introducing inheritance." |

Other rules this plan honors throughout:

- **Mirrored docs (§2 Documentation Philosophy):** every new `.ts` gets a sibling `.md`
  (plain-English "why", not syntax translation) and JSDoc on major exports. Updating code
  without its `.md` is treated as a failure.
- **Performance (§3):** cage-combination enumeration and the exact solver are hot paths →
  monomorphic functions, bitmask candidate sets, randomized-input benchmarks logged to
  `benchmark-logs.md`.
- **Colocated Vitest (§4):** `*.test.ts` next to each source file; `npx vitest run` green
  before any slice is "done".
- **Security (§6):** the killer `solution` (and cage-solution digits) stay **server-only**
  for ranked dailies — same anti-cheat posture as classic; ownership-scoped writes unchanged.
- **Hydration safety (§1):** Killer generation is `Math.random()`-driven → **client-only**
  generation on `/play` (generate in `useEffect`, skeleton until ready) or a server seed;
  never generate during SSR.

---

## 3. Current seams this must thread through (surveyed)

| Seam | File | What changes |
|---|---|---|
| Puzzle type | [sudoku.ts](../src/features/engine/sudoku.ts) — `SudokuPuzzle` `{grid, solution, difficulty, gridSize}` | Introduce a discriminated `Puzzle` union so a killer puzzle can carry `cages`. |
| Board store | [useBoardStore.ts](../src/features/interactive-board/store/useBoardStore.ts) — `startNewGame(puzzle, mode)` | Accept + persist `cages` and a `variant`; cage no-repeat validation on input. |
| Board render | [Board.tsx](../src/features/interactive-board/components/Board/Board.tsx) / `Cell.tsx` | Draw cage borders (dashed) + a sum label on each cage's anchor cell. |
| DB row | [daily-row.ts](../src/lib/db/daily-row.ts) + [schema.ts](../src/lib/db/schema.ts) — `daily_puzzles(grid, solution, clue_count)` | Add nullable `cages jsonb` + `variant`; a Killer-aware clue/cage count. |
| API | [/api/puzzle](../src/app/api/puzzle/route.ts), [/api/daily](../src/app/api/daily/route.ts) | Serve `cages`; keep `solution` server-only rules intact. |
| PDF | [pdf.service.ts](../src/features/pdf-generation/services/pdf.service.ts) — `drawGrid` | Draw cage outlines + corner sum labels; Killer section in the outline. |

---

## 4. Data model

A discriminated union keeps every downstream consumer type-safe and forces call sites to
handle both variants explicitly (no silent `undefined.cages`).

```typescript
// src/features/engine/killer/killer-types.ts
export interface Cage {
  /** Stable id for React keys + cage-border lookup. */
  id: number;
  /** Target sum of the cage's cells. */
  sum: number;
  /** Flat cell indices (r * size + c), always length 1–9, connected, no-repeat. */
  cells: number[];
}

export interface KillerPuzzle {
  variant: 'killer';
  grid: number[][];        // usually all-zero (no givens); a placed value = a 1-cell "given"
  solution: number[][];    // SERVER-ONLY for ranked dailies
  cages: Cage[];           // partition covering every cell exactly once
  difficulty: Difficulty;
  gridSize: 9;             // v1: 9×9 only (mini Killer is a later slice)
}

// sudoku.ts gains the discriminant on its existing shape:
export interface ClassicPuzzle extends SudokuPuzzle { variant: 'classic'; }
export type Puzzle = ClassicPuzzle | KillerPuzzle;
```

**Invariants** (enforced by a validator + tests): cages partition the grid (every cell in
exactly one cage), each cage is orthogonally connected, `cells.length ≤ 9`, no digit repeats
within a cage in the solution, and `sum` equals the solution digits' sum.

---

## 5. Module layout

New code lives under `src/features/engine/killer/` (DDD colocation — this supersedes the
roadmap's older `lib/puzzle-engine/killer-sudoku.ts` path suggestion, which predates the
current `src/features/engine/` structure). Each `.ts` ships with a mirrored `.md`.

```text
src/features/engine/killer/
  killer-types.ts            Cage, KillerPuzzle, Puzzle union, validators
  cage-combinations.ts       enumerate n-distinct-digit sets summing to S (memoized)
  cage-generator.ts          region-growing flood-fill partition (KDE-style)
  killer-solver.ts           KillerSolver: exact (bitmask+cage) + logical (grading) modes
  killer-sudoku.ts           generateKillerSudoku() pipeline + canHumanSolveKiller()
  benchmarks/benchmark-killer.ts
  + *.test.ts and *.md siblings for each
```

**Reused as-is:** `grid-utils.ts` (`fillGrid`, `isValid`, `copyGrid`), and the classic
`HumanSolver` (composed, see Slice 4).

---

## 6. Sliced delivery

Independently mergeable slices, ordered so each is testable on its own. Solver-before-
generator, per the research's explicit recommendation ("start with a solver, not a
generator").

> **v1 = K1–K5 (engine only).** K6–K9 (board, PDF, dailies, polish) are documented here for
> continuity but are **out of scope for the first release** — they land in a Phase 6b once the
> engine is proven. This front-loads the genuinely hard, uncertain work (generation + difficulty
> grading) before any surface investment.

### Slice K1 — Types + cage-combination tables

- `killer-types.ts` with the union, `Cage`, and the invariant validators.
- `cage-combinations.ts`: `combosFor(size, sum)` → all sets of `size` distinct digits (1–9)
  summing to `sum`, and `candidateMaskFor(size, sum)` → the OR of all digits that appear in
  *any* combination (bitmask). **Memoized** — there are only 9×46 (size,sum) pairs, so build
  a frozen lookup table once. Include the "consistent digit" helper (digits present in
  *every* combination). Verified against the exhaustive tables in the research (§3a).
- **Tests:** exact counts per the research tables (2-cell 9→{18,27,36,45}; unique cages
  3,4,16,17; complementarity 6-cell↔3-cell; etc.).

### Slice K2 — Exact solver + uniqueness (bitmask, cage-aware)

- `KillerSolver` in exact mode: the existing bitmask/MRV backtracking, plus two cage
  constraints in the propagation step:
  1. **Cage no-repeat:** a digit already placed in a cage is removed from that cage's other
     cells' candidate masks.
  2. **Cage sum reachability:** prune a candidate if no valid completion of the cage's
     remaining cells can hit the target (remaining-sum bounds + `combosFor`).
     - **Correctness trap (must implement):** `combosFor(remainingCells, remainingSum)`
       alone checks only *raw arithmetic* feasibility — it doesn't know a remaining cell's
       candidates were already narrowed by row/col/box. The reachability check **must
       intersect** each combination against the remaining cells' existing bitmask candidates;
       a combination is viable only if every digit can still land in some remaining cell.
       Skipping the intersection under-prunes on cages that span multiple houses (the
       arithmetic permits a digit the row/box already excludes), silently weakening the
       solver and inflating solve time.
- **Solution counting** stops at the 2nd solution → `countSolutions(cages) ∈ {0, 1, ≥2}`.
- **Target:** verify any 9×9 Killer in **< 50 ms** (research allows < 100 ms; we keep margin).
- **Tests:** known unique puzzles solve to the expected grid; a deliberately ambiguous cage
  layout returns ≥ 2; **and an explicit intersection test** — a multi-house cage whose target
  arithmetically allows a digit that the cell's row/box already excludes, asserting that digit
  is pruned (guards the trap above).

### Slice K3 — Cage generator (region-growing partition)

- `cage-generator.ts`: seed-and-grow flood-fill over a solved grid (KDE `makeOneCage`
  model) producing connected polyomino cages covering the grid, parameterized by:
  - `maxSize` (publisher norm 4–5), `maxCombos` (difficulty lever — fewer = easier),
  - `singles` bounds (1-cell cages act as givens; cap them),
  - no-repeat enforced during growth (reject a cell whose solution digit already sits in the
    growing cage).
- Optional **symmetry** pass (rotational) behind a flag — aesthetic only, costs attempts,
  does not affect difficulty; **off for v1**, noted as a stretch.
- Targets assigned by summing the solution digits (`setCageTarget`).
- **Tests:** output is a valid partition (Slice K1 validator), respects `maxSize`, connected,
  no-repeat.

### Slice K4 — Logical solver + difficulty grading

- `KillerSolver` logical mode — the difficulty engine. **Composition, not inheritance:** it
  holds a `HumanSolver` instance for the classic passes (naked/hidden singles/pairs, pointing,
  fish, wings, ALS — already built and benchmarked) and layers Killer-specific techniques in
  tiers:
  - **Tier 1 (easy):** unique-combination ("magic") cages → seed candidates; single-box
    Rule of 45 (innies/outies); classic singles.
  - **Tier 2 (medium):** cage-combination eliminations across cage boundaries; classic pairs;
    consistent-digit deduction.
  - **Tier 3 (hard):** multi-unit 45 rule, cage splitting, pseudo-cages; classic triples/
    hidden subsets.
  - **Tier 4 (expert):** X-Wing/Swordfish/chains layered on cage deductions.
- **Open design question (resolve in this slice):** how `KillerSolver` shares a candidate
  grid with the composed `HumanSolver`. Preferred: drive `HumanSolver`'s public candidate API
  (`removeCandidate`/`candidateList`/`placeNumber`) after seeding cage-derived restrictions.
  If that proves awkward, extract a small shared `CandidateGrid` primitive (a follow-up
  refactor, *not* in-slice, to avoid destabilizing the benchmarked `HumanSolver`).
- Grading records the **hardest tier required** (and how often), mapped to
  easy/medium/hard/expert — the same tier→band model as classic.
- **Caveat (from research):** difficulty grading is not standardized and is the hard part of
  the whole project. We grade by hardest-required-technique (Andrew Stuart's approach), accept
  subjectivity, and calibrate bands against real solve feel later.
- **✅ Shipped (see `killer-logical-solver.md` for the as-built ladder):** tiers 1–4 with the
  tier-3 slot filled by multi-unit Rule of 45 + pointing pairs — **cage splitting and hard
  combinations were deferred to the expert slice (K10)**, and tier 4 is the classic
  advanced/extreme set. `solve()` also returns per-technique counts + opportunity-density
  sampling, feeding **two-factor scoring** (`killer-score.ts`, Stuart's `raw × density`
  architecture on SE-backboned weights) — the "how often" weighting the caveat asked for,
  implemented as disjoint score bands per difficulty.

### Slice K5 — Generator pipeline

- `generateKillerSudoku(difficulty)`: solved grid (reuse `fillGrid`) → `cage-generator` with
  difficulty-tuned params → assign targets → **reject non-unique** (K2) → **grade** (K4) →
  keep only if hardest tier matches the target band; else retry with a cap + fallback loosen.
- Difficulty is tuned via **cage structure**, not clue count (research §4): easier = smaller
  cages, fewer combos, more extreme-sum cages; harder = larger cages, multi-unit innies/outies.
- **Retry is multi-knob, not just `maxCombos`.** Hard bands (e.g. "expert" needs multi-unit
  innies/outies) depend on *where* cages fall relative to house boundaries, not just their
  size/combo count — loosening `maxCombos` alone may not move the grade. The fallback loop
  must be able to adjust `maxSize` and the singles bound too; treat the exact knob schedule as
  something the K5 benchmarks *prove*, not something assumed up front.
- **✅ Shipped, with two design inversions the benchmarks forced** (full detail:
  `killer-difficulty-rebalance-report.md` + `killer-sudoku.md`):
  1. **Exact-tier matching → tier ceiling.** Requiring `hardestTier === target` craters yield
     once cage shape is constrained (98% of unique medium-shaped layouts rejected). Difficulty
     rides cage-shape gates (given budgets 12/4/1, foothold bands medium ≥ 3 / hard ≤ 3) plus
     a **two-factor score band** (easy < 42 / medium 42–62 / hard ≥ 62, disjoint); the tier is
     only a solvability ceiling. `maxCombos` as a per-cage gate was tried and dropped (no-op at
     maxSize 3, fatal at 4) — the *count* of single-combination cages is the workable form.
  2. **Grade before uniqueness.** Sound deductions ⇒ a completed logical solve is provably the
     unique solution, so `countSolutions` is a once-per-accepted verification, not a per-
     candidate toll. ~5–15× speedup; measured 12 / 117 / 404 ms avg — far under the < 3 s /
     < 10 s targets.

### Slice K10 — Expert/extreme difficulties — *planned; full plan in [killer-expert-implementation-plan.md](killer-expert-implementation-plan.md)*

Everything in this slice follows from walls we **measured** during the difficulty rebalance
(July 2026 — see `killer-difficulty-rebalance-report.md`), not from speculation. The current
technique set gets its traction from tight 2-cell cages and given-like footholds; every lever
that makes puzzles structurally harder (maxSize 4, thinning 2-cell cages via the shipped-but-
unused `maxSizeBias` knob, cutting footholds below ~2) collapses either the tier-3-solvable
rate (~10% → ~1% → 0%) or the exact solver (uniqueness checks 10 ms → 579 ms → minutes). So
the order is fixed:

1. **Exact-solver pruning first** (`killer-solver.ts`): tighter cage-sum bound propagation
   during backtracking (prune when a partial cage can't reach its sum with any remaining
   combination), or a node-budget bail-out so pathological layouts die in milliseconds.
   *Unlocks:* maxSize 4–5 at sane verify cost — and retroactively gives **hard** its big
   cages/sums (> 24), which the rebalance had to forgo.
2. **Killer techniques next** (`killer-logical-solver.ts`): cage splitting, hard combinations,
   and chains — per the research ladder. Each added technique converts part of the measured
   **~86% of maxSize-4 uniques that are currently ungradable** into expert-band territory.
   Necessity-test by capability-toggling (disable the technique, require the solve to stall),
   never by reading a single solve trace (order-dependence — HoDoKu's documented trap).
3. **Cheap pre-filter before the expensive grade** (research: Stuart over-produces ~1-in-5000
   for extreme): backdoor/"Magic Cells" count or a branch-difficulty score to reject
   obviously-easy candidates before grading. Only needed if expert acceptance falls below
   ~1-in-thousands.
4. **⚠️ MANDATORY RECALIBRATION — on this slice and on ANY change to technique weights, shape
   gates, solver techniques, or the cage generator:** the two-factor score cuts (currently
   easy < 42 / medium 42–62 / hard ≥ 62) are **relative cuts on measured distributions**
   (Stuart's sextile approach), not absolute numbers. Adding a technique changes every
   puzzle's trace and therefore every score. The protocol: re-run the distribution sweep
   (30+ generated puzzles per difficulty → score quantiles), re-place ALL band cuts (not just
   the new tier's) so bands stay disjoint with ~50%+ yield each, re-run the generation
   benchmark (avg/median/max + fail count per difficulty), and update `killer-score.md`,
   `killer-sudoku.md`, and the band regression tests in `killer-sudoku.test.ts` with the new
   numbers. Expert's own band gets placed the same way — measured, never invented.
5. New difficulties keep the shape-gate + ceiling + score-band architecture — expert ≈
   solveCap 4, maxSize 4–5, zero singles, foothold ≤ 1, `maxSizeBias` engaged, score band
   above hard's — with each gate's threshold re-proven by the K5-style sweep discipline
   (stage-rate diagnostics before end-to-end benchmarks).

### Slice K6 — Interactive board (cage rendering + play) — *deferred to Phase 6b*

- **Store:** `startNewGame` accepts `variant` + `cages`; persisted (bump persist `version`).
  `inputDigit` adds a **cage no-repeat** rule alongside the existing house lockout.
- **Render:** precompute cage geometry **once** per game (not per keystroke — INP §3): for
  each cell, which sides border a *different* cage → dashed border; the cage anchor cell
  (min index) shows the sum label. A `KillerBoard` overlay layer or extended `Cell` props.
- **Numpad/hints:** Killer starts empty; the "mistakes" check compares against `solution`
  (already served for classic hints — consistent posture). Cage-aware "why" hints are a
  Phase 7 (Strategy Courses) concern, not here.
- **a11y:** cage membership + sum announced to screen readers (e.g. `aria-label` includes
  "cage sum N"); the wobble/chaos chrome stays off the grid (§ chaos carve-out).
- **Verify:** headless-Chromium screenshot pass (the established loop) + Playwright smoke.

### Slice K7 — PDF rendering — *deferred to Phase 6b*

- `drawGrid` (or a `drawKillerGrid` sibling) renders cage outlines (inset dashed) + a small
  corner sum on each anchor cell, scaled into the same 400px bounding box as classic.
- Outline/bookmark gains a **Killer** section; titles label the variant.
- **Runtime:** stays Node (`export const runtime = 'nodejs'`) — pdfkit rule (§1) unchanged.

### Slice K8 — Dailies + API integration — ✅ *shipped (July 2026)*

- **As built (simpler than planned):** migration `0003` adds only a nullable `cages jsonb` —
  **no variant column**. The Killer daily is stored with the literal difficulty `'killer'`
  (one per day, engine-medium behind a service constant), so `UNIQUE(date, difficulty)`, the
  solve route, leaderboard tabs, and streaks all picked it up with zero changes — `'killer'`
  became the sixth entry in `DAILY_DIFFICULTIES` and every difficulty-keyed surface followed.
- **Daily surface decision:** expands the picker (a `killer` chip on `/daily`), not a
  separate tab.
- **Anti-cheat:** follows the codebase's shipped pragmatic posture (`solve-rules.md`) — the
  solution IS served (board hints/mistakes need it) and ranked solves are validated
  server-side (grid equality + plausibility floor: `MIN_SOLVE_MS.killer` = 30 s + one attempt
  per day). The plan's stricter "don't serve solution" idea was already superseded for
  classic dailies; Killer inherits the same posture.
- `toDailyPuzzleRow` accepts `SudokuPuzzle | KillerPuzzle`; `clue_count` stores the cage
  count for Killer.

### Slice K9 — Polish, a11y, QA, benchmarks — *deferred to Phase 6b*

- Contrast/focus/motion pass on cage borders + labels (must read in light and dark themes).
- INP budget check on a Killer board (cage geometry memoized, narrow selectors).
- Full benchmark run logged; roadmap + README status flipped; hub gets a real Killer card
  (the "coming soon" card from Phase 5.4 becomes live).

---

## 7. Performance targets

| Metric | Target | Source |
|---|---|---|
| Exact solve / uniqueness verify (9×9) | < 50 ms | research < 100 ms, kept with margin |
| Cage-combination lookup | O(1) (memoized table) | §5 combinatorics |
| Full generate — easy/medium | < 3 s | — |
| Full generate — hard/expert (worst case) | < 10 s | mirrors Extreme budget |
| Board interaction (INP) | ≤ 200 ms | AGENTS.md §3 |

Benchmarks use **randomized** grids/cages (avoid V8 dead-code/shape caching, §5) and append
to [benchmark-logs.md](../src/features/engine/benchmarks/benchmark-logs.md).

---

## 8. Testing strategy

- **Unit (Vitest, colocated):** combination tables (exact counts), partition validity, exact
  solver correctness + uniqueness, generator invariants, each grading tier fires on a puzzle
  built to require it.
- **Golden puzzles:** a small fixture set of known Killers (with published solutions) the
  exact solver must reproduce.
- **UI (RTL, accessibility-first queries):** cage borders/labels render; cage no-repeat
  rejects a duplicate; solved detection fires.
- **E2E (Playwright):** generate → solve a Killer on `/play` under the Biscuit Lab theme.

---

## 9. Risks & open questions

| # | Item | Disposition |
|---|---|---|
| 0 | **K4 (grading) is the long pole of v1 — not K3/K5.** The research's own datapoint (Kevin Hooke: solver ~2 weeks, the *difficulty ranker* most of a year) is a sharp asymmetry. Slice ordering (K4 after the generator) can mislead velocity tracking. | Budget K4 as the dominant cost of K1–K5; expect it to blow a naive estimate. Land the grader's tiers incrementally (Tier 1–2 usable early) rather than all-at-once. |
| 1 | **Difficulty grading is subjective** (research caveat) | ✅ Resolved (July 2026): two-factor scoring shipped (`killer-score.ts` — Stuart's weighted-sum × opportunity-density on SE weights) with disjoint per-difficulty score bands placed on measured distributions. Bands are relative cuts — **recalibrate per the K10 protocol on any solver/weights/gate change**. Human solve-data calibration (Glicko-style) remains a post-launch option. |
| 2 | **`KillerSolver`/`HumanSolver` candidate sharing** | Resolve in K4: compose via public API first; extract `CandidateGrid` only if forced (separate refactor). |
| 3 | **Generation retry cost** if grading rejects many layouts | ✅ Resolved (July 2026): grade-before-uniqueness reorder made attempts ~0.5 ms, so rejection-heavy configs stay fast (12/117/404 ms avg, attempt cap 20 000). The loosen-knobs fallback proved unnecessary; `maxCombos` was dropped as a gate (see K5). |
| 4 | **Cage border rendering fidelity** (dashed insets, sum placement) in both themes + PDF | Prototype early in K6/K7; verify via screenshots. |
| 5 | **Daily scope** — new difficulty tier vs. separate Killer tab | ✅ Resolved: out of v1 (engine only). Revisit in Phase 6b (K8). |
| 6 | **Sequencing vs. Strategy Courses** | ✅ Resolved: Killer is **Phase 6**; Strategy Courses moves to **Phase 7**. |

---

## 10. Definition of done

### v1 — engine only (K1–K5)

- `generateKillerSudoku(difficulty)` returns a **uniquely-solvable** 9×9 Killer puzzle with a
  valid cage partition (all invariants hold) for every difficulty band.
- Exact solver + uniqueness check within the **< 50 ms** target; full generate within the tier
  targets; `benchmark-killer.ts` results logged to `benchmark-logs.md`.
- Difficulty grading assigns a band by hardest-required technique, with a test per tier.
- `npx vitest run`, `npm run lint`, and `npx markdownlint-cli` all green; mirrored `.md` docs +
  JSDoc for every new file.
- No UI/PDF/DB changes — the engine is consumable but not yet surfaced.

### Phase 6b — surfaces (K6–K9), separate release

- Generate + play a Killer on `/play` (cages rendered, no-repeat enforced, solve detected)
  under the Biscuit Lab theme; PDF export + answer key; optional Killer daily with the
  anti-cheat posture intact; roadmap/README status updated; hub Killer card live.
