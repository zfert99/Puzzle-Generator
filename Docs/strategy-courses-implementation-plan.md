# Phase 7 — Interactive Strategy Courses: Implementation Plan

> **Status:** 📋 Planned — do not start without a fresh branch (`feature/strategy-courses`,
> already checked out).
> **Research:** [interactive-sudoku-course-design.md](research/interactive-sudoku-course-design.md)
> (learning-science + interactive-platform design patterns) · the existing
> [sudoku-generation.md](research/sudoku-generation.md) research already underpins the engine
> this plan instruments.
> **Prerequisite:** Phase 3 (Interactive Board) — done; benefits from Phase 5's design system —
> done. Soft integration point with Phase 9 (crumbs/achievements) once it exists — not a hard
> dependency; see Risks.

Turn `HumanSolver` from a silent backend engine into a visual teaching tool: worked
demonstrations of each technique, faded practice, mastery-gated progression, and a skill-tree
showing the solving ladder. This is engine-first work disguised as a frontend feature — the
hard, high-risk part is instrumenting the solver to explain itself without slowing it down.

## 1. What the research locks in (before any code)

- **Worked example → faded completion problems → cued practice → independent practice, gated
  on demonstrated mastery, not time.** This is the most robust finding in the research for
  procedural skills and maps directly onto one Sudoku technique at a time.
- **The curriculum sequence is the existing solving ladder** — singles → locked candidates →
  subsets → fish → wings → chains/coloring — which is *also, already, exactly* the tier order
  `HumanSolver.solve()` attempts strategies in (cheapest-first). The engine's existing
  architecture and the pedagogy's recommended sequence are the same list; no redesign needed,
  just exposure.
- **Block-practice a new technique, then interleave it with earlier ones** once ~3 are known —
  interleaving hurts in-session performance but roughly doubles next-day retention per the
  cited studies. Don't build "mixed practice" before at least 3 techniques exist end-to-end.
- **A 3-level hint ladder** (nudge/where-to-look → name-the-technique → full visual
  walkthrough), with the explicit UX lesson from SudokuWiki: let the learner control
  granularity (one deduction per click), and encourage predicting the move before revealing it.
- **Visual convention:** place=green, eliminate=red, about-to-eliminate=yellow, pattern-defining
  cells=orange, two-color chain states=blue/green — but this is SudokuWiki's palette, not
  Biscuit Lab's. **This app's design system only has four semantic game-feedback colors today**
  (`mint`=correct, `cherry`=wrong, `butterscotch`=primary action, `grape`=nav/secondary) and its
  own hard rule: *"correct/wrong/selected states are never color-only"* (`design-system.md`).
  The research's 5–6 highlight roles need new tokens (or Biscuit-Lab-recolored equivalents) AND
  non-color cues (icon/shape/label) for every one of them — a real, un-skippable design task,
  not a copy of SudokuWiki's convention. Flagged as its own gated step in L2, not decided here.
- **Reward mastery and learning behaviors, not raw activity** (techniques mastered, first
  unaided solve) — and use informational/competence feedback over tangible rewards, which the
  cited meta-analysis (Deci, Koestner & Ryan 1999) found actually *enhances* intrinsic
  motivation rather than crowding it out. Add forgiveness (streak-freeze-style), and let players
  opt out of any competitive framing.
- **Direct empirical research on teaching Sudoku specifically is thin** — the plan below
  extrapolates from cognitive-load theory, chess-chunking, and language-learning platforms.
  Treat mastery-gate thresholds and hint costs as tunable, not fixed, and watch the research
  doc's own "benchmarks that should change the plan" (§ Recommendations) once real usage data
  exists.

## 2. What we already have (reuse map)

| Existing asset | Reuse for Phase 7 |
|---|---|
| `HumanSolver` + `strategies/{basic,advanced,extreme}.ts` | The entire technique ladder already exists as engine code (naked/hidden singles, naked/hidden pairs, pointing pairs, X-Wing, Swordfish, Y-Wing, XYZ-Wing, W-Wing, ALS-XZ, AIC). **Every `applyX` function currently returns only a boolean** ("did this change the grid") — none record *which* cells/candidates were involved or why. This is the real work of L1, not a data-plumbing exercise. |
| `CageOverlay.tsx` + `cage-geometry.ts` | Directly — the "SVG in a `0..size` viewBox laid over the grid" pattern is exactly the mechanism a "highlight these cells / draw this chain link" overlay needs. New component (`StrategyOverlay`), same technique. |
| `ConfirmModal.tsx`'s dialog shell | Directly — reusable for a lesson-intro card or the hint popup (backdrop, `role="dialog"`, Escape-to-close, focus-on-open already solved). |
| `Cell.tsx`'s `useShallow` granular-subscription pattern | Directly — per-step highlight state must follow the same INP-conscious discipline (AGENTS.md §3), not a whole-board re-render per deduction step. |
| Colorblind palette infra (`Board.module.css`'s `:root[data-colorblind="true"]` block, Okabe-Ito hues) | Pattern, not data — the same *mechanism* (CSS custom properties swapped under a root attribute) extends to new highlight roles, but the actual color values are new (see §1). |
| `Docs/design/design-system.md`'s "never color-only" rule | Directly enforced, not just referenced — every new highlight role needs a shape/icon/text pairing from day one, per that doc's own §5 rule. |
| Daily-board registry / anti-cheat / leaderboard infra | **Does NOT apply.** A lesson curriculum is a fixed, authored sequence, not a daily-generated puzzle — this needs a new content shape (lesson definitions + curated example grids), not a registry row. |
| Phase 9 achievements/streaks (`social-progression-economy-plan.md`) | Not built yet. Soft integration point only (reward mastery events once the crumbs ledger exists) — see Risks. |
| Sudoku Bot (`features/leaderboards/bot.md`) | Narrative-only tie-in already recorded in `roadmap.md`'s Phase 7 section: floated as the course's "teacher" character. Not a mechanic here — see L6. |

## 3. Slices

### L1 — Solver step serialization (the critical, highest-risk slice)

- Add an **opt-in** recording mode to `HumanSolver.solve()` — e.g.
  `solve({ ...existing options, recordSteps: true })` — that additionally returns a
  `steps: SolveStep[]` array. **The existing zero-argument/`recordSteps`-omitted call shape
  must be byte-for-byte unchanged in behavior and cost**, because `solve()` is also the
  generator's difficulty-grading hot path (called potentially thousands of times per generated
  puzzle) under the AGENTS.md §3 performance budgets (Basic < 0.3 ms, Extreme < 10 ms).
- Expand the roadmap's original `SolveStep` sketch (`strategy`, `description`,
  `highlights: {cells, color}[]`, `eliminations`, `placements`) to carry enough semantic detail
  for the research's highlight roles (place / eliminate / about-to-eliminate / pattern-defining
  cells / two chain-color groups) — a `role` field per highlight group, not just a single
  `color` enum, so L2's overlay can map roles to tokens independently of engine internals.
  Each `applyX` function needs to build this step record only when recording is on (a boolean
  branch per call site, not a behavior change to the non-recording path).
- **Gate:** run `npx tsx src/features/engine/benchmarks/benchmark-human-solver.ts` before and
  after — the non-recording path must show no regression against the logged baselines
  (`benchmark-logs.md`). Hand-verify the recorded steps for one example puzzle per technique
  against a known-correct worked solution (start with naked/hidden single, expand as later
  slices need more techniques — don't front-load all 10 techniques' step logic before L3 proves
  the loop needs it).

### L2 — Highlight/overlay rendering engine + the color-role decision

- `StrategyOverlay`: `CageOverlay`'s sibling — consumes a `SolveStep`'s highlight groups and
  renders them (cell tints, candidate call-outs, chain link lines) over the board, honoring
  the board's existing z-index/stacking order so digits stay readable (same discipline as
  `CageOverlay`'s existing comment on this).
- Decide and document the actual Biscuit-Lab color-role mapping here (not in L1) — this is a
  real design task: how many new tokens, which existing ones get reused with a modifier
  (opacity/pattern), and the non-color cue paired with each (icon, label text, or shape) per
  the design system's own rule. Extend the colorblind override block the same way `--cell-peer`
  etc. already are.
- "Take Step" control: one deduction per click (not cascading multiple at once — the
  documented SudokuWiki UX complaint the research explicitly calls out to avoid), with a
  synchronized text "because…" explanation (`aria-live`, matching `BoardAnnouncer`'s existing
  pattern for accessible state changes).
- **Gate:** a11y pass (axe-core, matching the project's existing a11y testing convention) +
  manual colorblind-mode check; reduced-motion-safe (no forced animation on step reveal, per
  `:root[data-motion="reduce"]`'s existing precedent).

### L3 — First two techniques end-to-end (prove the loop before scaling)

- Naked Single + Hidden Single, the full research loop: 2–4 sentence concept intro → worked
  demo (L1 step data through L2's overlay) → backward-faded completion problems → cued
  practice → independent practice with the 3-level hint ladder → one lightweight
  self-explanation multiple-choice prompt per technique.
- New content shape needed: curated example/practice grids per technique + narration text.
  This is authored content, not derived from the daily/engine registries — budget real time
  for writing it, not just building the player.
- Mastery gate: a simple, tunable threshold (e.g. 3 consecutive unaided correct applications)
  before a technique is marked "mastered." Not persisted server-side yet (see L5) — local
  state / localStorage is enough for this slice.
- **Gate:** the full loop is playable and manually verified end to end for exactly these two
  techniques. Per the research's own Stage-1 recommendation, this proves the core loop before
  any more content gets written — treat "does the loop work" as the actual v1 milestone, not
  "how many techniques are covered."

### L4 — Skill-tree / mastery map + ladder through Subsets

- A visual skill-tree (Duolingo/Khan-style) showing the solving ladder with per-technique
  mastery state and a clear "next" — satisfies the research's competence/autonomy framing
  better than a flat list or raw points.
- A short diagnostic placement quiz so an experienced player can skip ahead rather than
  re-learning singles (the research explicitly warns the worked-example effect *reverses* for
  experts — don't force it on them).
- Extend L3's proven lesson-loop machinery to Locked Candidates (pointing pairs — already an
  engine strategy) and Subsets (naked/hidden pairs already exist; triples/quads are a
  reasonably small extension of the same strategy functions) — new content, same loop, same
  L1/L2 machinery.
- If Phase 9 has landed by this point: wire mastery events (technique mastered, first unaided
  solve) into its crumbs/achievement system, reward-weighted toward mastery per the research's
  overjustification warning — not a blocker if Phase 9 hasn't shipped yet.

### L5 — Interleaved mixed practice + spaced review

- Once ≥3 techniques are mastered, unlock practice puzzles that don't announce which technique
  applies — this is where actual strategy-selection skill is built, per the research.
- Spaced re-exposure (resurface a technique after expanding intervals, re-serve techniques the
  learner previously failed). This needs per-user, per-technique mastery state with timestamps
  that outlive a single session/device — a real persistence decision (a DB table, mirroring
  the existing `solve_attempts`-style schema, not just localStorage) and therefore a signed-in-
  only feature, same posture as ranked dailies.
- **Gate:** soundness — a puzzle in mixed-practice mode must be solvable using only
  already-mastered techniques (verify via the capped-tier `HumanSolver.solve()` the generator
  already uses), so a learner is never asked to use a technique they haven't been taught yet.

### L6 — Advanced techniques (fish/wings/chains+coloring) + narrative tie-in

- Extend L1's step-serialization to X-Wing, Swordfish, Y-Wing, XYZ-Wing, W-Wing, ALS-XZ, AIC —
  same mechanism as L1, applied to the remaining strategy functions. Chain/coloring techniques
  need the two-color "mutually exclusive state" overlay variant from L2.
- This tier is the hardest to visualize simply (graph/chain deductions, not single-cell
  patterns) and the lowest-value slice to ship first — deliberately last, and the one most
  likely to get re-scoped once L1–L5 are live and real usage data exists.
- Narrative payoff (recorded earlier in `roadmap.md`'s Phase 7 section, not a mechanic to
  build here): Sudoku Bot as the course's "teacher" — beating its leaderboard time after
  finishing the relevant lesson reads as "the student has become the master." Flavor only.

## 4. Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | Step-recording regresses the generator's hot `solve()` grading path | Opt-in flag, not a default; benchmark gate before/after in L1; the non-recording path's code path is untouched, only new branches added |
| 2 | Content-authoring bottleneck (curated examples + narration per technique) | L3 ships with exactly 2 techniques to validate the loop before writing content for the other 8+ — don't front-load |
| 3 | Scope creep into a full LMS | The staged slices are the scope fence — each ships independently; L1–L3 is a legitimate, demoable stopping point if priorities shift |
| 4 | Reward design triggers the overjustification effect (crowds out intrinsic motivation) | Reward mastery/learning events only, never raw activity or time; informational feedback over tangible rewards; forgiveness mechanics; opt-out of competitive framing — all per the research's §5 findings |
| 5 | New highlight colors clash with or dilute the existing 4-token Biscuit Lab palette, or violate its own "never color-only" rule | L2 is an explicit, gated design decision — not inherited wholesale from SudokuWiki's convention — with a non-color cue mandated per role from the start |
| 6 | Advanced-tier (chain/coloring) visualization is genuinely hard to get right | Deliberately last (L6); ladder value is front-loaded in L3–L5, so shipping stops there is fine if L6 proves too costly |
| 7 | Direct Sudoku-teaching research is thin (research's own caveat) — thresholds/hint costs may be miscalibrated | Treat mastery-gate %, hint-cost, and interleaving-trigger points as tunable; watch for the research's own named warning signs (low mastery-gate pass rates, immediate over-reliance on full-walkthrough hints, poor week-later retention) and retune rather than assuming the first numbers are right |

## 5. Definition of done (v1)

**v1 = L1–L3.** Solver step serialization ships with zero measured regression to existing
benchmarks; a highlight/overlay engine with a deliberately-chosen, non-color-only Biscuit Lab
palette; and Naked Single + Hidden Single fully playable end-to-end (concept → worked demo →
faded practice → independent practice → mastery gate), full test battery green, mirrored docs
synced, roadmap flipped. L4–L6 (skill-tree, mixed practice/spaced review, advanced techniques)
are the follow-on scope, sequenced but not blocking v1's ship.
