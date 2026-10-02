# Skyscrapers — Running Log

> **What this is:** the cross-cutting record for the Skyscrapers feature — **decisions**,
> **research gaps**, **bugs**, **learnings**, and **measurements** — kept alongside the
> [implementation plan](skyscrapers-implementation-plan.md). The plan holds the *spec and
> per-slice step-logs*; this file holds everything that cuts across slices or would otherwise live
> only in a chat transcript. **Newest entries first** in the journal; the tables below are the
> current state and are edited in place (a superseded row is struck through, not deleted).
> **Status:** 🚧 Living (opened 2026-10-01)

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
  convention). Numbering continues from the Kakuro log's spirit, not its numbers — `L#` here is
  Skyscrapers-local.
- **Measurements** — yields, timings, distributions, with the commit they were taken at.

## Journal

- **2026-10-02 (R1)** E5 merged ([#137](https://github.com/zfert99/Puzzle-Generator/pull/137)).
  `[decision]` **D5: the owner chose the 6×6 standard** ("do the recommendation") — the only
  Skyscrapers size with all five rungs; **G11 answered** with it (no new leaderboard framing, the
  size in the label, the "standard = 9×9" copy amended). `[decision]` **D2 applied**: clues ride the
  `cages` jsonb as `StoredSkyscraperClue[]`. **R1 built** on `feature/skyscrapers-r1`: the fifth
  variant in the registry and schema, `SIZES.skyscrapers = { mini: [5], standard: 6 }`, eight
  cell-count profile rows (G6 estimates), the roll a 5-rung bijection — **5 + 3 = 8 boards/day**,
  the daily plan's end state. **The first non-9×9 standard broke four "smaller than 9×9 ⇒ mini"
  rules** (slots route, playing label, continue banner, progress aggregate) — all four now share
  `sectionForKey`. `[measure]` five seeded days through the real engines, no database: 8 rows / 8
  keys each, 0.7–10.5 s per day, Skyscrapers in both sections. `[learning]` L21. `[gap]` G8 still
  owed. Owner's `/code-review high` pending; **Phase 11 complete on merge**.
- **2026-10-02 (E5)** E4 merged ([#136](https://github.com/zfert99/Puzzle-Generator/pull/136)).
  **E5 built** on `feature/skyscrapers-e5`: `skyscrapers.ts` in its final form — every puzzle at
  **exactly** the requested tier (rejection over squares with the generator's `exactTier`),
  per-size tier sets `[decision]` **D12 settled: 5×5 easy / medium / hard · 6×6 all five · 7×7
  medium–extreme**, the batch with the Kakuro budget contract; `/api/puzzle` and `/api/generate`
  refuse a level a size does not offer and serve the request exactly (the V3 fixture cap and
  `selectSkyscrapersBatch` deleted); the `/play` picker reads per-cell tier sets; the print form
  shows the size's tiers; **the hub card is live** (`new!` moved off Kakuro). `[measure]`
  `benchmark-skyscrapers.ts`: 6×6 easy / medium / hard 57 / 32 / 40 ms, expert 201, extreme 52;
  7×7 459 / 297 / 704 / 311 ms (medium–extreme); 5×5 11 / 9 / 43 ms. **Soundness fuzz: 1,500
  generated puzzles, 0 unsound, 0 non-unique, 0 label mismatches.** `[learning]` L20. Owner ran
  `/code-review high`: **7 findings, all fixed in-PR** (table in the plan under E5) — the one with
  weight: the pickers imported the tier table from the entry point, dragging the generator into
  the client bundle (the E2 review's lesson again: the table moved to the types module). R1 (the
  daily) is the last slice.
- **2026-10-02 (E4)** E3b merged ([#135](https://github.com/zfert99/Puzzle-Generator/pull/135)).
  **E4 built** on `feature/skyscrapers-e4`: `skyscrapers-generator.ts` — fill → repair-with-restart
  (intercalate swaps, cap 20, restart after 40 fruitless) → tier-bounded clue removal → exact
  verify → classifier label; `/api/puzzle` serves fresh Skyscrapers at 5/6/7 with the removal
  bounded by the requested tier and an **unbounded fallback** when a size has no square at that
  tier; `usePuzzle`'s fixture short-circuit removed. `[measure]` 100 per (size, level): **0
  failures everywhere**; 6×6 30–50 ms mean, 7×7 400–800 ms mean for medium–extreme; **7×7 easy
  3.5 s mean with 45/60 served by the fallback** — one 7×7 square in fifty has an easy floor.
  Unbounded medians 6 / 20 / 221 ms; `unrated` 3 / 3 / 11%. `[gap]` the 7×7 easy question is
  E5's per-size tier set (L19). `[learning]` L19. Owner ran `/code-review high`: **9 findings,
  all fixed in-PR** (table in the plan under E4) — the one with weight: the serving policy sat in
  the route; it moved to `skyscrapers.ts` (`generateSkyscrapers`, the `generateKakuro`
  counterpart) where E5 and R1 will call it. Also: the fallback path gained a test; a restart cap
  bounds a climb that never swaps; the redundant final verify and the duplicated label mapping
  went.
- **2026-10-02 (E3b)** E3 merged ([#134](https://github.com/zfert99/Puzzle-Generator/pull/134));
  **the owner approved the re-tier recommendation** ("I will follow your recommendations").
  **E3b built** on `feature/skyscrapers-e3b-retier`: the per-line arrangement scan is three
  techniques graded by how many arrangements it considered — `lineScan` (≤ 3, tier 1),
  `lineEnumeration` (≤ 12, tier 2), `lineFilter` (beyond, tier 3) — computed once per candidate
  state and cached; the hint says how many arrangements fit. `[decision]` D6 amended (Easy
  includes the small scan, Medium the enumeration). The 5×5 fixture relabels **hard → easy**.
  `[measure]` re-running E3's scripts: 6×6 all-clue floor **T1 74 · T2 183 · T3 6 · T4 7 · T5 28
  of 300** (was 1 / 1 / 273); tier-bounded yields 6×6 **28 / 85 / 58 / 15 / 53%**, 5×5
  **90 / 55 / 8 / 8 / 20%** — every tier reachable at both sizes; **easy 7×7 does not exist**
  (0/40) and **hard is the scarce 5×5 tier** (8%) — size properties for E5's per-size tier sets,
  not ladder defects. `[learning]` L18. Owner ran `/code-review high`: **9 findings, all fixed
  in-PR** (table in the plan under E3b) — the one with weight: the scan cache rescanned every
  line on every candidate change; per-line dirty scans with a single candidate write path made
  classify **faster than before the re-tier** (5.1 ms at 6×6 vs 6.7 flat, 9.2 with the first
  cache). E4 unblocked.
- **2026-10-02 (E3)** E2 merged ([#133](https://github.com/zfert99/Puzzle-Generator/pull/133)).
  **E3 measured** on `feature/skyscrapers-e3` — throwaway scripts, findings in
  [research/skyscrapers-feasibility-findings.md](research/skyscrapers-feasibility-findings.md).
  `[decision]` **D4 settled: 5 / 6 / 7** — 9×9 repair 0/8 in 60 s and 130–470 ms per classify,
  out as a live size; 4×4 has no expert tier. `[decision]` **D12 settled conditionally: easy /
  medium / hard at 5×5.** `[measure]` repair 0.1 / 0.2 / 3.6 ms median at 4–6; the plain 7×7
  climb fails half its attempts (24/50) but **restart after 40 fruitless swaps + cap 20 →
  30/30 in 178 ms median**; ~half the clues survive random removal (4/16 · 7/20 · 11/24 ·
  14/28), the minimum hitting **N − 1 at 4×4 and 5×5** (G5); tier-bounded yields at 6×6
  **0 / 0 / 85 / 10 / 73%** (T1–T5). `[roadblock]` **easy and medium do not exist under the E2
  tiering**: with *every* clue present 273/300 random unique 6×6 squares already need tier 3
  (`lineFilter`), and removal only moves a puzzle up — so the floor is the yield (0.3% / 0.7%
  at 6×6, 1% / 11% at 5×5). The line-filter steps those squares need mostly scan 1–6 surviving
  arrangements — the beginner's move in every published ladder. **Recommendation: tier
  `lineFilter` by scan size (≤ 3 easy, 4–12 medium, > 12 hard) before E4** (§3c); expert/extreme
  pass the gate (10% / 73%), so the re-slice is the bottom of the ladder only. `[gap]` G3 and G5
  answered, G7 partly (expert is the *scarce* tier, 0–15%; extreme abundant), G12 answered.
  `[learning]` L15–L17. **Waiting on the owner's call on the re-tier before E4** (roadblock
  rule).
- **2026-10-02 (E2)** E1 merged ([#132](https://github.com/zfert99/Puzzle-Generator/pull/132)).
  **E2 built** on `feature/skyscrapers-e2`: the logical solver (`skyscrapers-logical-solver.ts`,
  14 named techniques in five tiers, forcing chains as the top rung, never a guess) with
  `classifySkyscrapers` / `measureSkyscrapers` / `explainSkyscrapersHint`, and the two-factor
  scorer (`skyscrapers-score.ts`). The fixtures are relabelled by the classifier at import —
  **5×5 hard, 6×6 extreme, 7×7 extreme** — the Hint button names its technique, the dev badge
  shows the grade, score, histogram and metrics. `[measure]` classify 0.42 / 6.7 / 6.3 ms at
  5 / 6 / 7 against the 20 ms gate (after the review's precomputation; 0.47 / 7.4 / 7.0 before);
  soundness fuzz clean. `[gap]` G7 gets its first histograms:
  T3 needed at 5×5, T5 at 6×6 and 7×7, **T4 (`xWing`) needed by none** — and `facingSum`,
  `reachability`, the subsets and the X-wing fired on no fixture at all, so the plan's
  "every T1–T4 technique fires on a fixture" gate is met by hand-built unit cases, not by the
  fixtures; the corpora of E3/E4 own the coverage claim. `[divergence]` forcing chains widened
  from bivalue to 2–3 candidates — bivalue alone left the 6×6 `'unrated'` (L12). `[learning]`
  L13 (grade by human technique, not by the propagator), L14 (fix the selected-cell rule in
  the explainer, not the deducer). Owner ran `/code-review high`: **10 findings, all fixed
  in-PR** (table in the plan under E2) — the two with weight: the fixtures were graded *at
  import* inside the client bundle (~30 ms on every `/play` load; typed labels + a re-grading
  test now), and the selected-cell hint rule was a deducer special case on top of an explainer
  that confined only the Latin singles to the selected cell (every placer is confined now, so the
  selection is hinted by name). Also: a repeated height was not a contradiction from the start;
  a 9×9-unsafe loop guard; per-call line/house allocation; three private line-indexing copies
  folded into `lineCells` in the types module.
- **2026-10-02 (E1)** V3 merged ([#131](https://github.com/zfert99/Puzzle-Generator/pull/131)).
  **E1 built** on `feature/skyscrapers-e1`: the per-size permutation table (`skyscrapers-visibility.ts`)
  and the line-filter exact solver (`skyscrapers-solver.ts`, the Kakuro contract); the Hint
  button deduces; a dev badge reads "unique ✓ · n nodes". `[measure]` verify 0.07 / 0.40 / 1.1 ms
  at 5 / 6 / 7 — the 50 ms gate by 45×; propagation alone solves the 5-clue 5×5. **Every fixture
  is now proven unique in-repo**, the 4×4 pair proven non-unique, the 204/576 ambiguity and the
  G5 4×4 facts reproduced as tests (L3 closed). `[learning]` L10. Owner ran `/code-review high`:
  **6 findings, all fixed in-PR** (table in the plan under E1) — the one with teeth: an
  out-of-range clue indexed past the bucket table; copy-on-narrow measured at ~5% per node, the
  two-closure first draft at −40% (L11); the hint deducers left the store for a registry.
- **2026-10-02 (V3)** V2 merged ([#130](https://github.com/zfert99/Puzzle-Generator/pull/130))
  on the owner's visual verdict. **V3 built** on `feature/skyscrapers-v3`: `drawSkyscrapersGrid` +
  `generateSkyscrapersPDF` on the shared nav helpers (G9's print numbers applied: clue digits
  half the solved digit, one tone lighter, frame 5× the rule, no arrows); a Zod'd `/api/generate`
  branch printing exactly one fixture per request (sizes 5/6/7); the print form's fifth toggle
  with no difficulty counts until E5; `Docs/samples/skyscrapers-sample.pdf`. Owner's look at the
  booklet pending (the slice's gate). Owner ran `/code-review high`: **5 findings, all fixed
  in-PR** (table in the plan under V3) — the renderer now iterates the engine's display cells
  instead of mapping sides itself; `[learning]` L9.
- **2026-10-02 (V2)** V1 merged ([#129](https://github.com/zfert99/Puzzle-Generator/pull/129)).
  **V2 built** on `feature/skyscrapers-v2`: playable at `/play?variant=skyscrapers` on the baked
  fixtures — four-sided gutter on the real board, `edgeClues` persisted / `doneClues` undo-able
  (D9's manual mark), clue verdicts by the **prefix rule** in per-clue selectors, `C`-key gutter
  navigation, fifth menu toggle with 5/6/7, rules body; the V0/V1 workbench deleted. `[decision]`
  D9 applied as specified (satisfied tint off by default, a no-op class as the opt-in hook).
  Owner's visual verdict pending (the slice's gate); `[gap]` G8's screen-reader pass still owed.
  Owner ran `/code-review high`: **7 findings, 6 fixed in-PR** (table in the plan under V2; the
  slice-size overrun is the owner's call) — the one with teeth: a mouse click on a clue stole
  focus and swallowed every digit typed after it. `[learning]` L8.
- **2026-10-02 (V1)** V0 merged ([#128](https://github.com/zfert99/Puzzle-Generator/pull/128)) on
  the owner's visual verdict. **V1 built** on `feature/skyscrapers-v1`: the puzzle shapes, config,
  `visibleCount` / `deriveClues` / validator, three baked fixtures (5×5 5/20 clues, 6×6 15/24,
  7×7 14/28) plus the 4×4 non-unique pair, clue digits on the board, 33 tests. `[measure]` **the
  slice's real output: a random Latin square with all 4N clues is unique ≈ 50% of the time at
  5×5, ≈ 7% at 6×6 and 0 times in 94,962 at 7×7** — G4 answered early, in the direction the
  research feared; `[decision]` E4 amended from "reject the square" to **repair by intercalate
  swaps** (unique 7×7 in 38 steps / 192 ms); E3 (a) now measures the repair, not P(unique).
  `[learning]` L6, L7. Owner ran `/code-review high` on the branch: **6 findings, all fixed
  in-PR** (table in the plan under V1) — the one with teeth was the fixture parser casting its
  row count to `GridSize`; `isGridSize` now exists in `sudoku.ts` and `isLatinSquare` moved to
  `grid-utils.ts` for every engine.
- **2026-10-01 (V0)** Plan PR merged ([#127](https://github.com/zfert99/Puzzle-Generator/pull/127)).
  `[decision]` **D4 planned at the recommendation** by the owner ("plan for recommended but still
  measure"): V0–V2 build and show 5×5 / 6×6 / 7×7; E3 keeps the power to overturn any of the
  three. **V0 built** on `feature/skyscrapers-v0`: `/skyscrapers` workbench route showing the
  three sizes side by side, `SkyscrapersBoard` static Server Component with the four-sided gutter,
  framed play area, ARIA grid skeleton and direction-naming gutter labels (D9); 6 tests. Owner's
  visual verdict pending (the slice's gate). `[learning]` the gap-as-line trick does not transfer
  (lines belong on the play cells; the gutter is open space) — recorded in the plan's V0 step-log.
  Owner ran `/code-review high` on the branch: **6 findings, all fixed in-PR** (table in the plan
  under V0) — the one with teeth was `aria-hidden` corners making the ARIA grid non-rectangular;
  `[learning]` L5. The display helpers now start in the engine (`skyscrapers-types.ts`), per L2.
- **2026-10-01 (gaps research)** [research/skyscrapers-research-gaps-findings.md](research/skyscrapers-research-gaps-findings.md)
  received — three web streams (trademark registers, complexity papers, print + clue-UX
  conventions) plus one exact in-session measurement. `[gap]` **G1 resolved**: US and Japan clear,
  but a **live EU/UK "SKYSCRAPER" mark** (Inspired Gaming, cl. 9 "games software", exp. 2027) →
  `[decision]` **D1 amended**: "Towers" becomes a wired one-constant fallback title. **G2
  resolved** (ASP open for clue-only, ASP-complete with givens via Latin-square completion;
  irrelevant at N ≤ 9). **G5 narrowed**: minimum clues conjectured N−1 (Nakamura 2016, verified to
  N = 8); `[measure]` exact at 4×4 — 3 clues suffice, 2 never. **G9 resolved** (Krazydad: clue
  digit = ½ the solved digit, one tone lighter, 5 pt frame over 1 pt rules). **G10 resolved**:
  nobody auto-tints a satisfied clue; Tatham flags **prefix-provable** violations immediately →
  `[decision]` **D9 amended** to the prefix rule. `[learning]` L4 (a stale mirror produced a wrong
  claim in the research doc — corrected). G3/G4/G7/G12 stay with E3, G6 with telemetry, G8 with
  the AT pass, G11 with the owner.
- **2026-10-01 (plan)** Research doc [skyscrapers.md](research/skyscrapers.md) written (four-stream
  deep research; its 4×4 / 5×5 all-clue ambiguity counts replicated in-session — `[measure]`
  below). Plan + this log opened; roadmap **Phase 11**, README row, Docs index. `[decision]` D1,
  D2, D3, D6, D7, D9, D12 proposed from the research; D4 (sizes) **open — owner**, with 5/6/7
  recommended and E3 named as the settling measurement; D5 (first non-9×9 daily standard)
  proposed; D8, D11 inherited from Kakuro (owner rules); D10 applied. `[gap]` G1–G12 opened from
  the research's gaps table. `[learning]` L1–L3 seeded. Owner picked Skyscrapers as the fifth
  type earlier the same day ("i think we decided skyscraper").

## Decisions

| # | Decision | Rationale | Status |
|---|---|---|---|
| D1 | Display name **Skyscrapers**, subtitle **Towers**, engine/slug **`skyscrapers`**; the title is **one constant** with **"Towers" wired as the fallback title** (the Kakuro / "Cross Sums" pattern); no publisher affiliation implied anywhere. The *technique* name "Skyscraper" (Sudoku single-digit pattern, HoDoKu) is **reserved**: if the HumanSolver ever gains it, it is named "Skyscraper (fish)" or namespaced, never the bare word | Research §1: invented 1992 by Masanori Natsuhara (Sekai Bunka-sha's *Puzzler*), not Nikoli; every publisher uses the bare generic name; the only U.S. filing found (1997, a 3D game) was abandoned in 1998. "Towers" is Tatham's name and a ready alias. Live registers were not queried (G1). `STRATEGY_NAMES` in `deductions.ts` has no Skyscraper today, so the label is free | **Locked 2026-10-01** (G1 resolved — US/JP clear; EU/UK has a live singular "SKYSCRAPER" games-software mark, Inspired Gaming, exp. 2027-10-12, flagged not-to-be-renewed — the switch trigger). Professional read before any EU logo / paid use; not legal advice |
| D2 | **Interior N×N `grid` + `solution`**, plus **`clues: { top, bottom, left, right }`** — four length-N arrays, **0 = blank**. Display is (N+2)×(N+2) with a four-sided gutter (the Kakuro gutter generalised from top+left). Daily storage: **clues ride the existing `cages` jsonb** as `StoredSkyscraperClue { side, index, count }[]`, with `variant` gating every reader — the Keisan/Kakuro rule (L2 there). Alternative recorded: a nullable `clues` jsonb column (additive migration, read as the cleaner model) | Keeps `grid.length === N` everywhere the codebase keys on it (`DailySize`, `PROFILE`, board `config.size`). The jsonb column is already a `variant`-discriminated grab-bag (Killer cages, Keisan cages, Kakuro runs) and reusing it has worked twice with no migration; the cost is a misnamed column holding edge clues. The column alternative costs one additive migration and buys honesty — the owner's call | **Applied by R1 2026-10-02** — clues ride `cages` as `StoredSkyscraperClue[]` (one per present clue), restored to the four gutter arrays by `/api/daily`; no migration |
| D3 | **No givens at any published tier.** `grid` keeps the slot (all zeros) so Tatham-style fixtures and any future "givens" lever round-trip; the generator never emits givens in v1 | Research §1: interior givens are permitted by Tatham and "rarely, thematically" by GM Puzzles but are not the commercial daily norm; the research's generator pipeline removes *clues*, not cells | Proposed 2026-10-01 (research) |
| D4 | **Three sizes, chosen for Skyscrapers (D11):** mini **5×5** (alternative 4×4), standard **6×6**, large **7×7** (alternative 9×9). **Settled by E3's measurement**, not by inheritance: tier reachability at guess count 0 and per-tier yield at 4/5/6/7/9; line-filter + uniqueness wall time at 7 vs 9. 4×4 may survive as a tutorial board, 9×9 as a weekly special | Research §5: 6×6 is in every catalogue and the only size Tatham gives the full ladder; 4×4 degenerates above Easy (Tatham ships only 4×4 Easy, Puzzle Baron skips it); 5×5 is the real entry point and has an attested Hard; 7×7 is Conceptis's capstone with 5,040-permutation lines; 9×9 is a weekly special everywhere, 362,880 permutations, Tatham's performance warning. Board footprint: 7×7 + gutter = 9 tracks (a 9×9 Sudoku's), 9×9 + gutter = 11 (new phone-width risk) | **Planned by owner 2026-10-01** at the recommendation (5/6/7); **settled by E3 2026-10-02 — 5 / 6 / 7 confirmed**: 9×9 fails repair (0/8 in 60 s) and timing (60–100 ms per count, 130–470 ms per classify); 4×4 has no expert tier (0/40 X-wings) and its hard is a 24-arrangement scan ([findings §3b](research/skyscrapers-feasibility-findings.md)) |
| D5 | **The first non-9×9 daily standard.** With a 6×6 standard, `DailySize` widens (5, and 6 as a standard), the standard roll becomes a **5-rung bijection** at 5 types, `slotLabel` shows the size where it is not 9×9, and the "standard = 9×9" copy in the daily plan / roadmap / UI is amended | D4 + D11: a per-type standard size was the rule's intent; Kakuro happened to keep 9. `isEligible` already keys on `SIZES[variant].standard`, so the mechanism exists; the copy and the labels do not | **Owner's call 2026-10-02 — option 1, the 6×6 standard** (the only Skyscrapers size with all five rungs; mini-only and a 7×7-minus-easy standard were the alternatives put to the owner). Applied by R1 |
| D6 | **Every published tier is logic-only.** Easy = rungs 0–4 (clue N / clue 1, facing sum, position bound, nearly-filled clue, Latin singles) **+ the small line scan (≤ 3 arrangements fit — E3b, 2026-10-02)** · Medium = + rung 5 (clue-2 patterns, reachability) **+ the one-line enumeration (≤ 12)** · Hard = + rungs 6–7 (the long per-line filter, Latin pairs/triples) · Expert = + rung 8 (fish on rows × columns, two-line clue interactions) · Extreme = + rung 9 (bounded forcing chains over 2–3 candidates). **Rung 10 (bifurcation) is a reject, never a tier.** Guess count 0; copy says "solvable by logic alone" | Research §2–§3: only Tatham ships a guessing tier ("Unreasonable"); GM Puzzles, Brainbashers, Puzzle Baron, puzzlemix all say "no guessing"; Tatham's own Easy/Hard/Extreme map onto rungs 0–4 / 6–7 / 8–9. The 5–7 ordering is the research's proposal (G7) | Proposed 2026-10-01 (research); tier cuts calibrated in E5 — **amended by E3b 2026-10-02** (the flat tier-3 scan made 91% of all-clue 6×6 squares hard; [findings §3c](research/skyscrapers-feasibility-findings.md)) |
| D7 | Difficulty label assigned by the **classifier post-generation**; the generator's clue-removal order and target only *bias* | Research §3 (krnsk0: random valid puzzles need backtracking, published ones fall to propagation); Kakuro D8 precedent | Locked 2026-10-01 |
| D8 | **Visual first, simplest → hardest** (Kakuro D12): V0 looks-only board → V1 types + fixtures → V2 board → V3 PDF → E1 exact solver (Hint) → E2 classifier (badge, technique hints) → E3 yield spike → E4 generator → E5 tiers + pickers + hub card → R1 daily. Deep link from V2; hub card at E5; the owner may reorder (Kakuro pulled E1 ahead of V3) | Owner rule, 2026-09-11 (Kakuro), amended 2026-09-30 with V0 — inherited unchanged | Locked (inherited) |
| D9 | **Clue UX + a11y:** four-sided gutter of plain digits (no arrows); a clue turns the error colour as soon as its violation is **provable from the filled prefix** (Tatham's `check_errors` rule — count already over the clue, tallest seen with the count short, or count reached before the tallest; O(N), zero false positives), *not* only on a complete line; "satisfied" is an opt-in muted state (off by default — none of five players auto-tints); a manual **"mark clue done"** toggle ships in V2 (click / Enter on the clue), **undo-able and persisted** with the board, drawn **error > done > normal**; a "which towers this clue sees" highlight on focus is a later teaching aid. WAI-ARIA grid of (N+2)×(N+2): gutter cells `role="gridcell"` + `aria-readonly` with names spelling direction and state ("Clue 3, looking down from the top of column 2, open"); corners hidden; play-cell names carry the two clues that look at them; roving tabindex over play cells with a "jump to clues" key; `aria-invalid` on cells of a violated line; visible keyboard instructions | Research §6: Tatham draws no satisfied colour at all and errors only on complete lines; Brainbashers' click-to-grey "dealt with" is well liked and doubles as a progress tracker for AT users; Conceptis's auto-check is opt-in. **No accessible Skyscrapers implementation exists** — the pattern is Sudoku-derived (dokuel PR #192) and must be AT-tested (G8) | Proposed 2026-10-01 (research); **amended 2026-10-01 by G10** (prefix rule, draw priority, persisted toggle) |
| D10 | Roadmap **Phase 11**, engine-first like Phases 6 / 8 / 10 | Matches the sibling phases | Applied 2026-10-01 (this PR) |
| D11 | **Sizes are per puzzle type** — the smallest size that is genuinely interesting for *this* puzzle, its standard, and a large; "mini" in menus and the daily means "this type's smallest size" | Owner, 2026-09-11 (Kakuro log D11). Skyscrapers is the second type built under it; D4 is its application | Locked (inherited) |
| D12 | **Mini tiers:** the mini ships easy/medium/hard only if E3/E5 prove Hard separable from Medium at the chosen mini size at guess count 0; otherwise fewer tiers (Killer-4×4-easy-only precedent). Eligibility follows measurement | Research §5: Tatham ships 5×5 Hard but only 4×4 Easy; Puzzle Baron restricts 5×5 to Easy/Medium; only gridpuzzle claims five tiers at 4×4, where Hard would be "fewer clues", not deeper logic | Proposed 2026-10-01; conditionally settled by E3 2026-10-02; **settled by E5 2026-10-02 — 5×5 easy / medium / hard, 6×6 all five, 7×7 medium–extreme** (`SKYSCRAPERS_TIERS_BY_SIZE`; the 7×7 easy floor is one square in fifty, E4 — not a tier to promise) |

## Gaps — research questions

| # | Question | What would resolve it | Blocks / degrades | Status |
|---|---|---|---|---|
| G1 | **Trademark clearance** for "Skyscrapers" / "Towers" as a puzzle-type label — live USPTO TSDR, EUIPO eSearch and J-PlatPat were **not** directly queried; the one U.S. record (abandoned 1997 "SKYSCRAPER" game filing) came from a search snippet (Justia 403) | ~~A direct register check~~ **Answered** ([findings §G1](research/skyscrapers-research-gaps-findings.md)): USPTO TSDR, TMview (US/EM/GB/JP/WO) and EUIPO JSON queried — US clear (the 1997 filing died 1998-03-19), Japan clear (Konami SKYSCRAPER and oneA TOWERS expired), **EU/UK has a live singular "SKYSCRAPER" mark** (Inspired Gaming, cl. 9/28/41/42, "games software", exp. 2027-10-12, flagged not-to-be-renewed); no "SKYSCRAPERS" or live bare "TOWERS" mark anywhere relevant | D1 locked with "Towers" as the wired fallback | ✅ Resolved 2026-10-01 (strong on records; a professional read still owed before EU logo / paid use) |
| G2 | Is finding-another-solution **ASP-complete** for Skyscrapers? Iwamoto & Matsui's NP-completeness reduction (2016) would need checking for parsimony; no result exists | **Answered** ([findings §G2](research/skyscrapers-research-gaps-findings.md)): both NP-completeness proofs use givens; Haraguchi–Tanaka's reduction is solution-bijective but from NAE-SAT (trivial ASP), so no ASP result; **with givens the puzzle is ASP-complete** via Latin-square completion (Colbourn–Colbourn–Stinson 1984); **clue-only ASP and #P are open**. Iwamoto–Matsui full text unobtainable | Nothing — count to 2, as Sudoku/Kakuro do | ✅ Resolved 2026-10-01 (open in theory, closed in practice) |
| G3 | **Per-tier generation yield** and **clue survival**: no source publishes how many of the 4N clues survive uniqueness-preserving removal per size, nor the fraction of attempts that land at each tier; Tatham's retry loop is unbounded; the research's own greedy-removal run did not complete | E3's spike ((b) clue survival, (c) tier reachability over ≥ 200 fills per N), then E4/E5 production logging | E3 (designs the generator's budget), E5 (bands) | ✅ Answered by E3 2026-10-02 ([findings §2b/§2c/§3f](research/skyscrapers-feasibility-findings.md)): ~half the clues survive random removal (median 4/16 · 7/20 · 11/24 · 14/28); kept count is **not** the tier lever (hard and extreme accept at the same median); per-tier yields in §2c with the ladder caveat of §3c; E4 logs production numbers |
| G4 | **All-clue ambiguity at N ≥ 6.** Measured exactly at 4×4 (35.42%) and 5×5 (57.61%); 6×6 has 812,851,200 Latin squares so sampling is required; the trend above 5 is unknown | **Answered early by V1 (2026-10-02):** with the line-filter counter, unique with all clues in **2 of 2 tries at 5×5, 1 of 15 at 6×6, 0 of 94,962 at 7×7** (random backtracking fills; each count 1–3 ms). Reject-the-square is dead above 6×6; **repair by intercalate swaps** reached a unique 7×7 in 38 steps / 192 ms. E3 quantifies the repair per N (and samples 9×9) rather than P(unique) | E4 amended to repair; E3 (a) re-pointed | ✅ Resolved 2026-10-02 (repair cost per N still to measure in E3) |
| G5 | **Minimum clue count** for uniqueness per N (no givens). A circulating "1 clue can suffice" snippet is unsourced and internally inconsistent (a single clue cannot determine a Latin square for N ≥ 3) | **Narrowed** ([findings §G5](research/skyscrapers-research-gaps-findings.md)): Nakamura 2016 conjectures **exactly N−1** (≤ N−1 proven by construction; not ≤ N−2 verified to N = 8, slides only); measured exactly here at 4×4 — **3 clues suffice, no 2-clue subset determines any square**; 208/142/22 squares need 3/4/5, 204 undetermined by all 16. E3 (e) records the minimum *surviving* count per size against N−1 | E5 Extreme bias (floor ≈ N−1 kept clues) | 🟡 Narrowed 2026-10-01; **E3 measured 2026-10-02:** random uniqueness-preserving removal reached **N − 1 at 4×4 (3) and 5×5 (4)** within 200 tries, N + 1 at 6×6 (7) and 7×7 (11) — consistent with Nakamura; a floor of the best square, not proven at 6/7 |
| G6 | **Human solve-time baselines** per size × tier for `PROFILE` floors and bot times. Public data: GM Puzzles' per-puzzle standards (very hard 6×6: 9:00 / 18:00 / 36:00 GM / Master / Expert), puzzle-skyscrapers.com hall-of-fame fastest small Easy grids ≈ 3.4–4.5 s; no population distributions anywhere | Rule adopted from Kakuro G2: floors from **cell count**, well below record pace (mini ≈ 2 s or cadence-based); tune from own telemetry after R1 | R1 floors (estimates, flagged in JSDoc) | 🟡 Resolved as a rule; numbers pending telemetry |
| G7 | **Rung ordering 5–7** (clue-2 patterns vs per-line permutation filtering vs Latin subsets) is the research's proposal; no published ladder exists beyond Conceptis's basic/advanced grouping and Tatham's four tiers. Also: how often fish / chains are *needed* in a 6×6 Hard–Extreme corpus is unmeasured — are Expert and Extreme reachable at 6×6? | E2's technique histograms on E3/E4 corpora; E5's gate that T4 and T5 are populated at the standard size. **First data (E2, three fixtures):** 5×5 tops out at T3 (`lineFilter×3`); 6×6 and 7×7 need T5 (`forcingChain×4` / `×2`, trivalue trials); **T4 `xWing` was needed by none**, and `facingSum`, `reachability`, `nakedSubset`, `hiddenSubset` fired on none — the ladder order above T3 is untested by real puzzles until E3's corpus | D6 tier cuts; D4 (whether 6×6 can be the standard) | 🟡 **E3's corpus answers the T4 question: expert (X-wing) is the scarce tier at every size — 0% at 4×4, 10–15% at 5–7 — while extreme is 23–73%**; and the ladder's *bottom* is miscalibrated (flat tier-3 line filtering makes 91% of all-clue 6×6 squares "hard") — re-tier by scan size proposed ([findings §3c/§3d](research/skyscrapers-feasibility-findings.md)); E5 fits the cuts |
| G8 | **Screen-reader behaviour** of a four-sided read-only gutter — no accessible Skyscrapers exists; the ARIA grid pattern is Sudoku-derived (dokuel PR #192, Higley, Roselli) | An NVDA / JAWS / VoiceOver pass over V2's board; adjust the clue naming and the "jump to clues" key from what is heard | V2 (degraded), R1 (launch gate) | Open — owed by R1 |
| G9 | **Print specs** — no publisher documents gutter spacing or border weights numerically; the Krazydad PDF was not rendered during research | **Answered** ([findings §G9](research/skyscrapers-research-gaps-findings.md)): Krazydad measured — clue digit **0.33 × cell = ½ the solved digit**, bold, one tone lighter (#444), ~0.2 cell clear of a **5 pt frame over 1 pt grey rules**, no arrows, one puzzle per A4 page, answers 3 × 4 without clues; championship booklets: same font as digits, ~0.5 cell standoff, frame 3.75–6.7× the inner rule, no arrows | V3 spec updated | ✅ Resolved 2026-10-01 |
| G10 | Should **satisfied clues auto-tint**? Conceptis/Brainbashers players were not inspected in detail; Tatham never does it | **Answered** ([findings §G10](research/skyscrapers-research-gaps-findings.md)): none of Tatham, Brainbashers, puzzle-skyscrapers.com, Conceptis, gridpuzzle auto-tints a satisfied clue; three have a manual click-to-grey "done" (Tatham's is undo-able with `COL_DONE`); violations are flagged on a full line (puzzle-skyscrapers) or **immediately when prefix-provable** (Tatham) | D9 amended | ✅ Resolved 2026-10-01 |
| G11 | **The first non-9×9 daily standard** (D5): does a 6×6 standard slot need its own copy, label, leaderboard framing, or bot-time model? Does "standard" still mean anything when sizes are per type? | Owner's design call before R1; grep every "9×9" in daily copy | R1 | ✅ Answered by the owner 2026-10-02 (D5): a 6×6 standard slot needs **no** new leaderboard framing (bests are already `(key, variant, size)`-scoped) and no new copy beyond the size in its label (`slotLabel` shows the size for any non-9×9 board) and the "standard = 9×9" sentences; "standard" means "the type's own standard size on the full ladder". Bot times from cell count, flagged as estimates |
| G12 | **Mini tier separability** at the chosen mini size (5×5 Hard attested by Tatham; 4×4 not) — and whether the mini should carry three tiers at all | E3 (c) per-tier yield with distinct hardest-rung signatures at guess count 0 | D4, D12, R1 eligibility | ✅ Answered by E3 2026-10-02: 5×5 carries easy / medium / hard at guess count 0 with distinct hardest-rung signatures (T1 / T2 / T3; extreme 38%); 4×4's hard is a 24-arrangement scan and it has no expert — tutorial board at most ([findings §3e](research/skyscrapers-feasibility-findings.md)) |

## Bugs

| # | Found | Slice | Symptom | Cause | Fix |
|---|---|---|---|---|---|
| — | — | — | none yet | — | — |

## Learnings

| # | Rule | Came from |
|---|---|---|
| L21 | **A convention that held by coincidence lives in more places than the one that defines it.** "A standard is 9×9" was never a rule — `isEligible` read `SIZES[variant].standard` — but four surfaces filed boards by "smaller than 9×9 ⇒ mini" because it had always been true. The first 6×6 standard (D5) had to be found by grepping for the size, not by the type-checker; the fix is one named rule (`sectionForKey`) that every filer calls, with the SQL copy beside it. When a plan says "the mechanism already supports X", grep for the *consequences* of not-X before believing it | R1, 2026-10-02 |
| L20 | **When the target is a step function of the search state, reject and redraw — do not build a walk with nothing to climb.** Kakuro's E5 walked a fill toward its tier because its objective had a gradient; a Skyscrapers puzzle's tier is decided by which clues are blank, a step function of the square and the removal order. E4's per-round exact-hit rates (6–100% by cell) made rejection over fresh squares cheap at every offered cell (≤ 0.7 s averages); measure the hit rate before designing an optimiser | E5, 2026-10-02 |
| L19 | **A request a size cannot honour is a tier-set decision, not a generator bug — and the route should degrade honestly while the decision is open.** 7×7 has an easy all-clue floor one square in fifty, so a bounded generator either burns its budget or fails; E4 gives up after 12 floor misses and serves an unbounded puzzle with its real label and a `fallback` log field, instead of a 500. Which tiers a size offers is E5's per-size call (the mini sizes already lock expert/extreme elsewhere); measure the floor rate per size before promising a tier there | E4, 2026-10-02 |
| L18 | **A re-tier moves the scarcity, it does not remove it — re-measure every tier at every size after the change.** Grading the line scan by size made easy/medium 6×6 exist (0% → 28 / 85%) and, in the same stroke, made hard the rare 5×5 tier (100% → 8%) and showed easy 7×7 does not exist (0/40). Neither is wrong — a 5-cell line rarely needs a 12-arrangement scan, a 7-cell line rarely keeps 3 — but each is a per-size tier-set decision E5 has to make with numbers, which only a full re-run produces | E3b, 2026-10-02 |
| L17 | **For removal-based generation, measure the all-clue floor before measuring removal.** Clue removal only moves a puzzle *up* the ladder, so the tier a square needs with every clue present is the ceiling of what removal can yield at or below it. E3's first pass measured 40 tier-bounded attempts per tier and saw 0% easy at 6×6 without knowing why; one 300-square floor histogram explained it in a minute. The floor is the first number a yield spike should produce | E3, 2026-10-02 |
| L16 | **When a climb's objective sits at its cap, restart — do not climb longer.** A random 7×7 has ≥ 60 all-clue solutions, so the capped count was flat ("60 → 60") and the intercalate climb wandered: 24/50 converged in 20 s. A fresh square after 40 fruitless swaps, with the cap lowered to 20, converged 30/30 in a median 178 ms. The cap exists to give the climb a gradient; a square that starts above it has none, and a restart is cheaper than any number of flat steps | E3, 2026-10-02 |
| L15 | **A flat tier for a catch-all technique makes every puzzle that tier.** `lineFilter` (any per-line arrangement scan) sat at tier 3, so 91% of all-clue unique 6×6 squares graded hard and easy/medium could not be generated at all — yet a third of the scans those squares need cover exactly one arrangement, which is the beginner's clue-reading. Grade a catch-all by the size of the work it did (arrangements scanned), not by its name; the fixtures could not have shown this because three puzzles are not a distribution | E3, 2026-10-02 |
| L14 | **When a shared mechanism cannot express a variant's need, extend the mechanism — do not patch the caller.** Skyscrapers' ladder opens with placement rules that pick their own cell, so the explainer's Kakuro-shaped "singles only for the preferred cell" rule almost never hinted the selected cell, and the first draft patched the *deducer* with an exact-solver fallback for it. The review's altitude finding moved the fix down: `step()` takes a `target` that confines **every** placing technique, the selection is hinted by name, and the two deducers are the same shape again. Test both orders (selected cell placed by name; the ladder's placement elsewhere when nothing can place the selection) | E2 review, 2026-10-02 |
| L13 | **Grade by the human technique, not by what the propagator can do.** E1's line filter at fixpoint placed all 25 cells of the 5-clue 5×5 from empty; the classifier grades the same puzzle **hard**, because per-line filtering is a tier-3 move for a person. A solver's ease is not a player's — the research's SAT-metric warning — so the grade is the hardest named rung with the cheap rungs always tried first, and a fixture "solved by propagation" is evidence about the propagator, not the puzzle | E2, 2026-10-02 |
| L12 | **A trial-based top rung's candidate bound is a lever to measure, not a constant to inherit.** Tatham's forcing step is bivalue; with bivalue cells only, the ladder left the 6×6 fixture `'unrated'` — its bottleneck cells had three candidates. Widening to 2–3 candidates (fewest first) finished it in four chains and kept the no-guessing rule (a value is removed only when its supposition is proved impossible). When a hand-baked puzzle stalls at the top rung, check the bound before concluding the puzzle needs bifurcation | E2, 2026-10-02 |
| L1 | **Reuse a Latin technique only after checking the house property it rests on — and write the answer down.** Kakuro needed a `required` guard because a run need not contain every digit; Skyscrapers rows and columns are full permutations, so hidden singles / pairs / fish are sound unchanged. E2 asserts this in a test so the question is answered on record rather than re-asked per technique | Plan authoring, 2026-10-01 (Kakuro L12 applied in reverse) |
| L2 | **Put display-coordinate helpers in the engine's types module from day one when two consumers are already in the plan.** Kakuro's clue picture lived in board code until the PDF became a second consumer and had to move (its V3 step-log); Skyscrapers' gutter indexing has the board *and* the PDF as known consumers before V0 | Kakuro V3 step-log, applied 2026-10-01 |
| L11 | **Measure a hot-loop "optimisation" before believing it, and keep closures out of the loop.** The first copy-on-narrow draft split `filterLine` into two small closures for readability and ran 40% slower per node than the code it replaced; the single-pass rewrite without closures recovered it and won ~5%. A best-of-N benchmark on a sparse instance, run before and after via `git stash`, is cheap and settles it | E1 review, 2026-10-02 |
| L10 | **Pick a test instance from the measurement, not from memory.** Three of E1's first five tests failed because the "obvious" 4×4 Latin square is the research's own non-unique counterexample — the one square that cannot carry a uniqueness claim. When a measurement has already sorted instances into classes, draw the test instance from the class the assertion needs | E1, 2026-10-02 |
| L9 | **A helper moved into the engine "for the second consumer" is only reused if the second consumer calls it.** V0's review put `buildDisplayCells` in the engine because the PDF was coming; V3's first draft then wrote its own side→row/column mapping anyway. When a slice is the consumer a helper was moved for, start from that helper, and let a test or review catch a second mapping as a defect, not a style choice | V3 review, 2026-10-02 |
| L8 | **A focusable control inside a widget with its own key handler must decide where focus goes after a click.** `tabIndex -1` makes an element reachable by keyboard only in theory — a mouse click focuses it too — so a click on a gutter clue silently switched the board into gutter mode and swallowed the next digits. Any control that is "keyboard-only" by design needs its click handler to hand focus back explicitly | V2 review, 2026-10-02 |
| L7 | **Count solutions by line, not by cell.** Three throwaway counters were written for the V1 fixtures: a cell-by-cell backtracker with prefix checks never finished one 7×7 count; a row-permutation DFS with top-clue pruning stalled once clues were sparse; the research's design — per-line permutation buckets filtered against cell masks, propagated to a fixpoint, then MRV — counted any 7×7 in 1–3 ms. E1 builds the third, and only the third | V1, 2026-10-02 |
| L6 | **Repair the square, never retry it — from the first fixture, not from E3.** The Kakuro lesson (L7/L15 there) arrived at V1 here: random 7×7 Latin squares are never unique with all clues (0 / 94,962), while intercalate swaps accepted on a capped solution count reach uniqueness in tens of steps. Any "generate and reject" step in E4 is a design error, not a tuning problem | V1, 2026-10-02 |
| L5 | **Hiding a cell from the accessibility tree changes the shape of its grid.** `aria-hidden` on an empty corner cell is not neutral: the first and last rows then expose N cells against N+2 in the middle, and a screen reader reports a malformed grid with column numbers that jump between rows. Keep every cell of a `role="grid"` in the tree (empty, read-only) and state the geometry with `aria-rowcount` / `aria-colcount` / `aria-rowindex` / `aria-colindex` | V0 review, 2026-10-02 |
| L4 | **Check a source mirror's freshness before quoting it as the source.** The research doc read Tatham's colour enum from a stale GitHub mirror (`ghewgill/puzzles`) that lacked `COL_DONE`, and inferred "violated only on a completed line"; the current `towers.c` has the done colour and flags prefix-provable violations immediately. Quote the upstream or a dated release, and say which | G10, 2026-10-01 |
| L3 | **A measured number from a research pass is "replicated" only when the repo can reproduce it.** The 4×4 / 5×5 ambiguity counts were replicated once in-session with a throwaway script; E1 turns them into tests so the claim survives the session that made it | Research banner, 2026-10-01 |

## Measurements

| Date | Commit | What | Numbers |
|---|---|---|---|
| 2026-10-02 | R1 (seeded dry run, real engines, no database — `tsx --tsconfig` scratch script) | **Five days of the 5-type roll** | **8 rows / 8 distinct keys every day**; every `(variant, size, difficulty)` had a profile; Skyscrapers in the standard section 5/5 days (6×6) and a mini 5/5 (5×5); **0.7 / 1.5 / 2.6 / 6.2 / 10.5 s per day** (the slow day: a 9×9 Kakuro easy + a Killer extreme) against the cron's 60 s |
| 2026-10-02 | E5 (`benchmark-skyscrapers.ts`, 10 per cell; fuzz 500 per size) | **Exact-tier generation** per offered cell, and the soundness fuzz over generated puzzles | **Avg ms (max):** 5×5 easy 11 (25) · medium 9 (18) · hard 43 (72); 6×6 easy 57 (131) · medium 32 (81) · hard 40 (107) · expert 201 (774) · extreme 52 (93); 7×7 medium 459 (1,113) · hard 297 (810) · expert 704 (1,619) · extreme 311 (628). **Fuzz (unbounded generation, 500 per size):** 0 unsound placements, 0 non-unique, 0 label mismatches, 0 contradictions; served tiers 5×5 easy 124 · medium 188 · hard 15 · expert 5 · extreme 154 · unrated 14; 6×6 11 / 116 / 62 / 16 / 270 / 25; 7×7 0 / 10 / 74 / 12 / 334 / 70 |
| 2026-10-02 | E4 (`generateUniqueSkyscrapers`, the route's policy: bounded 40 rounds / 12 floor misses / 6 s, then unbounded 2 s; 100 per cell at 5 and 6, 60 at 7) | **Generator gate** — failures, wall-clock and served tier per (size, requested level) | **Fails 0 everywhere.** Mean ms: 5×5 7–10; 6×6 easy 51 (3 fallbacks) · medium 34 · hard 35 · expert 34 · extreme 50; 7×7 **easy 3,506 (45/60 fallbacks)** · medium 655 · hard 402 · expert 391 · extreme 449. Served exactly the request: 5×5 100 / 61 / 6 / 10 / 35%; 6×6 97 / 93 / 46 / 11 / 64%; 7×7 25 / 100 / 97 / 20 / 87%. **Unbounded** (no target): 5×5 6 ms med, 6×6 20 ms, 7×7 221 ms (mean 284, max 1,168; restarts med 2); served extreme 29 / 60 / 71%, `unrated` 3 / 3 / 11%; kept med 7 / 11 / 14 |
| 2026-10-02 | E3b (same scripts, re-tiered ladder) | **Re-tier acceptance** — all-clue floor and tier-bounded yields with `lineScan` (≤ 3) / `lineEnumeration` (≤ 12) / `lineFilter` | **All-clue floor:** 5×5 T1 274 · T2 24 · T5 2 of 300; 6×6 T1 74 · T2 183 · T3 6 · T4 7 · T5 28 · unrated 2 of 300; 7×7 T1 0 · T2 30 · T3 35 · T4 3 · T5 29 · unrated 3 of 100. **Tier-bounded yield T1–T5:** 5×5 90 / 55 / 8 / 8 / 20% (ms per accepted 40 / 54 / 548 / 574 / 172); 6×6 28 / 85 / 58 / 15 / 53% (235 / 67 / 115 / 381 / 119 ms); 7×7 0 / 28 / 58 / 8 / 68%. **Survival (100/size):** tiers now spread — 5×5 T1 31 · T2 41 · T3 1 · T4 5 · T5 21; 6×6 T1 1 · T2 14 · T3 18 · T4 3 · T5 55 · unrated 9. **Fixtures:** 5×5 easy (was hard), 6×6 / 7×7 extreme; classify 0.24 / 5.1 / 4.5 ms after the review's per-line scans (0.6 / 9.2 / 8.0 with a whole-grid rescan); scores 13.2 / 139.3 / 100.6 |
| 2026-10-02 | E3 (throwaway scripts, `main` at `226a7fa`) | **Yield spike** — repair / survival / tier reachability / all-clue floor / line-filter scan sizes at 4–9; full tables in [research/skyscrapers-feasibility-findings.md](research/skyscrapers-feasibility-findings.md) | **Repair (intercalate swaps, cap 60):** already-unique 74 / 34 / 8 / 0 / 0% at 4/5/6/7/9; ok 48 / 47 / 43 / **24** / **0** of 50 (8 at 9); median 0.1 / 0.2 / 3.6 / 98 ms; **7×7 with restart after 40 fruitless swaps, cap 20: 30/30, 178 ms median, 722 max**; 9×9 count 60–100 ms, classify 130–470 ms. **Survival (200/size):** kept median 4/16 · 7/20 · 11/24 · 14/28, min 3 · 4 · 7 · 11; tiers hard/extreme only, `unrated` 7% / 15% at 6 / 7. **Tier-bounded yield T1–T5:** 4×4 25/40/88/0/23% · 5×5 3/8/100/10/38% · 6×6 0/0/85/10/73% · 7×7 0/0/88/15/65%; ms per accepted 6×6 35 / 274 / 66 (T3/T4/T5), 7×7 122 / 749 / 295. **All-clue floor:** 5×5 T1 3 · T2 30 · T3 260 · T5 6 · unrated 1 of 300; 6×6 T1 1 · T2 1 · T3 273 · T4 2 · T5 20 · unrated 3 of 300. **Line-filter scans on all-clue squares:** 5×5 857 steps, 310 scan 1 arrangement, 81% of squares need ≤ 3; 6×6 1,860 steps, 62% of squares need ≤ 12 |
| 2026-10-02 | E2 | **Logical solver on the fixtures** (`tsx` script, Node 24, warm, 100 runs each; after the review fixes) | **Classify:** 5×5 **0.42 ms** · 6×6 **6.7 ms** · 7×7 **6.3 ms** (gate 20 ms; cold first call 19 ms = the table build; 0.47 / 7.4 / 7.0 before the lines/houses were precomputed). **Grades:** hard (T3) / extreme (T5) / extreme (T5). **Histograms:** 5×5 `clueN×5 positionBound×4 nearlyFilledClue×2 clue2Pattern×1 nakedSingle×18 hiddenSingle×2 lineFilter×3`; 6×6 `clue1×1 positionBound×11 clue2Pattern×7 nakedSingle×25 hiddenSingle×10 lineFilter×18 forcingChain×4`; 7×7 `positionBound×14 clue2Pattern×1 nakedSingle×37 hiddenSingle×12 lineFilter×20 forcingChain×2`. **Scores:** 24.8 / 163.7 / 122.2. **Metrics:** rating 2.57 / 4.91 / 5.0; fixed 7 / 2 / 8; implied 11 / 2 / 8; trivial clues 1 / 1 / 0; facing sums 0 / 0 / 0. Soundness fuzz: 25 random unique 4×4/5×5 puzzles + 3 fixtures, zero disagreements with the exact solution |
| 2026-10-02 | E1 | **Exact solver on the fixtures** (`tsx` script, Node 24, warm, 200 runs each) | **Table build:** 5: 1.2 ms · 6: 3.5 ms · 7: 9.7 ms · 9: 205 ms (lazy, once per session). **Uniqueness verify:** 5×5 **0.07 ms** / 1 node · 6×6 **0.40 ms** / 7 nodes · 7×7 **1.1 ms** / 3 nodes (gate 50 ms). **Propagation from empty:** 25/25 · 5/36 · 8/49 cells forced. In-repo now: 204/576 4×4 squares not all-clue unique; the 4×4 pair → 2 solutions |
| 2026-10-02 | V1 (throwaway script, not committed) | **All-clue uniqueness of random Latin squares** — random backtracking fill, all 4N clues, line-filter counter capped at 2 solutions; and **repair** by random intercalate swaps accepted when the count (cap 60) does not rise, then greedy clue removal while unique | **P(unique):** 5×5 2/2 tries · 6×6 1/15 · **7×7 0/94,962** (1–3 ms per count; both solutions of a sample verified independently). **Repair 7×7:** unique after **38 swaps / 192 ms**; removal then kept **14/28** clues (255 ms total). Fixtures kept: 5×5 **5/20**, 6×6 **15/24** |
| 2026-10-01 | plan (no code) | **Minimum clue count at 4×4 (G5)** — every non-empty subset of the 16 edge clues (65,535) against all 576 Latin squares; a square is "determined" by a subset if no other square shares its masked clue vector; throwaway Node script, 9.7 s | **Smallest determining subset: 3 clues** (416 of 560 three-clue subsets determine ≥ 1 square); **no 2-clue subset determines any square**. Fewest clues per square: 3 → 208 squares, 4 → 142, 5 → 22, undetermined by all 16 → 204. Consistent with Nakamura's N−1 conjecture |
| 2026-10-01 | plan (no code) | **All-clue ambiguity** — exhaustive enumeration of every Latin square at N = 4 and 5, grouping by the full 4N-clue signature; the research's own measurement, replicated independently in-session with a second throwaway script (Node, 1.9 s total) | **4×4:** 576 squares → 438 signatures; **204 (35.42%) not unique**; multiplicities {1: 372, 2: 34, 4: 28, 6: 4}. **5×5:** 161,280 squares → 102,398 signatures; **92,912 (57.61%) not unique**; multiplicities up to 20 (4 signatures shared by 20 squares). N ≥ 6 unmeasured (G4) |
