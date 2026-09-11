# Kakuro — Running Log

> **What this is:** the cross-cutting record for the Kakuro feature — **decisions**, **research
> gaps**, **bugs**, **learnings**, and **measurements** — kept alongside the
> [implementation plan](kakuro-implementation-plan.md). The plan holds the *spec and per-slice
> step-logs*; this file holds everything that cuts across slices or would otherwise live only in
> a chat transcript. **Newest entries first** in the journal; the tables below are the current
> state and are edited in place (a superseded row is struck through, not deleted).
> **Status:** 🚧 Living (opened 2026-09-11)

## How to use this file

- **Journal** — one dated line per event, newest first. Tag each with `[decision]`, `[gap]`,
  `[bug]`, `[learning]`, or `[measure]` and the `D#` / `G#` / `B#` it touches.
- **Decisions (D#)** — the table is the source of truth for status. Statuses: *proposed* (an
  agent's recommendation, not yet confirmed), *open — owner* (needs the user's call), *locked*
  (research-backed or confirmed), *applied* (in code / docs), *superseded* (struck through, with
  the successor named).
- **Gaps (G#)** — questions the research does not answer well enough to build on. Each names
  *what would resolve it* and *which slice is blocked or degraded* without it. When one is
  answered, fold the answer into the plan first (AGENTS.md → Roadblock & Research Rules), then
  mark it here with a link to where it now lives.
- **Bugs (B#)** — anything found broken while building, with cause and fix PR. A generalizable
  cause also gets a Learning row phrased as a rule.
- **Learnings** — rules the next slice can apply, not stories about this one (the pre-merge-log
  convention).
- **Measurements** — yields, timings, distributions, with the commit they were taken at.

## Journal

- **2026-09-11** `[decision]` D1–D10 opened from the research; D7 applied (Phase 10 added to the
  roadmap and README). `[gap]` G1–G12 opened. `[measure]` none yet — X0 is the first measurement.
  Plan + this log written; no code.

## Decisions

| # | Decision | Rationale | Status |
|---|---|---|---|
| D1 | Display name **Kakuro**, subtitle **Cross Sums**, engine/slug **`kakuro`** | U.S. "KAKURO" word marks abandoned 2007 (research §1); "Cross Sums" is the generic term and carries the SEO fallback. The slug never needs to change if counsel forces a display rename — the `calc`/Keisan split is the precedent | Proposed — display name blocked on **G1** |
| D2 | Store the **interior N×N** grid plus an explicit **runs list**; render clues in a one-cell **gutter** (top + left) and inside interior black cells | Keeps `grid.length === N` everywhere the codebase already keys on it (`DailySize`, `PROFILE`, board `config.size`, `GridSize` union); a run is `{ id, cells, sum }`, i.e. structurally a Killer cage, so it fits `daily_puzzles.cages` jsonb with **no migration**. Alternative rejected for now: store `(N+1)×(N+1)` with the dead border (every reference implementation does this) — it breaks the size coupling above and forces 5/7/10 into `DailySize` | Proposed — confirm |
| D3 | Black cells are **`0` in both `grid` and `solution`**; **blocked = "belongs to no run"**, derived from `runs` at game start | The board's solved check is a cell-for-cell match, `gridsMatch` is the same, `countClues` counts non-zero (correct: Kakuro has no givens). A `-1` sentinel would leak into every `Grid` consumer. Cost: every "is the board complete" or "digit exhausted" loop must skip blocked cells | Proposed — confirm at X1 |
| D4 | Daily at 4 types: **3 mini slots, roll 3 of the 4 types** per day; Kakuro minis **6×6 only**; the "easy/medium minis are 4×4" rule becomes **per-type minimum mini size** | The daily plan's own "open scaling question" fires at the 4th type. Options weighed: (a) 3 slots / 3-of-4 types — no key change, no leaderboard identity change, one type sits out minis each day; (b) a 4th mini slot with a repeated tier — new key, picker/leaderboard reshaping; (c) more mini tiers — contradicts "no expert/extreme minis". Kakuro ≤ 5×5 is trivial (research §5), so no 4×4 Kakuro; 6×6 is Easy–Medium honestly, Hard TBD (**G6**). Bests are already `(key, variant, size)`-scoped, so a 6×6 in an easy slot is safe | **Open — owner** |
| D5 | Top tiers: T1–T4 from the technique ladder; **T5 = bounded depth-1 recursion with guess-step count** as the Extreme axis (transplant of Keisan K7b–K7d); Berthier chains/whips deferred | Cheapest honest ladder already proven in-repo (guess *depth* never exceeded 1 in Keisan; *count* is monotone). Tension: the Kakuro community treats T&E puzzles as unfair; Berthier's hardest instances need g-whips, not Sudoku transplants. **G5** checks what commercial hardest tiers actually require before the copy is written | Proposed — confirm |
| D6 | v1 sizes **6×6 and 9×9** interior; 8×8 / 10×10 / 12×12 / 13×17 later; **no 4×4** | The daily needs exactly 9×9 (standard) + a mini size; 8–10 is the research's sweet spot but the `GridSize` union widening is its own risk (Keisan Risk 6) | Proposed |
| D7 | Roadmap **Phase 10**, engine-first | Matches Phase 6 (Killer) and 8 (Keisan) | Applied 2026-09-11 |
| D8 | Difficulty label assigned by the **classifier post-generation**; generator parameters only bias toward a tier | Research §3/§5: publishers filter difficulty after generation; parameters do not predict it a priori | Locked |
| D9 | Shipped layouts: **180° rotational symmetry**, connected white region, runs 2–9, no known non-unique sub-blocks (aligned length-9 pairs; 2×9 / 3×8 / 4×7 / 5×5 all-white blocks) | Aesthetic norm + the structural non-uniqueness guarantees from research §3–§4 | Locked |
| D10 | **Guess count = 0 at tiers ≤ hard.** Expert/Extreme state their guarantee in copy exactly as Keisan does | Fairness norm; the Keisan honest-ladder wording already exists | Locked |

## Gaps — research questions

| # | Question | What would resolve it | Blocks / degrades | Status |
|---|---|---|---|---|
| G1 | Common-law U.S. use and EU/JP registrations of "KAKURO" — is the *display* name clear? | A counsel check (or at minimum EUIPO + J-PlatPat searches) | D1 display name; hub copy, titles, SEO. Nothing in the engine | Open |
| G2 | Human solve-time baselines per size × tier, for `PROFILE` floors and bot times | Published solve statistics (Conceptis/Krazydad/kakuroconquest), or a small self-timed sample | X7 floors; anti-cheat plausibility. Conservative guesses are an acceptable stopgap | Open |
| G3 | The **edges-inward** template method as an implementable procedure, and whether published symmetric layout catalogs exist per size | The Mathimagics enjoysudoku thread in full; Conceptis/Krazydad layout conventions; any open template sets | X3 layout generator quality and yield | Open |
| G4 | **Surface / disconnection sums** as an algorithm: how to enumerate candidate regions, compute the across-minus-down residue, and detect "singularity" (cut-cell) / "doubularity" cases cheaply | Berthier Ch. 15 (PBCS), the enjoysudoku formalization, CSP-Rules `KakuRules` source | X4 T4; without it T4 collapses into T3 and the 9×9 ladder loses a rung | Open |
| G5 | Do commercial "hardest" tiers (Conceptis Black Belt / Absolutely Nasty, Krazydad top books, ATK Hard) require bounded T&E, or are they strictly chain-solvable? | Sample hard published puzzles through the X4 classifier; Berthier's ratings of ATK puzzles | D5 — decides whether the Keisan transplant is honest or whether chains are needed for Expert | Open |
| G6 | Can **6×6** interior separate Hard from Medium without T&E at normal density? | X0 measurement + research §5's claim that hard 6×6 verges on T&E | X5 6×6 tiers; D4 mini eligibility | Open — X0 measures first |
| G7 | Kakuro-specific a11y and rendering conventions: the diagonal clue split, screen-reader announcement of clue cells inside a WAI-ARIA grid, keyboard skipping of blocked cells, print conventions | Existing [accessibility-responsive-qa.md](research/accessibility-responsive-qa.md) grid pattern + a look at how Conceptis/Krazydad and one browser app expose clues | X6 board + PDF | Open |
| G8 | How Mathimagics' `fixed` / `implied` / `rating` numbers map onto commercial grades (ATK Easy/Medium/Hard, Conceptis levels) | The rating-system thread data; a few graded puzzles run through our instrumentation | X5 band calibration beyond our own distributions | Open |
| G9 | Simonis, "Kakuro as a Constraint Problem" — the proposed human-difficulty grading scheme in detail | The paper | X4 scorer weights (may be reusable directly) | Open |
| G10 | **Structural non-uniqueness pre-checks**: which sum-preserving swap cycles can be detected on the layout/fill *before* running the counting solver, to raise yield cheaply | Mathimagics' degenerate sub-block list + the uniqueness-flip discussion; any formal treatment | X3 yield; X2 verification load | Open |
| G11 | The daily mini scaling question at 4 types (design, not research) | The owner's call on D4 | X7 | Open — owner |
| G12 | Should the board ship a **combination-reference helper** ("combos for this run"), and is it a hint-level assist or default? Competitors ship it | Product decision informed by how Kakuro Conquest / Free Kakuro expose it and whether the daily's hint policy allows it | X6 scope; anti-cheat floors if it materially speeds solves | Open |

## Bugs

| # | Found | Slice | Symptom | Cause | Fix |
|---|---|---|---|---|---|
| — | — | — | none yet | — | — |

## Learnings

| # | Rule | Came from |
|---|---|---|
| L1 | A new puzzle type's *first* slice is a **measurement**, not code: the K7 re-slice cost more than an X0-style spike would have, and Kakuro's research names generation yield as the headline risk | Plan authoring, 2026-09-11 (Keisan K7 history) |
| L2 | When a new type can reuse an existing jsonb column by shape (runs ≅ Killer cages), gate **every reader** on `variant` before shipping — cage-shaped data is not cage behaviour | Keisan K5 audit finding, re-applied here |

## Measurements

| Date | Commit | What | Numbers |
|---|---|---|---|
| — | — | none yet — X0 is the first | — |
