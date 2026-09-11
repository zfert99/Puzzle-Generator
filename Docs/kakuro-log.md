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

- **2026-09-11 (night)** `[decision]` Owner: **build visual first, simplest → hardest**, for
  learning — a hand-baked Kakuro on the real board and PDF before any engine code, then each engine
  slice lands on that board → **D12 locked** (order) and the plan's slices re-cut from X0–X7 into
  **V1–V3 → E1–E5 → R1**. The yield spike (was X0) is now E3, still before any generator code. Hub
  card goes live at E5, not V2 (proposed part of D12). `[learning]` L5 added.
- **2026-09-11 (evening)** `[decision]` Owner: **sizes are per puzzle type** — three per type
  (smallest interesting / standard / large), not the inherited 4/6/9; Kakuro is built that way from
  the start → **D11 locked**, **D6 rewritten** (mini 6×6-or-7×7 chosen by E3, 9×9 standard, 13×13
  large), **D4 amended** (a mini slot plays at the assigned type's mini size). E3 now measures four
  candidate sizes; R1 replaces the global `DailySize` with a per-type table. Revisiting
  Classic/Killer/Keisan sizes under the same rule is **deferred** (noted in the plan's follow-ons).
- **2026-09-11 (later)** `[gap]` Findings doc received —
  [kakuro-research-gaps-findings.md](research/kakuro-research-gaps-findings.md) — answering G1–G5,
  G7–G10. `[decision]` **D5 superseded**: commercial Expert/Extreme Kakuro is chain-solvable (G5),
  so the published ladder is whips by depth, no bounded T&E; D1 locked (US dead, EU refused, Japan
  live → "Cross Sums" fallback wired); D9 gains the contiguous-rectangle + min-hints bounds (G10);
  D10 tightened to zero guesses at every published tier. Plan §1b lists the deltas; the engine and daily slices rewritten.
  `[learning]` L3, L4 added. Still open: G6 (E3 measures), G11/D4 (owner), G12 (product).
- **2026-09-11** `[decision]` D1–D10 opened from the research; D7 applied (Phase 10 added to the
  roadmap and README). `[gap]` G1–G12 opened. `[measure]` none yet — the yield spike (now E3) is the first measurement.
  Plan + this log written; no code.

## Decisions

| # | Decision | Rationale | Status |
|---|---|---|---|
| D1 | Display name **Kakuro**, subtitle **Cross Sums**, engine/slug **`kakuro`**; "Cross Sums" wired as a **one-constant fallback title**; no Nikoli affiliation implied | G1 resolved: all five U.S. filings dead (abandoned 2007–2009), EU bare-word application **refused** 2006 for non-distinctiveness, **Japan mark live** and asserted by Nikoli. Low risk for a US/EU-facing product; the fallback exists for Japan distribution or a cease-and-desist. Switch trigger: any new live KAKURO filing in a target market. Not legal advice — re-check TSDR/eSearch before paid marketing | Locked 2026-09-11 |
| D2 | Store the **interior N×N** grid plus an explicit **runs list**; render clues in a one-cell **gutter** (top + left) and inside interior black cells | Keeps `grid.length === N` everywhere the codebase already keys on it (`DailySize`, `PROFILE`, board `config.size`, `GridSize` union); a run is `{ id, cells, sum }`, i.e. structurally a Killer cage, so it fits `daily_puzzles.cages` jsonb with **no migration**. Alternative rejected for now: store `(N+1)×(N+1)` with the dead border (every reference implementation does this) — it breaks the size coupling above and forces 5/7/10 into `DailySize` | Proposed — confirm |
| D3 | Black cells are **`0` in both `grid` and `solution`**; **blocked = "belongs to no run"**, derived from `runs` at game start | The board's solved check is a cell-for-cell match, `gridsMatch` is the same, `countClues` counts non-zero (correct: Kakuro has no givens). A `-1` sentinel would leak into every `Grid` consumer. Cost: every "is the board complete" or "digit exhausted" loop must skip blocked cells | Proposed — confirm at V1 |
| D4 | Daily at 4 types: **3 mini slots, roll 3 of the 4 types** per day; a mini slot is played at the **assigned type's mini size** (D11), retiring the global "easy/medium = 4×4, hard = random(4/6)" rule for types with one mini size (existing types keep their behaviour via their own size table) | The daily plan's own "open scaling question" fires at the 4th type. Options weighed: (a) 3 slots / 3-of-4 types — no key change, no leaderboard identity change, one type sits out minis each day; (b) a 4th mini slot with a repeated tier — new key, picker/leaderboard reshaping; (c) more mini tiers — contradicts "no expert/extreme minis". Bests are already `(key, variant, size)`-scoped, so a slot whose size varies by type is safe | **Open — owner** on the slot count; size part settled by D11 (2026-09-11) |
| ~~D5~~ | ~~Top tiers: T1–T4 from the technique ladder; T5 = bounded depth-1 recursion with guess-step count (Keisan K7b–K7d transplant); chains deferred~~ | ~~Cheapest honest ladder already proven in-repo~~ **Superseded by G5 (2026-09-11):** commercial Expert/Extreme Kakuro is chain-solvable without T&E (Berthier on hundreds of ATK Hard; Conceptis Absolutely Nasty is singles-only at scale; Black Belt reviews). A bounded-guessing tier would over-rate large-easy boards and label guess-required boards no publisher ships | Superseded → **D5′** |
| D5′ | **Every published tier is logic-only.** T1–T3 by the technique ladder; **T4 = whips of bounded length; T5 = longer whips / g-whips** over Berthier's redundant per-run combination-variable model. **Surface sums (1-cut articulation points) are an accelerator inside T4+, never the rung** (Berthier: they rarely lower the whip rating). Bounded T&E survives only as an optional *experimental* tier outside the daily | G4 + G5 + G9 (Simonis: tier = weakest search-free technique level). Cost: a chain engine over non-binary constraints is the plan's biggest engineering unknown — spike it inside E2 before fixing the T4 bound; the E5 gate requires T4 to be populated | Proposed — confirm |
| ~~D6~~ | ~~v1 sizes 6×6 and 9×9 interior; 8×8 / 10×10 / 12×12 / 13×17 later; no 4×4~~ | ~~The daily needs exactly 9×9 + a mini size~~ Superseded by D11: sizes are no longer constrained to what the 4/6/9 daily model expects | Superseded → **D6′** |
| D6′ | **Kakuro's three sizes:** mini = **6×6 or 7×7** (E3 picks the smaller one whose accepted puzzles carry an honest Hard tail without T&E — G6), standard = **9×9** interior, large = **13×13** | Research §5: ≤ 5×5 trivial, 6–7 Easy–Medium (Hard verges on T&E at max density), 8–10 the sweet spot, 13×17/16×16 the classic print sizes. Odd N keeps the edges-inward centre line self-symmetric. 9×9 also matches the standard daily slot. 13×13 ships to play + PDF; a large daily slot is a separate daily-design question | Proposed — mini pending E3 |
| D11 | **Sizes are per puzzle type**: each type ships the smallest size that is genuinely interesting for *it*, its standard size, and a large size. "Mini" in menus and the daily means "this type's smallest size", not 4×4/6×6 | Owner, 2026-09-11: 4×4 is trivial for most of the types; forcing 4/6/9 on every puzzle was a Sudoku inheritance. Kakuro is built under the rule from day one; Classic/Killer/Keisan get revisited under it later (deferred, not in this plan). R1 makes the daily registry per-type (`SIZES[variant]`) so that later revisit is a table edit | **Locked (owner)** |
| D12 | **Visual first, simplest → hardest.** V1 types + baked fixtures → V2 board → V3 PDF → E1 exact solver (Hint button) → E2 classifier (difficulty badge, technique hints) → E3 yield spike → E4 generator ("New puzzle") → E5 difficulty + pickers + **hub card** → R1 daily. The deep link exists from V2; the hub card waits for E5 | Owner, 2026-09-11: build on top of a page that already exists so engine work is visible as it lands. Kept from the old order: the yield spike still precedes any generator code (L1). Hub timing: a card pointing at one baked puzzle would ship a one-puzzle type to `main` | **Locked (owner)** — hub timing proposed |
| D7 | Roadmap **Phase 10**, engine-first | Matches Phase 6 (Killer) and 8 (Keisan) | Applied 2026-09-11 |
| D8 | Difficulty label assigned by the **classifier post-generation**; generator parameters only bias toward a tier | Research §3/§5: publishers filter difficulty after generation; parameters do not predict it a priori | Locked |
| D9 | Shipped layouts: **180° rotational symmetry**, connected white region, runs 2–9, **no contiguous all-white rectangle ≥ 2×9 / 3×8 / 4×7 / 5×5** (supersets included; a 5×5 broken by an interior clue cell is fine), and within Mathimagics' **min-interior-hints / max-blanks** table (N=6: ≤ 24 whites, ≥ 1 hint; N=9: ≤ 59 whites, ≥ 5 hints) — all checked statically *before* the counting solver | Aesthetic norm + G10: each listed rectangle is guaranteed to contain a sum-preserving swap cycle. Static rejection is the cheapest yield lever we have | Locked (amended 2026-09-11) |
| D10 | **Guess count = 0 at every published tier**, Expert and Extreme included. Copy says "solvable by logic alone" everywhere; only an experimental tier, if ever built, carries a T&E label | Fairness norm, now backed by G5: the tiers the label is compared against are themselves logic-only | Locked (tightened 2026-09-11) |

## Gaps — research questions

| # | Question | What would resolve it | Blocks / degrades | Status |
|---|---|---|---|---|
| G1 | Common-law U.S. use and EU/JP registrations of "KAKURO" — is the *display* name clear? | ~~A counsel check~~ **Answered** ([findings §G1](research/kakuro-research-gaps-findings.md)): five U.S. filings all dead; EU application refused 2006; Japan mark live (Nikoli). No common-law software use found | D1 locked; fallback title wired | ✅ Resolved 2026-09-11 (strong US/EU, moderate JP) |
| G2 | Human solve-time baselines per size × tier, for `PROFILE` floors and bot times | ~~Published statistics~~ **Partially answered** ([§G2](research/kakuro-research-gaps-findings.md)): no Kakuro telemetry exists; anecdotes (hard daily ~10+ min skilled, 44 cells in 36 s as an admired outlier ≈ 0.8 s/cell); Sudoku analogue. Rule adopted: floors by **cell count**, well below record density; tune live | R1 floors — plan now carries the rule; numbers remain estimates | 🟡 Resolved as a rule, numbers pending live telemetry |
| G3 | The **edges-inward** template method as an implementable procedure, and whether published symmetric layout catalogs exist per size | **Answered** ([§G3](research/kakuro-research-gaps-findings.md)): Mathimagics t33581 six-step procedure (in E4 verbatim); no open template catalog exists — we build our own library from the generator | E4 | ✅ Resolved 2026-09-11 |
| G4 | **Surface / disconnection sums** as an algorithm | **Answered** ([§G4](research/kakuro-research-gaps-findings.md)): articulation points of the white-cell graph; 1-cut value = Σ across − Σ down over the cut-off region; 2-cuts give sum/difference. **Caveat that changed the plan:** Berthier measured they rarely lower the whip rating of real hard puzzles → accelerator, not a rung | E2 (T4 now defined by whip length) | ✅ Resolved 2026-09-11 |
| G5 | Do commercial "hardest" tiers require bounded T&E, or are they strictly chain-solvable? | **Answered** ([§G5](research/kakuro-research-gaps-findings.md)): chain-solvable, no T&E (ATK Hard via whips/g-whips; Conceptis Nasty singles-only at scale; Black Belt "pure logic"). Genuinely T&E puzzles exist only as research curiosities | D5 superseded → D5′ | ✅ Resolved 2026-09-11 (decisive) |
| G6 | Which mini size — **6×6 or 7×7** — separates Hard from Medium without T&E at normal density? (and does 13×13 generate inside a cron budget?) | E3 measurement over 6/7/9/13 + research §5's claim that hard 6×6 verges on T&E | D6′ mini size; E5 mini tiers; D4 mini eligibility; whether the large size ships the full ladder | Open — E3 measures first |
| G7 | Kakuro-specific a11y and rendering conventions | **Answered** ([§G7](research/kakuro-research-gaps-findings.md)): upper-right triangle = down, lower-left = across; WAI-ARIA grid with read-only clue cells naming both sums, roving tabindex skipping blockers; print: heavier outer border, shaded clues, separate answer key. **No screen-reader-tested Kakuro exists** — validate with NVDA/VoiceOver | V2 | ✅ Resolved 2026-09-11 (a11y extrapolated; AT test still owed) |
| G8 | Mapping Mathimagics' `fixed` / `implied` / `rating` to commercial grades | **Answered** ([§G8](research/kakuro-research-gaps-findings.md)): ATK table (E: rating 1.0 + high fixed%; M: 1.0, bigger/fewer fixed; H: 1.15–1.7, fixed 2–23). Rating alone ≠ human difficulty — combine with cell count and fixed%. No Conceptis cross-table exists; Mathimagics' code was never released | E5 calibration anchors | ✅ Resolved 2026-09-11 |
| G9 | Simonis, "Kakuro as a Constraint Problem" — grading scheme | **Answered** ([§G9](research/kakuro-research-gaps-findings.md)): ordinal grading by the weakest propagation level that solves search-free (naive → hyper-arc alldifferent-sum → shaving S/R); hint *removal* for tightening. No weighted coefficients to copy | E2 tier definitions (adopted); scorer weights stay ours | ✅ Resolved 2026-09-11 (numeric tables unretrieved) |
| G10 | **Structural non-uniqueness pre-checks** | **Answered** ([§G10](research/kakuro-research-gaps-findings.md)): contiguous all-white rectangles ≥ 2×9 / 3×8 / 4×7 / 5×5 always contain a swap cycle; min-hints / max-blanks table N=5..16; the ±1 clue trick manufactures non-unique fixtures | E4 static rejection; E1 test fixtures | ✅ Resolved 2026-09-11 |
| G11 | The daily mini scaling question at 4 types (design, not research) | The owner's call on D4 | R1 | Open — owner |
| G12 | Should the board ship a **combination-reference helper** ("combos for this run"), and is it a hint-level assist or default? Competitors ship it | Product decision informed by how Kakuro Conquest / Free Kakuro expose it and whether the daily's hint policy allows it | V2 scope; anti-cheat floors if it materially speeds solves | Open |

## Bugs

| # | Found | Slice | Symptom | Cause | Fix |
|---|---|---|---|---|---|
| — | — | — | none yet | — | — |

## Learnings

| # | Rule | Came from |
|---|---|---|
| L1 | A new puzzle type's *first* slice is a **measurement**, not code: the K7 re-slice cost more than an E3-style spike would have, and Kakuro's research names generation yield as the headline risk | Plan authoring, 2026-09-11 (Keisan K7 history) |
| L2 | When a new type can reuse an existing jsonb column by shape (runs ≅ Killer cages), gate **every reader** on `variant` before shipping — cage-shaped data is not cage behaviour | Keisan K5 audit finding, re-applied here |
| L3 | **Define a difficulty rung by a technique that is *necessary often*, never by a rare accelerator.** A rung defined by "needs surface sums" would be empty most days and collapse into the rung below; define rungs by chain depth and let accelerators shorten solves | G4 (Berthier: surface sums rarely change the whip rating) |
| L5 | **Give every engine slice a visible acceptance on the real board** (a hint, a badge, a button) — when the page exists first, "done" is something you can click, not a number in a test log | D12, plan re-cut 2026-09-11 |
| L4 | **An honest top tier is the one the published comparison set actually uses.** Before transplanting a top-tier mechanism from another puzzle (Keisan's bounded T&E), check what the publishers' hardest tier requires — Kakuro's is chains, so a guess-based Extreme would have been dishonest by construction | G5 |

## Measurements

| Date | Commit | What | Numbers |
|---|---|---|---|
| — | — | none yet — E3 is the first | — |
