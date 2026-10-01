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

- **2026-10-01 (V3)** Review follow-up 4 merged (#117). **V3 built**: `drawKakuroGrid` +
  `generateKakuroPDF` (gutter, shaded blocks, diagonals, down/across sums, answer pages);
  Kakuro on `/generate` at 7×7 / 9×9 with the full ladder, **one baked puzzle per level** until
  E5 (Zod-validated); `Docs/samples/kakuro-sample.pdf`. `[decision]` the clue picture
  (`buildClues`, `kakuroTracks`) moved from the board into the engine — it is the puzzle's, and
  the PDF is its second consumer. Every V and E slice through E3 is now done; E4 next.
- **2026-10-01 (review 4)** E3 merged (#116). Owner ran `/code-review high` over #115 + #116:
  **8 findings, all addressed** (#117; table in the plan under E2b). `[bug]` **B9** the g-link was
  applied one way only (a true combination's digit with no holder), so a chain that killed every
  holder of a digit two open combinations both needed never noticed. Both directions now; chain
  lengths fell sharply (`*_CHAINS` 4 → 3; the served extremes graded expert and were re-baked at
  chains of 5 / 6; the two E3 "unrated" 7×7s became rated). `[measure]` the 7×7 corpus regrade is
  in the Measurements table. `[decision]` D5′ reworded — the engine is braids **with** the g-link
  (Berthier's g-braids), confirmed by the owner with D6′ on 2026-10-01; the bound of 4 still
  splits the tiers. `[learning]` L17. The tier-5 ceiling watch item is closed: the one chain of
  exactly 12 was an artefact of the one-way link.
- **2026-10-01 (E3)** Review follow-up 3 merged (#115). **E3 measured** —
  [research/kakuro-feasibility-findings.md](research/kakuro-feasibility-findings.md).
  `[decision]` **D6′ settled by measurement:** mini = **6×6**, standard = 9×9, large = 13×13 on
  paper, **deferred** (the repair objective is too slow there). `[gap]` **G6 resolved** (6×6
  carries the full ladder with chains). `[measure]` the whole matrix is in the Measurements
  table. `[learning]` L15, L16. Owner confirmation of D6′ open.
- **2026-10-01 (review 3)** E2b merged (#114). Owner ran `/code-review` over it: **8 findings,
  all addressed** (table in the plan under E2b). `[bug]` B8 facts pre-pass not iterated → chain
  length could be over-counted across the tier bound. The g-link is now in the engine. The 7×7
  extreme touches the tier-5 ceiling (a chain of exactly 12) — watch at E5.
- **2026-10-01 (E2b)** Review follow-up merged (#113). **E2b built**: forcing chains over the
  redundant-variable model; tiers 4 (≤ 4 links) and 5 (≤ 12); both `*_CHAINS` fixtures solved
  by logic; expert/extreme fills found at both sizes, so the full ladder is served and the
  menu unlocks every level at 7×7. `[decision]` **D5′ applied** — as braids rather than whips,
  no g-whips (none needed yet), no surface sums. `[measure]` chain lengths and bounds.
  `[learning]` L14.
- **2026-10-01 (review 2)** E2a merged (#112). Owner ran `/code-review` over it: **8 findings,
  7 fixed, 1 recorded and deferred to E5** (per-step rescan cost) — table in the plan under
  E2a. `[bug]` B6 complete-but-wrong runs never contradicted; B7 the selected-cell hint could
  explain against a board the player does not have. `[learning]` L13.
- **2026-10-01 (E2a)** Review follow-up merged (#111). **E2a built** — logical solver T1–T3,
  classifier, metrics, scorer, hints that name their technique with a lead-up; fixtures re-cut
  to easy/medium/hard per size (hill-climbed against the ladder itself) with the two chain
  fills kept for E2b. `[decision]` E2 split into E2a/E2b. `[bug]` B5 hidden pair was unsound
  (Sudoku's "every digit is present" does not hold in a run). `[measure]` ladder-solvable fill
  search timings. `[learning]` L12.
- **2026-10-01 (review)** E1 merged (#110). Owner ran the hosted `/code-review` over the four
  merged slices (V0–E1): **10 findings, all addressed** in a follow-up PR — see the plan's
  "Review follow-up" step-log for the full list with outcomes, and B2–B4 below. `[bug]` B2 hint
  discarded every deduced cell on the first mismatch; B3 zero-run shape counted as 1 solution;
  B4 min-hints floor counted dead black cells. `[learning]` L10, L11.
- **2026-10-01 (later)** V2 merged (#109). **E1 built**, pulled ahead of V3: exact solver
  (`kakuro-solver.ts`) + combination view over the Killer table; both fixtures **proven unique
  in-repo**; the Hint button places solver-deduced cells; dev badge (unique ✓ · n nodes) under the board.
  `[measure]` uniqueness verify 0.12 ms on both fixtures (gate: 50 ms). `[learning]` L9.
- **2026-10-01** V0 (#104) and V1 (#108) merged. **V2 built**: Kakuro is playable at
  `/play?variant=kakuro` on the real board (7×7 and 9×9 fixtures) — gutter, clue cells, 1–9
  numpad, run-mate peers and stripping, block-skipping arrows, rules body, save/resume; the
  `/kakuro` workbench route and static board are deleted. `[bug]` **B1** — resumed board had no
  blocks/clues; cause was the store's post-hydration mutation of derived fields (also affected
  Killer's `cellToCage`); fixed by deriving in persist's `merge`. `[learning]` L8 added.
- **2026-09-30 (later)** V0 opened as PR #104. **V1 built** on top (uncommitted): types, layout
  validation, `deriveRuns`, two fixtures (7×7, 9×9), and the static board now draws real clue
  sums. `[decision]` D2 and D3 **applied** (interior storage + runs list, gutter as a render
  concern; black = `0` = in no run) — built on as proposed; **owner confirmed both the same day → locked.** `[measure]` first numbers — random fills vs hill-climbed fills.
  `[learning]` L7 added. Plan V1 step-log lists four small divergences from the V1 spec.
- **2026-09-30** `[decision]` Build started. Owner: begin even simpler than V1 — a **looks-only
  static board** (no types, no store, no sums) so the visual design comes first → new slice **V0**
  added to the plan ahead of V1; D12 amended. Branch `feature/kakuro` cut from `main` (`d0333d5`).
  Workbench route `/kakuro` (noindex, unlinked) shows a hand-drawn 7×7 shape. `[learning]` L6
  added. The 7×7 is a drawing convenience, **not** the D6′ mini-size pick (still E3's).
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
| D2 | Store the **interior N×N** grid plus an explicit **runs list**; render clues in a one-cell **gutter** (top + left) and inside interior black cells | Keeps `grid.length === N` everywhere the codebase already keys on it (`DailySize`, `PROFILE`, board `config.size`, `GridSize` union); a run is `{ id, cells, sum }`, i.e. structurally a Killer cage, so it fits `daily_puzzles.cages` jsonb with **no migration**. Alternative rejected for now: store `(N+1)×(N+1)` with the dead border (every reference implementation does this) — it breaks the size coupling above and forces 5/7/10 into `DailySize` | **Locked (owner) 2026-09-30**; applied in V1 (`KakuroPuzzle`, `KakuroBoard` gutter) |
| D3 | Black cells are **`0` in both `grid` and `solution`**; **blocked = "belongs to no run"**, derived from `runs` at game start | The board's solved check is a cell-for-cell match, `gridsMatch` is the same, `countClues` counts non-zero (correct: Kakuro has no givens). A `-1` sentinel would leak into every `Grid` consumer. Cost: every "is the board complete" or "digit exhausted" loop must skip blocked cells | **Locked (owner) 2026-09-30**; applied in V1 |
| D4 | Daily at 4 types: **3 mini slots, roll 3 of the 4 types** per day; a mini slot is played at the **assigned type's mini size** (D11), retiring the global "easy/medium = 4×4, hard = random(4/6)" rule for types with one mini size (existing types keep their behaviour via their own size table) | The daily plan's own "open scaling question" fires at the 4th type. Options weighed: (a) 3 slots / 3-of-4 types — no key change, no leaderboard identity change, one type sits out minis each day; (b) a 4th mini slot with a repeated tier — new key, picker/leaderboard reshaping; (c) more mini tiers — contradicts "no expert/extreme minis". Bests are already `(key, variant, size)`-scoped, so a slot whose size varies by type is safe | **Open — owner** on the slot count; size part settled by D11 (2026-09-11) |
| ~~D5~~ | ~~Top tiers: T1–T4 from the technique ladder; T5 = bounded depth-1 recursion with guess-step count (Keisan K7b–K7d transplant); chains deferred~~ | ~~Cheapest honest ladder already proven in-repo~~ **Superseded by G5 (2026-09-11):** commercial Expert/Extreme Kakuro is chain-solvable without T&E (Berthier on hundreds of ATK Hard; Conceptis Absolutely Nasty is singles-only at scale; Black Belt reviews). A bounded-guessing tier would over-rate large-easy boards and label guess-required boards no publisher ships | Superseded → **D5′** |
| D5′ | **Every published tier is logic-only.** T1–T3 by the technique ladder; **T4 = forcing chains of length ≤ 4; T5 = longer chains (≤ 12)** over Berthier's redundant per-run combination-variable model — built as *braids* (whips with memory; rate almost identically) **with the g-link in both directions** (a combination needing a digit no cell can hold is false; a digit every open combination needs with one holder is true), i.e. Berthier's g-braids. **Surface sums are an accelerator, never the rung** (not built). Bounded T&E survives only as an optional *experimental* tier outside the daily | G4 + G5 + G9 (Simonis: tier = weakest search-free technique level). The chain engine turned out small (~300 lines) once the model was right. The bound of 4 was set when the `*_CHAINS` fills needed exactly 4 under a one-way g-link; with the two-way link they need 3 and a 36-puzzle 7×7 corpus still splits 15 expert / 4 extreme at the same bound (Measurements, review 4) — provisional until E5's distribution | **Applied 2026-10-01 (E2b; g-link two-way in review 4)** — **confirmed by owner 2026-10-01** |
| ~~D6~~ | ~~v1 sizes 6×6 and 9×9 interior; 8×8 / 10×10 / 12×12 / 13×17 later; no 4×4~~ | ~~The daily needs exactly 9×9 + a mini size~~ Superseded by D11: sizes are no longer constrained to what the 4/6/9 daily model expects | Superseded → **D6′** |
| D6′ | **Kakuro's three sizes:** mini = **6×6**, standard = **9×9** interior, large = **13×13 on paper, deferred**. 7×7 stays as a second playable size (fixtures exist) but is not the mini | E3 (2026-10-01): 6×6 produces every tier — hard 6–11/20, expert 4, extreme 3 at 39% black — and repairs to unique in 3–10 ms; the research's "hard 6×6 verges on T&E" predates the chain tiers. 13×13: 0/3 repairs in 60 s at 33% black, 1/3 in 32 s at 39% — the solution-count objective is too expensive there; needs its own measured approach (cheaper objective or templates) before it ships anywhere. The daily never needed it (R1 = 6×6 + 9×9) | **Measured 2026-10-01 — confirmed by owner 2026-10-01** |
| D11 | **Sizes are per puzzle type**: each type ships the smallest size that is genuinely interesting for *it*, its standard size, and a large size. "Mini" in menus and the daily means "this type's smallest size", not 4×4/6×6 | Owner, 2026-09-11: 4×4 is trivial for most of the types; forcing 4/6/9 on every puzzle was a Sudoku inheritance. Kakuro is built under the rule from day one; Classic/Killer/Keisan get revisited under it later (deferred, not in this plan). R1 makes the daily registry per-type (`SIZES[variant]`) so that later revisit is a table edit | **Locked (owner)** |
| D12 | **Visual first, simplest → hardest.** *(Amended 2026-09-30: a looks-only static board, **V0**, now precedes V1 — owner.)* V1 types + baked fixtures → V2 board → V3 PDF → E1 exact solver (Hint button) → E2 classifier (difficulty badge, technique hints) → E3 yield spike → E4 generator ("New puzzle") → E5 difficulty + pickers + **hub card** → R1 daily. The deep link exists from V2; the hub card waits for E5 | Owner, 2026-09-11: build on top of a page that already exists so engine work is visible as it lands. Kept from the old order: the yield spike still precedes any generator code (L1). Hub timing: a card pointing at one baked puzzle would ship a one-puzzle type to `main` | **Locked (owner)** — hub timing proposed |
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
| G6 | Which mini size — **6×6 or 7×7** — separates Hard from Medium without T&E at normal density? (and does 13×13 generate inside a cron budget?) | **Answered** ([findings §3d, §3f](research/kakuro-feasibility-findings.md)): 6×6 separates — with chains it even carries expert/extreme — at 3–10 ms per unique puzzle; 13×13 does **not** generate inside the budget with the solution-count repair objective | D6′ settled; E5 mini tiers = full ladder; large size deferred | ✅ Resolved 2026-10-01 |
| G7 | Kakuro-specific a11y and rendering conventions | **Answered** ([§G7](research/kakuro-research-gaps-findings.md)): upper-right triangle = down, lower-left = across; WAI-ARIA grid with read-only clue cells naming both sums, roving tabindex skipping blockers; print: heavier outer border, shaded clues, separate answer key. **No screen-reader-tested Kakuro exists** — validate with NVDA/VoiceOver | V2 | ✅ Resolved 2026-09-11 (a11y extrapolated; AT test still owed) |
| G8 | Mapping Mathimagics' `fixed` / `implied` / `rating` to commercial grades | **Answered** ([§G8](research/kakuro-research-gaps-findings.md)): ATK table (E: rating 1.0 + high fixed%; M: 1.0, bigger/fewer fixed; H: 1.15–1.7, fixed 2–23). Rating alone ≠ human difficulty — combine with cell count and fixed%. No Conceptis cross-table exists; Mathimagics' code was never released | E5 calibration anchors | ✅ Resolved 2026-09-11 |
| G9 | Simonis, "Kakuro as a Constraint Problem" — grading scheme | **Answered** ([§G9](research/kakuro-research-gaps-findings.md)): ordinal grading by the weakest propagation level that solves search-free (naive → hyper-arc alldifferent-sum → shaving S/R); hint *removal* for tightening. No weighted coefficients to copy | E2 tier definitions (adopted); scorer weights stay ours | ✅ Resolved 2026-09-11 (numeric tables unretrieved) |
| G10 | **Structural non-uniqueness pre-checks** | **Answered** ([§G10](research/kakuro-research-gaps-findings.md)): contiguous all-white rectangles ≥ 2×9 / 3×8 / 4×7 / 5×5 always contain a swap cycle; min-hints / max-blanks table N=5..16; the ±1 clue trick manufactures non-unique fixtures | E4 static rejection; E1 test fixtures | ✅ Resolved 2026-09-11 |
| G11 | The daily mini scaling question at 4 types (design, not research) | The owner's call on D4 | R1 | Open — owner |
| G12 | Should the board ship a **combination-reference helper** ("combos for this run"), and is it a hint-level assist or default? Competitors ship it | Product decision informed by how Kakuro Conquest / Free Kakuro expose it and whether the daily's hint policy allows it | V2 scope; anti-cheat floors if it materially speeds solves | Open |

## Bugs

| # | Found | Slice | Symptom | Cause | Fix |
|---|---|---|---|---|---|
| B9 | 2026-10-01 (review 4) | E2b | Chains graded 2–3× longer than the model warrants: the `*_CHAINS` fills "needed exactly 4", the searched extremes 6–12 (one at the tier-5 ceiling), and 2 of 36 repaired 7×7s were unrated (no chain ≤ 12) | The g-link was applied only to a run whose combination was already true; its contrapositive — a digit with no remaining holder falsifies every open combination that needs it — was never applied, so killing every holder of a digit left the run "open" until another link singled a combination out | Both directions in `scan()`, facts included; the first extreme pair then graded expert and was re-searched (chains of 5 / 6); tests pin the 7×7 original at 3 and the raw-context facts — review-4 PR |
| B8 | 2026-10-01 (review) | E2b | A chain whose first link was really an already-forced fact (a run left with one combination by another single-combination run) was counted one link longer than it was — enough to cross the tier-4 bound in a raw context | The facts pre-pass asserted single-combination runs once and did not iterate | Facts established to a fixpoint (runs, cells, and what they force) before the supposition; tested with a length-0 case — review-3 PR |
| B6 | 2026-10-01 (review) | E2a | `KakuroLogicalSolver` trusted a complete run with a repeated digit or the wrong sum and kept deducing from it; `contradiction` stayed false | No technique revisits a run with no empty cells, and the constructor only stripped mates | Constructor validates placed runs (repeat, complete-run sum, placed digits over the clue); tests — review-2 PR |
| B7 | 2026-10-01 (review) | E2a | A hint for the selected cell could explain it against placements the solver had made internally but the board did not have ("down 3-in-one" with two empty cells showing) | `explainKakuroHint` detoured past up to 4 placements by default to reach the preferred cell | No detour by default; eliminations-first mode places the preferred cell as soon as it is deducible; tested on the chain fixture — review-2 PR |
| B5 | 2026-10-01 | E2a | The first hidden-pair draft placed a wrong digit on the 7×7 fixture | Sudoku's hidden pair assumes every house contains every digit; a Kakuro run need not contain any given digit, so two merely-possible digits confined to two cells prove nothing | Hidden single/pair only consider digits every remaining combination requires; soundness tests (all fixtures + random unique grids) pin it — E2a PR |
| B2 | 2026-10-01 (review) | E1 | Kakuro `hint()` fell back to a blind reveal whenever the *first* solver-forced cell disagreed with the solution, even if another forced cell was a sound deduction | The check-against-solution was applied to one pick, not iterated | Take the selected cell if forced *and* agreeing, else the first agreeing forced cell; test plants a consistent-but-wrong 3 and asserts one correct placement — review follow-up PR |
| B3 | 2026-10-01 (review) | E1 | `countKakuroSolutions({ runs: [] })` reported **1** solution (the empty grid); `% 0` on the zero-length ring buffer gave NaN | No guard for a shape with no runs | Return 0 solutions / contradiction up front; tested |
| B4 | 2026-10-01 (review) | V1 | `validateKakuroLayout`'s min-hints floor counted every interior black cell, so a solid black blob heading no run passed a floor it should fail | Misread Mathimagics' "interior hints" as "interior blacks" | Count black cells with a white cell to the right or below; test with 12 blacks / 4 hints at 9×9 |
| B1 | 2026-10-01 | V2 | A resumed Kakuro rendered every cell white with no clues (and threw `undefined[c]` from `Cell`'s selector before the optional-chaining guard) | `onRehydrateStorage` rebuilt derived fields (`peers`, `cellToCage`, now `blocked`/`clues`) by **mutating** the state object after hydration's `set` — no subscriber is notified, so already-rendered cells never re-read them. Latent since Killer: `cellToCage` was one interaction late after every reload | Derive in persist's `merge` (runs before the state is set) — `useBoardStore.ts`, V2 PR |

## Learnings

| # | Rule | Came from |
|---|---|---|
| L1 | A new puzzle type's *first* slice is a **measurement**, not code: the K7 re-slice cost more than an E3-style spike would have, and Kakuro's research names generation yield as the headline risk | Plan authoring, 2026-09-11 (Keisan K7 history) |
| L2 | When a new type can reuse an existing jsonb column by shape (runs ≅ Killer cages), gate **every reader** on `variant` before shipping — cage-shaped data is not cage behaviour | Keisan K5 audit finding, re-applied here |
| L3 | **Define a difficulty rung by a technique that is *necessary often*, never by a rare accelerator.** A rung defined by "needs surface sums" would be empty most days and collapse into the rung below; define rungs by chain depth and let accelerators shorten solves | G4 (Berthier: surface sums rarely change the whip rating) |
| L5 | **Give every engine slice a visible acceptance on the real board** (a hint, a badge, a button) — when the page exists first, "done" is something you can click, not a number in a test log | D12, plan re-cut 2026-09-11 |
| L6 | **Hand-authored layouts get validated by code, not by eye.** The first V0 sketch looked fine and was one white cell over the N=7 uniqueness ceiling; nothing on screen would ever have shown it | V0, 2026-09-30 |
| L7 | **Don't fill-and-retry a fixed layout; repair the fill.** Independent random fills of one layout were unique 0 times in 3,000, while a one-cell-at-a-time hill-climb on the same layout converged. Treat "P(unique) per random fill" as ≈ 0 until E3 measures otherwise | V1 fixture authoring, 2026-09-30 |
| L8 | **Never mutate hydrated store state to "finish" it — derive in `merge` or `setState`.** A mutation after hydration notifies no subscriber, so whatever rendered first keeps the stale slice; the bug only shows for a field a component reads on first paint, which is why `peers` (read only inside actions) hid it for months | B1, V2, 2026-10-01 |
| L9 | **A hint from a solver must be re-checked against the answer before it is placed.** Propagation from a board that already holds a wrong digit can force a digit that is consistent with the mistake and wrong against the solution; "the solver said so" is not "it is correct" once the premises are the player's | E1, 2026-10-01 |
| L17 | **A one-way link is half a link — rate nothing until the model's links run both ways.** The g-link was implemented as "true combination → its digits need holders" and the bounds, the extreme fixtures and E3's tier distribution were all measured on that; adding the contrapositive cut chain lengths by 2–3× and re-graded two fixtures. Before setting a bound from chain lengths, list every link of the model and check each is applied in both directions | B9, 2026-10-01 |
| L16 | **A spike needs a wall-clock cap per attempt from the first run.** The 13×13 repair ran unbounded for 52 minutes (its objective — counting up to 50 solutions of a 103-cell grid — cost the whole node budget per step); a 60 s cap gave the same answer in 6 minutes | E3, 2026-10-01 |
| L15 | **At every size, uniqueness is *repaired into* a fill, not found by retrying fills — and the repair's objective must be cheap at the size in question.** P(unique) ≈ 0.1% everywhere; one-cell repair converges in ms at 6–9 but "count solutions" is no longer cheap at 13 | E3, 2026-10-01 |
| L14 | **Suppose-and-propagate over binary links is a proof, not a guess, only if every link is a sound implication — and only if the facts come first.** A chain context must assert what is already forced (single-combination runs) before supposing anything, or a true chain is missed; and the forced-truth count, not the number of candidates tried, is the rating | E2b, 2026-10-01 |
| L13 | **An explanation may only cite what is on the player's board.** A solver that silently places cells "on the way" to the one it explains produces a true deduction with a false reason; keep placements out of a hint's lead-up unless the caller applies them too | B7, 2026-10-01 |
| L12 | **Port a Sudoku technique only after asking what house property it relies on.** "Hidden" rules rest on "every digit is present in the unit"; Kakuro runs have no such property, so the port needs a `required` guard. Expect the same question for every classic technique E2b borrows (X-wing, chains: what plays the role of the house?) | B5, 2026-10-01 |
| L10 | **A derived store field needs a test that hydrates from storage**, not one that calls `startNewGame` — the latter can never see a rebuild that is missing or late. Snapshot localStorage, wipe the store, `persist.rehydrate()`, read the field; prove the test bites by deleting the rebuild once | Review finding 1, 2026-10-01 |
| L11 | **When a review names a cheap cleanup, take it in the same follow-up** — the private `popcount`, the empty `if` branch and the `as Variant` cast each cost minutes to fix and would otherwise have been copied by the next slice | Review findings 5–7, 2026-10-01 |
| L4 | **An honest top tier is the one the published comparison set actually uses.** Before transplanting a top-tier mechanism from another puzzle (Keisan's bounded T&E), check what the publishers' hardest tier requires — Kakuro's is chains, so a guess-based Extreme would have been dishonest by construction | G5 |

## Measurements

| Date | Commit | What | Numbers |
|---|---|---|---|
| 2026-10-01 | review 4 | **Two-way g-link regrade** — fresh repaired corpora (E3's loop, no classifier in the objective) graded by the one-way engine (`cc9a953`) and the two-way one on the same puzzles; "minimal bound" = smallest L at which T1–T3 + chains ≤ L finishes (0 = no chain) | **7×7 @32%, 36 puzzles.** Tiers e/m/h/x/X/unrated: 1/5/11/8/9/2 → **1/5/11/15/4/0**. Minimal bound: `{0:17, 1:1, 3:1, 4:6, 5:4, 6:1, 7:1, 9:2, 10:1, >12:2}` → `{0:17, 1:2, 3:8, 4:5, 5:2, 7:1, 11:1}`. Classify 3.7 → 4.1 ms. **9×9 @29%+34%, 23 puzzles.** Tiers h/x/X/unrated: 7/3/8/5 → **7/5/8/3**; bound @34%: `{0:6, 1:1, 4:2, 5:1, 7:1, 8:1, 11:1, >12:3}` → `{0:6, 1:1, 3:3, 5:1, 7:2, 9:1, >12:2}`. Classify 31.6 → 16.9 ms. **Fixtures:** `*_CHAINS` 4 → 3; experts 2–3; first extremes 3–4 (re-baked: new ones need 5 / 6, found in 0.3 s / 50 s) |
| 2026-09-30 | uncommitted (V1, on `bfa0fcb`) | **Random fill → unique?** Fixed 7×7 layout (32 whites), randomized run-all-different fill, derive clues, count solutions (stop at 2). Throwaway script, crude MRV counter with min/max sum pruning | **0 unique / 3,000 fills** in 2.4 s (~0.8 ms per fill+count) |
| 2026-10-01 | E3 | **Yield matrix** — random symmetric layouts (20 per config; 6 at 13×13), 200 random fills (100 at 13), 20 one-cell repair climbs (3 at 13, 60 s cap). Full tables in `research/kakuro-feasibility-findings.md` | **P(unique) random:** 0/200 (6×6 39%), 1/200 (6×6 44%), 1/200 (7×7 32%), 0/200 ×2 (7×7 37/41%), 0/200 ×3 (9×9 29/37/34%), 0/100 ×2 (13×13). **Repair ok / median:** 6×6 19–20/20, 3–10 ms · 7×7 18–20/20, 5–24 ms · 9×9 9/20 @29% 498 ms, 13/20 @37% 167 ms, 18/20 @34% 64 ms · 13×13 0/3 @33%, 1/3 @39% 32 s. **Tiers of accepted (e/m/h/x/X/unrated):** 6×6 1/5/6/4/3/0 and 1/5/11/0/3/0 · 7×7 0/1/8/1/6/2, 0/2/7/3/7/0, 0/0/8/2/10/0 · 9×9 0/0/1/0/4/4, 0/1/4/3/5/0, 0/1/7/2/7/1 · 13×13 X 1. **Verify avg:** 0.07–0.17 ms (6/7), 0.55–7.4 ms (9), 46–90 ms (13, 19–43% budget-outs) |
| 2026-10-01 | E2b (uncommitted) | **Minimal chain length** that finishes each original fill after the tier-3 standstill, chains ≤ L for L = 1..8 | 7×7: 27 undecided at L ≤ 3, **solved at 4**. 9×9: 29 undecided at L ≤ 3, **solved at 4**. Searched fills: 7×7 extreme needs chains of 6 and 10; 9×9 extreme 8 and 7; experts one chain of 4 |
| 2026-10-01 | E2b | **Chain-tier fill search** (hill-climb; score = non-unique count, then "not solvable at target tier", then "solvable one tier lower") | 7×7 expert 1.5 s, 7×7 extreme 0.07 s (the first random fill qualified), 9×9 expert 63 s (restart 4), 9×9 extreme 45 s (restart 3). Classify: ~7 ms expert, ~35 ms extreme; hint ~1 ms |
| 2026-10-01 | E2a (uncommitted) | **Ladder-solvable fill search** — hill-climb on a fixed layout, scoring a fill by (non-unique solution count) then (cells the T1–N ladder leaves undecided); one cell mutated per step | 7×7: tier-3 fill in 1.2 s, tier-2 in 0.5 s, tier-1 in 2.4 s (first restart each). 9×9: tier-3 in 11 s, tier-2 in 92 s (restart 1 stuck at a non-unique dead end, restart 2 solved), tier-1 in 69 s. Random fills: never ladder-solvable |
| 2026-10-01 | E2a | **Ladder on the served fixtures** (`fixed` / `implied` / `rating`) | 7×7 e/m/h: 32/32/1.00 · 5/32/1.00 · 7/8/3.41. 9×9 e/m/h: 55/55/1.00 · 8/55/1.00 · 22/22/2.86. `*_CHAINS` fills: T3 stalls at 27 (7×7) / 29 (9×9) undecided. Classify 9×9 ≈ 6 ms |
| 2026-10-01 | E1 (uncommitted) | **Uniqueness verify time**, `countKakuroSolutions` (limit 2) on the baked fixtures, 200 runs after warm-up, Node 22 via tsx | 7×7: **0.122 ms** avg, 13 nodes. 9×9: **0.123 ms** avg, 11 nodes. Gate was < 50 ms |
| 2026-09-30 | same | **Hill-climbed fill → unique?** Same counter (cap 300 solutions); mutate one cell to a digit legal in both its runs, accept if the solution count does not rise | 7×7 (32 whites): unique in **~2.3 s**, first restart. 9×9 (55 whites): unique in **~105 s**, first restart. One sample each — a signal for E3, not a yield figure |
